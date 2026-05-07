"""
analysis.py - Motor de analisis para cumplimiento de visitas del INE.
Contiene toda la logica de estadisticas, distribuciones, clustering y reduccion de dias.
"""

import numpy as np
import pandas as pd
from scipy import stats
from scipy.optimize import curve_fit
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from kneed import KneeLocator
import os
import math

def safe_float(val):
    if val is None or pd.isna(val) or math.isinf(val):
        return None
    return float(val)

# ============================================================
# CARGA DE DATOS
# ============================================================

def load_data(filepath=None, sheet_name=None):
    """Carga los datos del Excel y retorna un DataFrame limpio.
    Si sheet_name es None, usa la primera hoja."""
    if filepath is None:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        filepath = os.path.join(base, "cumplimiento_visitas_custom.xlsx")
        if not os.path.exists(filepath):
            filepath = os.path.join(base, "cumplimiento_completo_v1_poblado.xlsx")
        if not os.path.exists(filepath):
            filepath = os.path.join(base, "cumplimiento_visitas_nuevo.xlsx")
        if not os.path.exists(filepath):
            filepath = os.path.join(base, "cumplimiento_visitas.xlsx")

    kwargs = {'header': 1}
    if sheet_name:
        kwargs['sheet_name'] = sheet_name

    df = pd.read_excel(filepath, **kwargs)
    df.columns = [str(c).strip() for c in df.columns]
    df = df.dropna(how='all')

    # Detectar columna de distrito: puede ser 'Distrito' o 'ID Distrito'
    if 'Distrito' in df.columns:
        df['Distrito'] = df['Distrito'].astype(int)
    elif 'ID Distrito' in df.columns:
        df.rename(columns={'ID Distrito': 'Distrito'}, inplace=True)
        df['Distrito'] = df['Distrito'].astype(int)

    # Normalizar columna de entidad
    if 'ID Entidad' in df.columns and 'Entidad' in df.columns:
        df['ID Entidad'] = df['ID Entidad'].astype(int)

    return df


def get_sheet_names(filepath=None):
    """Devuelve la lista de hojas disponibles en el Excel."""
    if filepath is None:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        filepath = os.path.join(base, "cumplimiento_visitas_custom.xlsx")
        if not os.path.exists(filepath):
            filepath = os.path.join(base, "cumplimiento_completo_v1_poblado.xlsx")
        if not os.path.exists(filepath):
            filepath = os.path.join(base, "cumplimiento_visitas_nuevo.xlsx")
        if not os.path.exists(filepath):
            filepath = os.path.join(base, "cumplimiento_visitas.xlsx")
    xl = pd.ExcelFile(filepath)
    return xl.sheet_names


def get_data_matrix(df):
    """Extrae la matriz numerica del DataFrame.
    Soporta columnas 'DX' y 'Día X'."""
    day_cols = [c for c in df.columns if c.startswith('Día ') or
                (c.startswith('D') and c[1:].isdigit())]
    day_cols = [c for c in day_cols if c not in ('Distrito', 'ID Distrito')]
    matrix = df[day_cols].fillna(0).values.astype(float)
    return matrix, day_cols


def filter_by_state(df, state):
    """Filtra el DataFrame por nombre de entidad y devuelve df + matrix."""
    if state and 'Entidad' in df.columns:
        df_filtered = df[df['Entidad'] == state].copy()
    else:
        df_filtered = df.copy()
    matrix, day_cols = get_data_matrix(df_filtered)
    return df_filtered, matrix, day_cols


def compute_state_summary(df, matrix, day_cols):
    """Resumen ejecutivo por entidad federativa."""
    if 'Entidad' not in df.columns:
        return []

    n_days = matrix.shape[1]
    last_day_idx = n_days - 1
    states = []

    for state_name, group in df.groupby('Entidad'):
        indices = group.index
        # Necesitamos mapear indices de grupo al rango de la matrix
        # La matrix se construyo del df completo, asi que usamos posiciones
        pos = [df.index.get_loc(i) for i in indices]
        sub = matrix[pos, :]
        last_vals = sub[:, last_day_idx]

        states.append({
            'entidad': state_name,
            'id_entidad': int(group['ID Entidad'].iloc[0]) if 'ID Entidad' in group.columns else 0,
            'n_distritos': len(group),
            'media_actual': safe_float(np.mean(last_vals)),
            'min_actual': safe_float(np.min(last_vals)),
            'max_actual': safe_float(np.max(last_vals)),
            'std_actual': safe_float(np.std(last_vals)),
            'media_dia1': safe_float(np.mean(sub[:, 0])),
        })

    return sorted(states, key=lambda x: x['media_actual'] or 0)


