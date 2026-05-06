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

def load_data(filepath=None):
    """Carga los datos del Excel y retorna un DataFrame limpio."""
    if filepath is None:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        filepath = os.path.join(base, "cumplimiento_visitas_custom.xlsx")
        # Fallback if custom doesn't exist
        if not os.path.exists(filepath):
            filepath = os.path.join(base, "cumplimiento_visitas_nuevo.xlsx")
        # Fallback if nuevo doesn't exist
        if not os.path.exists(filepath):
            filepath = os.path.join(base, "cumplimiento_visitas.xlsx")

    df = pd.read_excel(filepath, header=1)  # Row 2 is the header
    # Clean column names
    df.columns = [str(c).strip() for c in df.columns]
    # Remove any fully empty rows
    df = df.dropna(how='all')
    # Ensure Distrito is int
    df['Distrito'] = df['Distrito'].astype(int)
    return df


def get_data_matrix(df):
    """Extrae la matriz numerica (300 x 50) del DataFrame."""
    day_cols = [c for c in df.columns if c.startswith('D')]
    day_cols = [c for c in day_cols if c != 'Distrito']
    # Rellenar nulos con 0 para evitar errores en calculos matriciales
    matrix = df[day_cols].fillna(0).values.astype(float)
    return matrix, day_cols


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

def compute_clusters(matrix, max_k=10):
    """Ejecuta K-Means clustering con seleccion automatica de K."""
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(matrix)

    # Encontrar K optimo
    inertias = []
    silhouettes = []
    k_range = range(2, max_k + 1)

    for k in k_range:
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X_scaled)
        inertias.append(float(kmeans.inertia_))
        silhouettes.append(float(silhouette_score(X_scaled, labels)))

    # Mejor K por Silhouette
    best_k_idx = np.argmax(silhouettes)
    best_k = list(k_range)[best_k_idx]

    # Ejecutar con K optimo
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
# REDUCTOR DE DIAS - ANALISIS DE PUNTO OPTIMO
# ============================================================

def compute_reductor(matrix, threshold=0.90, coverage=0.80, manual_day=None):
    """
    Analisis completo para determinar el dia optimo de reduccion.
    
    Args:
        threshold: Porcentaje minimo de cumplimiento aceptable (0-1)
        coverage: Porcentaje minimo de distritos que deben alcanzar el threshold (0-1)
        manual_day: Dia manual forzado por el usuario (sobreescribe recomendacion)
    """
    n_districts, n_days = matrix.shape
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
                    'distrito': int(i + 1),
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