# ============================================================
# ESTADISTICAS DESCRIPTIVAS
# ============================================================

def compute_summary_stats(matrix):
    """Calcula estadisticos descriptivos por dia."""
    n_days = matrix.shape[1]
    results = []
    for d in range(n_days):
        col = matrix[:, d]
        results.append({
            'dia': d + 1,
            'media': safe_float(np.mean(col)),
            'mediana': safe_float(np.median(col)),
            'std': safe_float(np.std(col)),
            'min': safe_float(np.min(col)),
            'max': safe_float(np.max(col)),
            'q25': safe_float(np.percentile(col, 25)),
            'q75': safe_float(np.percentile(col, 75)),
            'asimetria': safe_float(stats.skew(col)),
            'curtosis': safe_float(stats.kurtosis(col)),
            'pct_above_80': safe_float(np.mean(col >= 0.80) * 100),
            'pct_above_90': safe_float(np.mean(col >= 0.90) * 100),
            'pct_above_95': safe_float(np.mean(col >= 0.95) * 100),
        })
    return results


def compute_full_data(df, matrix):
    """Retorna los datos completos para graficar."""
    n_districts, n_days = matrix.shape
    return {
        'distritos': list(range(1, n_districts + 1)),
        'dias': list(range(1, n_days + 1)),
        'matrix': matrix.tolist(),
    }


def compute_lagging_districts(matrix, df=None, top_n=20, flatline_days=5):
    """Calcula los distritos con mayor rezago y detecta estancamientos."""
    n_districts, n_days = matrix.shape
    district_labels = get_district_labels(df) if df is not None else [f"Distrito {i+1}" for i in range(n_districts)]
    
    current_day_idx = n_days - 1
    current_vals = matrix[:, current_day_idx]
    
    if n_days > flatline_days:
        past_vals = matrix[:, current_day_idx - flatline_days]
        growth = current_vals - past_vals
    else:
        growth = np.zeros(n_districts)
        
    lagging = []
    for i in range(n_districts):
        lagging.append({
            'distrito': district_labels[i],
            'cumplimiento': safe_float(current_vals[i]),
            'crecimiento_5d': safe_float(growth[i]),
            'estancado': bool(growth[i] < 0.01) # Menos de 1% de crecimiento
        })
        
    # Ordenar por el cumplimiento mas bajo
    lagging.sort(key=lambda x: x['cumplimiento'])
    
    return lagging[:top_n]


# ============================================================
# AJUSTE DE DISTRIBUCIONES
# ============================================================

def fit_distributions(matrix, day):
    """Ajusta distribuciones teoricas a los datos de un dia especifico."""
    col = matrix[:, day - 1]
    col_clean = col[(col > 0) & (col < 1)]  # Evitar extremos para Beta

    results = {}

    # Normal
    mu, sigma = stats.norm.fit(col)
    ks_stat, ks_p = stats.kstest(col, 'norm', args=(mu, sigma))
    x = np.linspace(0, 1, 200)
    results['normal'] = {
        'params': {'mu': float(mu), 'sigma': float(sigma)},
        'ks_statistic': safe_float(ks_stat),
        'ks_pvalue': safe_float(ks_p),
        'pdf_x': x.tolist(),
        'pdf_y': [safe_float(v) for v in stats.norm.pdf(x, mu, sigma)],
    }

    # Beta
    if len(col_clean) > 10:
        a, b, loc, scale = stats.beta.fit(col_clean, floc=0, fscale=1)
        ks_stat, ks_p = stats.kstest(col_clean, 'beta', args=(a, b, loc, scale))
        results['beta'] = {
            'params': {'a': float(a), 'b': float(b)},
            'ks_statistic': safe_float(ks_stat),
            'ks_pvalue': safe_float(ks_p),
            'pdf_x': x.tolist(),
            'pdf_y': [safe_float(v) for v in stats.beta.pdf(x, a, b, loc, scale)],
        }

    # Log-Normal (solo si todos > 0)
    if np.all(col > 0):
        shape, loc, scale = stats.lognorm.fit(col, floc=0)
        ks_stat, ks_p = stats.kstest(col, 'lognorm', args=(shape, loc, scale))
        results['lognormal'] = {
            'params': {'shape': float(shape), 'loc': float(loc), 'scale': float(scale)},
            'ks_statistic': safe_float(ks_stat),
            'ks_pvalue': safe_float(ks_p),
            'pdf_x': x.tolist(),
            'pdf_y': [safe_float(v) for v in stats.lognorm.pdf(x, shape, loc, scale)],
        }

    # Histograma de datos reales
    hist, bin_edges = np.histogram(col, bins=30, density=True)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2

    results['histogram'] = {
        'bin_centers': bin_centers.tolist(),
        'counts': hist.tolist(),
    }

    results['data_stats'] = {
        'mean': float(np.mean(col)),
        'std': float(np.std(col)),
        'median': float(np.median(col)),
        'n': int(len(col)),
    }

    return results


# ============================================================
# CORRELACION TEMPORAL
# ============================================================

def compute_correlation(matrix, days=None):
    """Calcula la matriz de correlacion entre dias seleccionados."""
    if days is None:
        # Seleccionar dias representativos para no sobrecargar
        days = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]
    
    indices = [d - 1 for d in days if d - 1 < matrix.shape[1]]
    sub_matrix = matrix[:, indices]
    # np.corrcoef puede dar NaN si la varianza es cero
    corr = np.nan_to_num(np.corrcoef(sub_matrix.T))
    
    return {
        'days': [d + 1 for d in indices],
        'correlation': corr.tolist(),
    }


# ============================================================
# CLUSTERING
# ============================================================

def get_district_labels(df):
    """Genera las etiquetas formateadas de los distritos."""
    labels = []
    if df is None:
        return labels
    for _, row in df.iterrows():
        entidad = row.get('Entidad', 'Desconocido')
        distrito = row.get('Distrito', '')
        cabecera = row.get('Cabecera', 'Desconocido')
        
        if isinstance(distrito, (int, float)) or (isinstance(distrito, str) and str(distrito).isdigit()):
            dist_str = f"D{int(distrito):02d}"
        else:
            dist_str = f"D{distrito}"
            
        labels.append(f"{entidad}_{dist_str}_{cabecera}")
    return labels

def compute_clusters(matrix, df=None, k=None, max_k=10):
    """Ejecuta K-Means clustering con seleccion opcional de K o automatica."""
    n_samples = matrix.shape[0]
    district_labels = get_district_labels(df) if df is not None else [f"Distrito {i+1}" for i in range(n_samples)]

    # Guard: no se puede clusterizar con menos de 3 muestras
    if n_samples < 3:
        pca = PCA(n_components=min(2, matrix.shape[1]))
        X_pca = pca.fit_transform(matrix)
        return {
            'best_k': 1,
            'labels': [0] * n_samples,
            'district_names': district_labels,
            'inertias': [],
            'silhouettes': [],
            'k_range': [],
            'pca': {
                'x': X_pca[:, 0].tolist() if X_pca.shape[1] > 0 else [0]*n_samples,
                'y': X_pca[:, 1].tolist() if X_pca.shape[1] > 1 else [0]*n_samples,
                'explained_variance': pca.explained_variance_ratio_.tolist(),
            },
            'cluster_profiles': [{
                'cluster': 0,
                'n_distritos': n_samples,
                'profile': matrix.mean(axis=0).tolist(),
                'mean_final': float(matrix[:, -1].mean()),
                'std_final': float(matrix[:, -1].std()) if n_samples > 1 else 0.0,
                'mean_day1': float(matrix[:, 0].mean()),
            }],
        }

    # Ajustar max_k si hay menos muestras que el rango
    effective_max_k = min(max_k, n_samples - 1)
    if effective_max_k < 2:
        effective_max_k = 2

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(matrix)

    inertias = []
    silhouettes = []
    k_range = range(2, effective_max_k + 1)

    if k is None:
        # Encontrar K optimo
        for k_val in k_range:
            kmeans = KMeans(n_clusters=k_val, random_state=42, n_init=10)
            labels = kmeans.fit_predict(X_scaled)
            inertias.append(float(kmeans.inertia_))
            silhouettes.append(float(silhouette_score(X_scaled, labels)))

        # Mejor K por Silhouette
        best_k_idx = np.argmax(silhouettes)
        best_k = list(k_range)[best_k_idx]
    else:
        best_k = min(k, effective_max_k)
        # Aun calculamos inertias/silhouettes para graficos si se requieren
        for k_val in k_range:
            kmeans = KMeans(n_clusters=k_val, random_state=42, n_init=10)
            labels_tmp = kmeans.fit_predict(X_scaled)
            inertias.append(float(kmeans.inertia_))
            silhouettes.append(float(silhouette_score(X_scaled, labels_tmp)))

    # Ejecutar con K seleccionado
    kmeans = KMeans(n_clusters=best_k, random_state=42, n_init=10)
    labels = kmeans.fit_predict(X_scaled)

    # PCA 2D para visualizacion
    pca = PCA(n_components=2)
    X_pca = pca.fit_transform(X_scaled)

    # Promedios por cluster
    cluster_profiles = []
    for c in range(best_k):
        mask = labels == c
        profile = matrix[mask].mean(axis=0)
        cluster_profiles.append({
            'cluster': int(c),
            'n_distritos': int(mask.sum()),
            'profile': profile.tolist(),
            'mean_final': float(matrix[mask, -1].mean()),
            'std_final': float(matrix[mask, -1].std()),
            'mean_day1': float(matrix[mask, 0].mean()),
        })

    return {
        'best_k': int(best_k),
        'labels': [int(l) for l in labels],
        'district_names': district_labels,
        'inertias': inertias,
        'silhouettes': silhouettes,
        'k_range': list(k_range),
        'pca': {
            'x': X_pca[:, 0].tolist(),
            'y': X_pca[:, 1].tolist(),
            'explained_variance': pca.explained_variance_ratio_.tolist(),
        },
        'cluster_profiles': cluster_profiles,
    }


# ============================================================
# REDUCTOR DE DIAS
# ============================================================

def compute_reductor(matrix, df=None, threshold=0.90, coverage=0.80, manual_day=None):
    """Calcula el analisis del Reductor de Dias para el balance optimo."""
    n_districts, n_days = matrix.shape
    district_labels = get_district_labels(df) if df is not None else [f"Distrito {i+1}" for i in range(n_districts)]
    dias = np.arange(1, n_days + 1)

    # --- 1. Rendimiento marginal ---
    mean_by_day = matrix.mean(axis=0)
    marginal = np.diff(mean_by_day)
    # El primer día el incremento es relativo al inicio (0), 
    # pero para evitar que opaque la gráfica si el inicio es alto,
    # usamos el incremento del día 1 al día 2 como referencia inicial o lo ponemos en 0.
    marginal = np.insert(marginal, 0, 0.0) 

    # --- 2. Cumplimiento acumulado promedio ---
    cumulative_mean = mean_by_day.tolist()

    # --- 3. Knee point (Kneedle algorithm) ---
    try:
        # Filtramos para evitar que el día 1 sea siempre el codo si los datos ya son altos
        kn = KneeLocator(
            dias[1:], mean_by_day[1:],
            curve='concave', direction='increasing',
            S=1.0
        )
        knee_day = int(kn.knee) if kn.knee else (int(dias[0]) if mean_by_day[0] > threshold else None)
    except Exception:
        knee_day = None

    # --- 4. Analisis por umbral y cobertura ---
    coverage_by_day = []
    for d in range(n_days):
        pct_above = float(np.mean(matrix[:, d] >= threshold))
        coverage_by_day.append(pct_above)

    # Encontrar dia donde se alcanza la cobertura deseada
    optimal_day_coverage = None
    for d in range(n_days):
        if coverage_by_day[d] >= coverage:
            optimal_day_coverage = d + 1
            break

    # --- 5. Simulacion de escenarios ---
    scenario_days = [15, 20, 25, 30, 35, 40, 45, 50]
    scenarios = []
    for sd in scenario_days:
        if sd <= n_days:
            idx = sd - 1
            col = matrix[:, idx]
            scenarios.append({
                'dia': sd,
                'media': float(col.mean()),
                'mediana': float(np.median(col)),
                'pct_above_80': float(np.mean(col >= 0.80) * 100),
                'pct_above_85': float(np.mean(col >= 0.85) * 100),
                'pct_above_90': float(np.mean(col >= 0.90) * 100),
                'pct_above_95': float(np.mean(col >= 0.95) * 100),
                'min': float(col.min()),
                'max': float(col.max()),
                'distritos_en_riesgo': int(np.sum(col < threshold)),
            })

    # --- 6. Distritos en riesgo en el dia optimo ---
    risk_districts = []
    opt_day = manual_day or optimal_day_coverage or knee_day or 35
    if opt_day <= n_days:
        col = matrix[:, opt_day - 1]
        for i in range(n_districts):
            if col[i] < threshold:
                risk_districts.append({
                    'distrito': district_labels[i],
                    'cumplimiento': float(col[i]),
                    'deficit': float(threshold - col[i]),
                })
        risk_districts.sort(key=lambda x: x['cumplimiento'])

    # --- 7. Analisis de eficiencia (rendimiento acumulado vs dias) ---
    efficiency = []
    for d in range(n_days):
        total_gain = mean_by_day[d] - mean_by_day[0]
        days_used = d + 1
        eff = total_gain / days_used if days_used > 0 else 0
        efficiency.append(float(eff))

    return {
        'mean_by_day': cumulative_mean,
        'marginal_returns': marginal.tolist(),
        'knee_day': knee_day,
        'optimal_day_coverage': optimal_day_coverage,
        'recommended_day': manual_day or optimal_day_coverage or knee_day or 35,
        'coverage_by_day': coverage_by_day,
        'scenarios': scenarios,
        'risk_districts': risk_districts,
        'total_risk_districts': len(risk_districts),
        'efficiency': efficiency,
        'threshold': threshold,
        'coverage': coverage,
        'dias': list(range(1, n_days + 1)),
        'recommendation_reason': get_recommendation_reason(
            manual_day, optimal_day_coverage, knee_day, 
            threshold, coverage, mean_by_day, n_days
        )
    }

def get_recommendation_reason(manual_day, opt_cov, knee, threshold, coverage, mean_by_day, n_days):
    """Genera una explicacion textual de la recomendacion."""
    if manual_day:
        return f"Ajuste manual: Se está evaluando el impacto operativo de cerrar el campo en el Día {manual_day}."
    
    rec_day = opt_cov or knee or 35
    
    reason = ""
    if opt_cov:
        reason = f"Meta alcanzada: El Día {opt_cov}, el {coverage*100:.0f}% de los distritos ya superaron el umbral del {threshold*100:.0f}% de cumplimiento."
    elif knee:
        reason = f"Máxima eficiencia: El Día {knee} se detectó el 'punto de codo', donde la ganancia diaria empieza a ser menor al costo operativo."
    else:
        reason = "Recomendación estándar basada en la finalización del ciclo operativo previsto."

    # Validacion de dias minimos (< 20)
    if rec_day < 20:
        current_mean = mean_by_day[rec_day - 1]
        if current_mean < 0.50:
            reason += " Nota: La recomendación es temprana debido a un estancamiento crítico en el avance (rendimiento casi nulo desde el inicio)."
        else:
            reason += " Nota: Los datos muestran un arranque excepcionalmente rápido, alcanzando niveles óptimos antes de lo previsto."
            
    return reason


# ============================================================
# BOX PLOT DATA
# ============================================================

def compute_boxplot_data(matrix):
    """Datos para box plots temporales."""
    n_days = matrix.shape[1]
    result = []
    for d in range(n_days):
        col = matrix[:, d]
        q1, q3 = np.percentile(col, [25, 75])
        iqr = q3 - q1
        lower_fence = max(col.min(), q1 - 1.5 * iqr)
        upper_fence = min(col.max(), q3 + 1.5 * iqr)
        outliers = col[(col < lower_fence) | (col > upper_fence)]
        result.append({
            'dia': d + 1,
            'min': float(lower_fence),
            'q1': float(q1),
            'median': float(np.median(col)),
            'q3': float(q3),
            'max': float(upper_fence),
            'outliers': outliers.tolist(),
        })
    return result
