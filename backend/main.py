"""
main.py - FastAPI backend para el analisis de cumplimiento de visitas del INE.
Sirve endpoints REST que el frontend React consume.
Soporta multiples hojas de Excel y filtrado por entidad federativa.
Soporta seleccion de datasets predefinidos por etapa operativa.
"""

from fastapi import FastAPI, Query, File, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import analysis
import io
import openpyxl
from openpyxl.utils import get_column_letter
import pandas as pd
import numpy as np
from pathlib import Path

app = FastAPI(title="Reductor de Dias - INE", version="3.0.0")

# CORS para clientes externos cuando frontend y API se sirven desde orígenes distintos.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# CONSTANTES: Datasets por Etapa
# ============================================================
BASE_DIR = str(Path(__file__).resolve().parent.parent)
_configured_datasets_dir = Path(os.environ.get("DATASETS_DIR", "datasets")).expanduser()
if not _configured_datasets_dir.is_absolute():
    _configured_datasets_dir = Path(BASE_DIR) / _configured_datasets_dir
DATASETS_DIR = str(_configured_datasets_dir.resolve())

DATASETS_POR_ETAPA = {
    1: [
        "PE_2020-2021_1a.xlsx",
        "PEC_2023-2024_1a.xlsx",
        "PEC_2017-2018_1a.xlsx",
    ],
    2: [
        "PE_2020-2021_2a.xlsx",
        "PEC_2023-2024_2a.xlsx",
        "PEL_2022-2023_Coahuila.xlsx",
        "PEC_2017-2018_2a.xlsx",
    ],
}

# Definición de Rubros por Etapa (Nombres exactos de las hojas del Excel)
RUBROS_ETAPA_1 = ["Visitados", "CCRL Optimo", "CCRL Requeridos"]
RUBROS_ETAPA_2 = ["Nombramientos", "Capacitación", "Asistencia a Simulacros"]
EXCLUDED_RUBRO = "Sustituciones de FMDC"

# ============================================================
# ESTADO GLOBAL (Caché)
# ============================================================
_sheets_cache = {}       # { sheet_name: (df, matrix, day_cols) }
_available_sheets = []
_active_file_path = None
_active_filename = None
_active_stage = None


def _clear_all_cache():
    """Limpia completamente todo el estado de datos cargados."""
    global _sheets_cache, _available_sheets, _active_file_path, _active_filename, _active_stage
    _sheets_cache = {}
    _available_sheets = []
    _active_file_path = None
    _active_filename = None
    _active_stage = None
    print("--- Caché limpiada completamente ---")


def _get_filepath():
    """Retorna la ruta del archivo cargado en la sesión actual."""
    return _active_file_path


def _ensure_sheets():
    global _available_sheets
    if not _available_sheets:
        fp = _get_filepath()
        if fp:
            _available_sheets = analysis.get_sheet_names(fp)


def get_data(sheet: str = None, state: str = None):
    """Obtiene df+matrix para una hoja, opcionalmente filtrado por estado."""
    global _sheets_cache, _available_sheets
    _ensure_sheets()

    # Default a la primera hoja disponible
    if not sheet and _available_sheets:
        sheet = _available_sheets[0]

    if sheet == "Global":
        if "Global" not in _sheets_cache:
            import numpy as np
            fp = _get_filepath()
            
            # Determinar qué rubros promediar según los que existan en el archivo
            relevant_rubros = RUBROS_ETAPA_1 + RUBROS_ETAPA_2
            
            matrices = []
            base_df = None
            day_cols = None
            for s in _available_sheets:
                if s not in relevant_rubros: continue
                
                if s not in _sheets_cache:
                    df = analysis.load_data(fp, sheet_name=s)
                    m, dc = analysis.get_data_matrix(df)
                    _sheets_cache[s] = (df, m, dc)
                
                df, m, dc = _sheets_cache[s]
                matrices.append(m)
                if base_df is None:
                    base_df = df
                    day_cols = dc
            
            if matrices:
                global_matrix = np.mean(matrices, axis=0)
                _sheets_cache["Global"] = (base_df, global_matrix, day_cols)
        
        df, matrix, day_cols = _sheets_cache.get("Global", (None, None, None))
    else:
        if sheet not in _sheets_cache:
            fp = _get_filepath()
            df = analysis.load_data(fp, sheet_name=sheet)
            matrix, day_cols = analysis.get_data_matrix(df)
            _sheets_cache[sheet] = (df, matrix, day_cols)

        df, matrix, day_cols = _sheets_cache[sheet]

    # Filtrar por estado si se solicita
    if state and df is not None:
        df, matrix, day_cols = analysis.filter_by_state(df, state)

    return df, matrix, day_cols


def _get_filtered_sheets(stage=None):
    """Helper para obtener la lista de rubros filtrada por etapa y con Global."""
    _ensure_sheets()
    
    if stage == 1:
        target_list = RUBROS_ETAPA_1
    elif stage == 2:
        target_list = RUBROS_ETAPA_2
    else:
        target_list = [s for s in _available_sheets if "sustituciones" not in s.strip().lower()]

    filtered = [s for s in _available_sheets if s in target_list]
    
    if not filtered:
        return []
    return ["Global"] + filtered


# ============================================================
# ENDPOINTS: Selección de Datasets
# ============================================================

@app.get("/api/datasets")
def list_datasets(stage: int = Query(None)):
    """Retorna la lista de datasets disponibles, opcionalmente filtrados por etapa."""
    result = {}
    stages_to_check = [stage] if stage else [1, 2]
    
    for s in stages_to_check:
        datasets = []
        for filename in DATASETS_POR_ETAPA.get(s, []):
            filepath = os.path.join(DATASETS_DIR, filename)
            exists = os.path.exists(filepath)
            size_mb = round(os.path.getsize(filepath) / (1024 * 1024), 2) if exists else 0
            datasets.append({
                "filename": filename,
                "exists": exists,
                "size_mb": size_mb,
            })
        result[str(s)] = datasets
    
    return {"datasets": result}


@app.post("/api/select-dataset")
def select_dataset(filename: str = Query(...), stage: int = Query(...)):
    """Selecciona un dataset predefinido para cargar y analizar."""
    global _sheets_cache, _available_sheets, _active_file_path, _active_filename, _active_stage
    
    # Validar que el dataset pertenece a la etapa indicada
    valid_datasets = DATASETS_POR_ETAPA.get(stage, [])
    if filename not in valid_datasets:
        return JSONResponse(
            status_code=400,
            content={"error": f"El dataset '{filename}' no pertenece a la Etapa {stage}."}
        )
    
    filepath = os.path.join(DATASETS_DIR, filename)
    if not os.path.exists(filepath):
        return JSONResponse(
            status_code=404,
            content={"error": f"El archivo '{filename}' no existe en la carpeta datasets/."}
        )
    
    # Limpiar caché completa antes de cargar
    _clear_all_cache()
    
    # Cargar nuevo dataset
    _active_file_path = filepath
    _active_filename = filename
    _active_stage = stage
    
    _available_sheets = analysis.get_sheet_names(filepath)
    print(f"--- Dataset seleccionado: {filename} (Etapa {stage}) ---")
    print(f"    Hojas encontradas: {_available_sheets}")
    
    # Obtener rubros filtrados por etapa
    sheets_for_front = _get_filtered_sheets(stage)
    
    # Pre-calcular Global para calentar caché
    if "Global" in sheets_for_front:
        try:
            print(f"    Calentando caché para Global...")
            get_data("Global")
        except Exception as e:
            print(f"    Aviso: No se pudo pre-calcular Global: {e}")
    
    # Obtener metadata del dataset: n_dias, n_distritos
    n_days = 0
    n_districts = 0
    day_col_names = []
    first_sheet = sheets_for_front[1] if len(sheets_for_front) > 1 else (sheets_for_front[0] if sheets_for_front else None)
    if first_sheet and first_sheet != "Global":
        try:
            df, matrix, day_cols = get_data(first_sheet)
            n_days = matrix.shape[1]
            n_districts = matrix.shape[0]
            day_col_names = day_cols
        except Exception as e:
            print(f"    Aviso: Error obteniendo metadata: {e}")
    
    print(f"    Rubros: {sheets_for_front} | Días: {n_days} | Distritos: {n_districts}")
    
    return {
        "message": f"Dataset '{filename}' cargado exitosamente.",
        "filename": filename,
        "stage": stage,
        "sheets": sheets_for_front,
        "n_days": n_days,
        "n_districts": n_districts,
        "day_columns": day_col_names,
    }


@app.get("/api/clear-cache")
def clear_cache():
    """Limpia toda la caché de datos y reinicia el estado del sistema."""
    _clear_all_cache()
    return {"message": "Caché limpiada exitosamente."}


# ============================================================
# ENDPOINTS: Datos y Análisis
# ============================================================

@app.get("/api/sheets")
def get_sheets(stage: int = Query(None)):
    """Retorna la lista de hojas disponibles en el Excel, filtradas por etapa."""
    return {"sheets": _get_filtered_sheets(stage or _active_stage)}


@app.get("/api/active-file")
def get_active_file():
    """Retorna el nombre del archivo Excel que está siendo utilizado."""
    if _active_filename:
        return {
            "filename": _active_filename,
            "stage": _active_stage,
        }
    return {"filename": None, "stage": None}


@app.get("/api/raw-data")
def get_raw_data(sheet: str = Query(None), state: str = Query(None)):
    """Retorna datos crudos del dataset para el visor de tabla.
    Incluye encabezados, columnas de identificación y valores por día."""
    _ensure_sheets()
    
    fp = _get_filepath()
    if not fp:
        return JSONResponse(status_code=400, content={"error": "No hay dataset cargado."})
    
    target_sheet = sheet
    if not target_sheet:
        filtered = _get_filtered_sheets(_active_stage)
        target_sheet = filtered[1] if len(filtered) > 1 else (filtered[0] if filtered else None)
    
    if not target_sheet or target_sheet == "Global":
        # Para Global, usamos el primer rubro real
        filtered = _get_filtered_sheets(_active_stage)
        target_sheet = filtered[1] if len(filtered) > 1 else None
    
    if not target_sheet:
        return JSONResponse(status_code=400, content={"error": "No hay hoja disponible."})
    
    # Cargar datos
    df, matrix, day_cols = get_data(target_sheet, state)
    
    # Construir columnas de identificación
    id_columns = []
    for col_name in ["ID Entidad", "Entidad", "ID Distrito", "Distrito", "Cabecera"]:
        if col_name in df.columns:
            id_columns.append(col_name)
    
    # Construir filas
    rows = []
    for idx, (_, row) in enumerate(df.iterrows()):
        row_data = {}
        for col_name in id_columns:
            val = row.get(col_name, "")
            row_data[col_name] = str(val) if val is not None else ""
        
        # Agregar valores de días
        for j, dc in enumerate(day_cols):
            if idx < matrix.shape[0] and j < matrix.shape[1]:
                row_data[dc] = round(float(matrix[idx, j]), 4)
            else:
                row_data[dc] = 0
        rows.append(row_data)
    
    return {
        "sheet": target_sheet,
        "id_columns": id_columns,
        "day_columns": day_cols,
        "n_days": len(day_cols),
        "n_districts": len(rows),
        "rows": rows,
        "filename": _active_filename,
    }


@app.get("/api/data")
def get_full_data(sheet: str = Query(None), state: str = Query(None)):
    """Retorna datos completos."""
    df, matrix, _ = get_data(sheet, state)
    return analysis.compute_full_data(df, matrix)


@app.get("/api/stats")
def get_stats(sheet: str = Query(None), state: str = Query(None)):
    """Retorna estadisticos descriptivos por dia."""
    _, matrix, _ = get_data(sheet, state)
    return analysis.compute_summary_stats(matrix)


@app.get("/api/distributions/{day}")
def get_distributions(day: int, sheet: str = Query(None), state: str = Query(None)):
    """Ajusta distribuciones teoricas para un dia especifico."""
    _, matrix, _ = get_data(sheet, state)
    if day < 1 or day > matrix.shape[1]:
        return {"error": f"Dia debe estar entre 1 y {matrix.shape[1]}"}
    return analysis.fit_distributions(matrix, day)


@app.get("/api/correlation")
def get_correlation(sheet: str = Query(None), state: str = Query(None)):
    """Retorna la matriz de correlacion temporal."""
    _, matrix, _ = get_data(sheet, state)
    return analysis.compute_correlation(matrix)


@app.get("/api/boxplot")
def get_boxplot(sheet: str = Query(None), state: str = Query(None)):
    """Datos para box plots temporales."""
    _, matrix, _ = get_data(sheet, state)
    return analysis.compute_boxplot_data(matrix)


@app.get("/api/lagging")
def get_lagging(sheet: str = Query(None), state: str = Query(None), top: int = 20):
    """Distritos con mayor rezago y alertas de estancamiento."""
    df, matrix, _ = get_data(sheet, state)
    return analysis.compute_lagging_districts(matrix, df=df, top_n=top)


@app.get("/api/clusters")
def get_clusters(k: int = Query(None, ge=2, le=10), sheet: str = Query(None), state: str = Query(None)):
    """Ejecuta K-Means clustering."""
    df, matrix, _ = get_data(sheet, state)
    return analysis.compute_clusters(matrix, df=df, k=k)


@app.get("/api/reductor")
def get_reductor(
    threshold: float = Query(0.90, ge=0.0, le=1.0),
    coverage: float = Query(0.80, ge=0.0, le=1.0),
    manual_day: int = Query(None, ge=1),
    sheet: str = Query(None),
    state: str = Query(None)
):
    """Analisis de punto optimo para reduccion de dias."""
    df, matrix, _ = get_data(sheet, state)
    return analysis.compute_reductor(matrix, df=df, threshold=threshold, coverage=coverage, manual_day=manual_day)


@app.get("/api/reductor/report")
def export_reductor_report(
    threshold: float = Query(0.90, ge=0.0, le=1.0),
    coverage: float = Query(0.80, ge=0.0, le=1.0)
):
    """Genera un reporte Excel con la Simulación de Escenarios del día 25 al final,
    con columnas adicionales de cumplimiento mínimo y máximo bajo umbral.
    Una hoja por rubro para la etapa actual."""
    global _active_stage, _active_filename, _available_sheets
    
    fp = _get_filepath()
    if not fp or not _active_stage:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No hay ningún dataset activo cargado o la sesión expiró.")

    # Definir rubros según la etapa
    if _active_stage == 1:
        rubros_to_export = [
            ("Global", "Global"),
            ("Visitados", "Visitados"),
            ("CCRL Optimo", "CCRL Optimo")
        ]
    else:
        rubros_to_export = [
            ("Global", "Global"),
            ("Nombramientos", "Nombramientos"),
            ("Capacitados", "Capacitación"),
            ("Asistencia a Simulacros", "Asistencia a Simulacros")
        ]

    output_buffer = io.BytesIO()
    
    # Crear Excel Writer
    with pd.ExcelWriter(output_buffer, engine='openpyxl') as writer:
        for sheet_label, dataset_sheet in rubros_to_export:
            # Buscar el origen real en el dataset
            real_sheet = None
            if dataset_sheet == "Global":
                real_sheet = "Global"
            else:
                for s in _available_sheets:
                    if s.strip().lower() == dataset_sheet.strip().lower():
                        real_sheet = s
                        break
                
                # Fallback de CCRL
                if not real_sheet and dataset_sheet == "CCRL Optimo":
                    for s in _available_sheets:
                        if "requeridos" in s.lower() or "requerido" in s.lower() or "ccrl" in s.lower():
                            real_sheet = s
                            break
                
                # Fallback de Capacitación
                if not real_sheet and dataset_sheet == "Capacitación":
                    for s in _available_sheets:
                        if "capacita" in s.lower():
                            real_sheet = s
                            break

            # Si no se encuentra, omitimos o creamos una hoja vacía/informativa
            if not real_sheet:
                print(f"[WARN] No se pudo encontrar hoja para {dataset_sheet}")
                df_err = pd.DataFrame({"Mensaje": [f"El rubro '{sheet_label}' no está disponible en este dataset." ]})
                df_err.to_excel(writer, sheet_name=sheet_label, index=False)
                continue

            try:
                # Obtener df y matrix
                df, matrix, day_cols = get_data(real_sheet)
                if matrix is None or matrix.shape[1] == 0:
                    df_err = pd.DataFrame({"Mensaje": [f"No hay datos para calcular la simulación." ]})
                    df_err.to_excel(writer, sheet_name=sheet_label, index=False)
                    continue

                n_districts, n_days = matrix.shape
                eff_threshold = threshold - 0.0005
                threshold_pct_label = f"{threshold * 100:.0f}%"

                # Construir nombres descriptivos de distrito para el listado
                district_labels = analysis.get_district_labels(df)

                # Generar escenarios del día 25 al último
                start_day = 25
                if n_days < 25:
                    start_day = 1 # Si el dataset tiene menos de 25 días, empezamos del 1

                scenarios_data = []
                for sd in range(start_day, n_days + 1):
                    idx = sd - 1
                    col = matrix[:, idx]

                    above_threshold = col >= eff_threshold
                    at_100 = col >= 0.9995

                    # Porcentaje del distrito con menor cumplimiento
                    min_val = float(np.min(col))

                    # Porcentaje del distrito con mayor cumplimiento por debajo del umbral
                    below_threshold_vals = col[col < eff_threshold]
                    if len(below_threshold_vals) > 0:
                        max_below = float(np.max(below_threshold_vals))
                    else:
                        max_below = None

                    # Formatear valores
                    media_str = f"{col.mean() * 100:.1f}%"
                    pct_above_str = f"{np.mean(above_threshold) * 100:.1f}%"
                    count_above = int(np.sum(above_threshold))
                    pct_100_str = f"{np.mean(at_100) * 100:.1f}%"
                    count_100 = int(np.sum(at_100))
                    distritos_riesgo = int(np.sum((~above_threshold) & (~at_100)))

                    min_val_str = f"{min_val * 100:.1f}%"
                    max_below_str = f"{max_below * 100:.1f}%" if max_below is not None else "N/A"

                    # Listar nombres de distritos > umbral
                    above_indices = np.where(above_threshold)[0]
                    distritos_above_names = ", ".join([district_labels[i] for i in above_indices]) if len(above_indices) > 0 else "Ninguno"

                    # Listar nombres de distritos con 100%
                    at100_indices = np.where(at_100)[0]
                    distritos_100_names = ", ".join([district_labels[i] for i in at100_indices]) if len(at100_indices) > 0 else "Ninguno"

                    # Listar nombres de distritos en riesgo (ni sobre umbral ni al 100%)
                    risk_mask = (~above_threshold) & (~at_100)
                    risk_indices = np.where(risk_mask)[0]
                    distritos_riesgo_names = ", ".join([district_labels[i] for i in risk_indices]) if len(risk_indices) > 0 else "Ninguno"

                    scenarios_data.append({
                        "Si cortamos el Día...": f"Día {sd}",
                        "Cumplimiento Medio": media_str,
                        f"Porcentaje de Distritos > Umbral ({threshold_pct_label})": pct_above_str,
                        f"Distritos > Umbral ({threshold_pct_label}) (Cantidad)": count_above,
                        f"Distritos > Umbral ({threshold_pct_label}) (Nombres)": distritos_above_names,
                        "Distritos con 100% (%)": pct_100_str,
                        "Distritos con 100% (Cantidad)": count_100,
                        "Distritos con 100% (Nombres)": distritos_100_names,
                        "Distritos en Riesgo": distritos_riesgo,
                        "Distritos en Riesgo (Nombres)": distritos_riesgo_names,
                        "Mínimo Cumplimiento": min_val_str,
                        "Máximo Cumplimiento bajo Umbral": max_below_str
                    })

                df_scenarios = pd.DataFrame(scenarios_data)
                
                # Escribir en la hoja correspondiente
                df_scenarios.to_excel(writer, sheet_name=sheet_label, index=False)
                
                # Ajustar anchos de columnas
                worksheet = writer.sheets[sheet_label]
                for col_idx, col_name in enumerate(df_scenarios.columns, 1):
                    max_len = max(df_scenarios[col_name].astype(str).map(len).max(), len(col_name)) + 3
                    worksheet.column_dimensions[get_column_letter(col_idx)].width = max_len

            except Exception as e:
                print(f"[ERROR] Error generando hoja {sheet_label}: {e}")
                df_err = pd.DataFrame({"Error": [str(e)]})
                df_err.to_excel(writer, sheet_name=sheet_label, index=False)

    output_buffer.seek(0)
    
    # Nombre del archivo
    clean_filename = _active_filename.replace(".xlsx", "") if _active_filename else "dataset"
    download_name = f"Reporte_Escenarios_Etapa{_active_stage}_{clean_filename}.xlsx"

    return StreamingResponse(
        output_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={download_name}"}
    )


@app.get("/api/comparative")
def get_comparative(state: str = Query(None)):
    """Devuelve el avance actual promedio para cada rubro."""
    _ensure_sheets()
    results = []
    fp = _get_filepath()
    if not fp: return results
    
    for s in _available_sheets:
        if s == "Global": continue
        
        if s in _sheets_cache:
            df, matrix, day_cols = _sheets_cache[s]
        else:
            df = analysis.load_data(fp, sheet_name=s)
            matrix, day_cols = analysis.get_data_matrix(df)
            _sheets_cache[s] = (df, matrix, day_cols)
            
        if state and df is not None:
            df_filtered, matrix_filtered, _ = analysis.filter_by_state(df, state)
            m = matrix_filtered
        else:
            m = matrix
            
        if m.shape[1] > 0:
            last_day_mean = float(m[:, -1].mean())
            results.append({'rubro': s, 'avance': last_day_mean})
            
    return sorted(results, key=lambda x: x['avance'], reverse=True)


@app.get("/api/state-summary")
def get_state_summary(sheet: str = Query(None)):
    """Resumen ejecutivo por entidad federativa."""
    _ensure_sheets()
    s = sheet or (_available_sheets[0] if _available_sheets else None)
    if s and s not in _sheets_cache:
        fp = _get_filepath()
        df = analysis.load_data(fp, sheet_name=s)
        matrix, day_cols = analysis.get_data_matrix(df)
        _sheets_cache[s] = (df, matrix, day_cols)
    if s and s in _sheets_cache:
        df, matrix, day_cols = _sheets_cache[s]
        return analysis.compute_state_summary(df, matrix, day_cols)
    return []


@app.post("/api/upload")
async def upload_file(stage: int = Query(None), file: UploadFile = File(...)):
    """Sube un archivo de Excel para reemplazar los datos de analisis."""
    global _sheets_cache, _available_sheets, _active_filename, _active_file_path, _active_stage
    try:
        os.makedirs(DATASETS_DIR, exist_ok=True)
        filepath = os.path.join(DATASETS_DIR, "cumplimiento_visitas_custom.xlsx")
        print(f"--- Recibiendo archivo etapa {stage}: {file.filename} ---")

        contents = await file.read()
        if not contents:
            raise ValueError("El archivo está vacío")

        with open(filepath, "wb") as f:
            f.write(contents)

        print(f"Archivo guardado en: {filepath}. Validando hojas para etapa {stage}...")

        _available_sheets = analysis.get_sheet_names(filepath)
        print(f"Hojas encontradas en el archivo: {_available_sheets}")
        
        required_sheets = RUBROS_ETAPA_1 if stage == 1 else RUBROS_ETAPA_2
        available_normalized = [s.strip().lower() for s in _available_sheets]
        missing_sheets = [s for s in required_sheets if s.strip().lower() not in available_normalized]
        
        if missing_sheets:
            print(f"Error de validación: Faltan hojas {missing_sheets}")
            return JSONResponse(
                status_code=400,
                content={
                    "error": "El archivo no corresponde a la etapa seleccionada.",
                    "missing": missing_sheets,
                    "details": f"Se requieren las hojas con nombres similares a: {', '.join(required_sheets)}. Encontradas: {', '.join(_available_sheets)}"
                }
            )

        _sheets_cache = {}
        _active_file_path = filepath
        _active_filename = file.filename
        _active_stage = stage

        sheets_for_front = _get_filtered_sheets(stage)
        
        if "Global" in sheets_for_front:
            try:
                print(f"Calentando caché para el rubro Global de la Etapa {stage}...")
                get_data("Global")
            except Exception as e:
                print(f"Aviso: No se pudo pre-calcular Global: {e}")
        
        print(f"Recarga exitosa. Hojas disponibles para el menú: {sheets_for_front}")
        return {"message": "Archivo cargado y procesado exitosamente", "filename": file.filename, "sheets": sheets_for_front}

    except Exception as e:
        print(f"ERROR en upload_file: {str(e)}")
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Error al procesar el archivo: {str(e)}")

@app.get("/api/health")
def health():
    return {"status": "ok", "message": "Backend activo v3 — Dataset Selector"}


# ============================================================
# NUEVA FUNCIONALIDAD: PROMEDIOS POR ENTIDAD Y CLUSTERING
# ============================================================

_entidades_df_cache = None
_entidades_filepath = os.path.join(DATASETS_DIR, "Analisis_entidad_promedio.xlsx")
_entidades_filename = "Analisis_entidad_promedio.xlsx"


def get_entidades_df():
    global _entidades_df_cache, _entidades_filepath
    if _entidades_df_cache is None:
        if os.path.exists(_entidades_filepath):
            _entidades_df_cache = analysis.load_entidad_promedio(_entidades_filepath)
        else:
            fallback_path = os.path.join(DATASETS_DIR, "Analisis_entidad_promedio.xlsx")
            if os.path.exists(fallback_path):
                _entidades_filepath = fallback_path
                _entidades_df_cache = analysis.load_entidad_promedio(fallback_path)
            else:
                raise FileNotFoundError("No se encuentra el archivo Analisis_entidad_promedio.xlsx")
    return _entidades_df_cache


@app.get("/api/entidades/data")
def get_entidades_data():
    try:
        df = get_entidades_df()
        df_clean = df.replace({np.nan: None})
        return {
            "filename": _entidades_filename,
            "data": df_clean.to_dict(orient="records")
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/api/entidades/upload")
async def upload_entidades_file(file: UploadFile = File(...)):
    global _entidades_df_cache, _entidades_filepath, _entidades_filename
    try:
        os.makedirs(DATASETS_DIR, exist_ok=True)
        filepath = os.path.join(DATASETS_DIR, "Analisis_entidad_promedio_custom.xlsx")
        contents = await file.read()
        if not contents:
            raise ValueError("El archivo está vacío")
            
        with open(filepath, "wb") as f:
            f.write(contents)
            
        # Validar
        df_validated = analysis.load_entidad_promedio(filepath)
        
        _entidades_filepath = filepath
        _entidades_filename = file.filename
        _entidades_df_cache = df_validated
        
        return {
            "message": "Archivo de promedios por entidad cargado y procesado exitosamente",
            "filename": file.filename
        }
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Error al procesar el archivo de entidades: {str(e)}")


@app.get("/api/entidades/clustering")
def get_entidades_clustering(stage: int = Query(1, ge=1, le=2), k: int = Query(3, ge=2, le=5)):
    try:
        df = get_entidades_df()
        profiles = analysis.compute_entidades_clustering(df, stage, k)
        return {"profiles": profiles, "stage": stage, "k": k}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/entidades/estado-distritos")
def get_estado_distritos(
    state: str = Query(...),
    sheet: str = Query(None),
    day: int = Query(None)
):
    try:
        target_sheet = sheet
        if not target_sheet:
            filtered = _get_filtered_sheets(_active_stage)
            target_sheet = filtered[1] if len(filtered) > 1 else (filtered[0] if filtered else None)
            
        df, matrix, day_cols = get_data(target_sheet, state)
        if matrix is None or matrix.shape[0] == 0:
            return {
                "state": state,
                "sheet": target_sheet,
                "total_districts": 0,
                "risk_districts": [],
                "risk_clusters": {
                    "muy_cerca": {"distritos": [], "promedio_deficit": 0.0},
                    "medio": {"distritos": [], "promedio_deficit": 0.0},
                    "muy_lejos": {"distritos": [], "promedio_deficit": 0.0}
                },
                "mean_by_day": [],
                "marginal_returns": [],
                "dias": []
            }
            
        n_districts, n_days = matrix.shape
        dias = list(range(1, n_days + 1))
        
        eval_day = day
        if not eval_day:
            general_reductor = analysis.compute_reductor(matrix, df=df, threshold=0.95, coverage=0.80)
            eval_day = general_reductor["recommended_day"]
            
        if eval_day < 1 or eval_day > n_days:
            eval_day = n_days
            
        threshold = 0.95
        eff_threshold = threshold - 0.0005
        
        col = matrix[:, eval_day - 1]
        district_labels = analysis.get_district_labels(df)
        
        muy_cerca_o_encima = []
        below_districts = []
        
        for idx in range(n_districts):
            val = col[idx]
            if val >= eff_threshold:
                muy_cerca_o_encima.append({
                    'distrito': district_labels[idx],
                    'cumplimiento': float(val),
                    'deficit': 0.0,
                    'status': 'Cumple o por encima'
                })
            else:
                below_districts.append({
                    'distrito': district_labels[idx],
                    'cumplimiento': float(val),
                    'deficit': float(threshold - val),
                })
                
        risk_clusters = {
            'muy_cerca': {'distritos': [], 'promedio_deficit': 0.0},
            'medio': {'distritos': [], 'promedio_deficit': 0.0},
            'muy_lejos': {'distritos': [], 'promedio_deficit': 0.0}
        }
        
        if len(below_districts) >= 3:
            deficits = np.array([d['deficit'] for d in below_districts]).reshape(-1, 1)
            kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
            labels = kmeans.fit_predict(deficits)
            centers = kmeans.cluster_centers_.flatten()
            sorted_indices = np.argsort(centers)
            mapping = {
                sorted_indices[0]: 'muy_cerca',
                sorted_indices[1]: 'medio',
                sorted_indices[2]: 'muy_lejos'
            }
            for i, d in enumerate(below_districts):
                cluster_name = mapping[labels[i]]
                risk_clusters[cluster_name]['distritos'].append(d)
        else:
            for d in below_districts:
                risk_clusters['muy_cerca']['distritos'].append(d)
                
        for key in risk_clusters:
            if len(risk_clusters[key]['distritos']) > 0:
                avg = np.mean([d['deficit'] for d in risk_clusters[key]['distritos']])
                risk_clusters[key]['promedio_deficit'] = float(avg)
                
        for d in muy_cerca_o_encima:
            risk_clusters['muy_cerca']['distritos'].append(d)
            
        for key in risk_clusters:
            risk_clusters[key]['distritos'].sort(key=lambda x: x['cumplimiento'])
            
        mean_by_day = matrix.mean(axis=0)
        marginal = np.diff(mean_by_day)
        marginal = np.insert(marginal, 0, 0.0)
        
        coverage_by_day = []
        for d in range(n_days):
            pct_above = float(np.mean(matrix[:, d] >= eff_threshold))
            coverage_by_day.append(pct_above)
            
        scenario_days = list(range(15, n_days + 1, 5))
        if n_days not in scenario_days and n_days >= 15:
            scenario_days.append(n_days)
        if eval_day not in scenario_days:
            scenario_days.append(eval_day)
        scenario_days.sort()
        
        scenarios = []
        for sd in scenario_days:
            s_idx = sd - 1
            s_col = matrix[:, s_idx]
            above_threshold = s_col >= eff_threshold
            at_100 = s_col >= 0.9995
            scenarios.append({
                'dia': sd,
                'media': float(s_col.mean()),
                'mediana': float(np.median(s_col)),
                'pct_above_threshold': float(np.mean(above_threshold) * 100),
                'count_above_threshold': int(np.sum(above_threshold)),
                'pct_at_100': float(np.mean(at_100) * 100),
                'count_at_100': int(np.sum(at_100)),
                'distritos_en_riesgo': int(np.sum((~above_threshold) & (~at_100))),
            })
            
        return {
            "state": state,
            "sheet": target_sheet,
            "eval_day": eval_day,
            "total_districts": n_districts,
            "risk_clusters": risk_clusters,
            "mean_by_day": mean_by_day.tolist(),
            "marginal_returns": marginal.tolist(),
            "coverage_by_day": coverage_by_day,
            "scenarios": scenarios,
            "dias": dias,
            "counts_by_day": [int(np.sum(matrix[:, d] >= eff_threshold)) for d in range(n_days)]
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# ============================================================
# ENDPOINT: Avance por Distrito entre PEC (día de cumplimiento al 100%)
# ============================================================

# Configuración de cada PEC: archivo, etapa, nombre clave, total de días
# y las hojas (variables) a extraer.
_AVANCE_PEC_CONFIG = [
    {
        "pec": "pec18",
        "total_dias": 56,
        "etapa": 1,
        "archivo": "PEC_2017-2018_1a.xlsx",
        "hojas": {
            "visitados": "Visitados",
            "ccrl": "CCRL Requeridos",
        },
    },
    {
        "pec": "pec18",
        "total_dias": 56,
        "etapa": 2,
        "archivo": "PEC_2017-2018_2a.xlsx",
        "hojas": {
            "nombramientos": "Nombramientos",
            "capacitacion": "Capacitación",
            "simulacros": "Asistencia a Simulacros",
        },
    },
    {
        "pec": "pec21",
        "total_dias": 48,
        "etapa": 1,
        "archivo": "PE_2020-2021_1a.xlsx",
        "hojas": {
            "visitados": "Visitados",
            "ccrl": "CCRL Optimo",
        },
    },
    {
        "pec": "pec21",
        "total_dias": 48,
        "etapa": 2,
        "archivo": "PE_2020-2021_2a.xlsx",
        "hojas": {
            "nombramientos": "Nombramientos",
            "capacitacion": "Capacitación",
            "simulacros": "Asistencia a Simulacros",
        },
    },
    {
        "pec": "pec24",
        "total_dias": 52,
        "etapa": 1,
        "archivo": "PEC_2023-2024_1a.xlsx",
        "hojas": {
            "visitados": "Visitados",
            "ccrl": "CCRL Optimo",
        },
    },
    {
        "pec": "pec24",
        "total_dias": 52,
        "etapa": 2,
        "archivo": "PEC_2023-2024_2a.xlsx",
        "hojas": {
            "nombramientos": "Nombramientos",
            "capacitacion": "Capacitación",
            "simulacros": "Asistencia a Simulacros",
        },
    },
]


def _parse_avance_sheet(ws, total_dias: int) -> list[dict]:
    """
    Lee una hoja de Excel con estructura:
      Fila 1: título (ignorar)
      Fila 2: encabezados (ID Entidad, Entidad, ID Distrito, Cabecera, fecha1, ..., fechaN)
      Fila 3: etiquetas de día (ignorar)
      Fila 4+: datos de distritos

    Devuelve una lista de dicts con id_entidad, entidad, id_distrito, cabecera, dia.
    'dia' = primer día (1-indexed) donde el valor >= 1.0, o total_dias si nunca ocurre.
    """
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) < 4:
        return []

    # La fila 2 (índice 1) tiene los encabezados; columnas 4+ son los días.
    # La fila 3 (índice 2) tiene etiquetas "Día 1", "Día 2"... — la ignoramos.
    # Los datos comienzan en fila 4 (índice 3).
    data_rows = rows[3:]  # fila 4 en adelante

    results = []
    for row in data_rows:
        if not row or row[0] is None:
            continue  # saltar filas vacías

        id_entidad = row[0]
        entidad = str(row[1]).strip() if row[1] is not None else ""
        id_distrito = row[2]
        cabecera = str(row[3]).strip() if row[3] is not None else ""

        # Columnas de días: índice 4 en adelante, hasta total_dias columnas.
        day_values = row[4: 4 + total_dias]

        dia_cumplimiento = total_dias  # valor por defecto: no alcanzó
        for col_idx, val in enumerate(day_values):
            try:
                numeric = float(val) if val is not None else 0.0
            except (TypeError, ValueError):
                numeric = 0.0
            if numeric >= 1.0:
                dia_cumplimiento = col_idx + 1  # 1-indexed
                break

        results.append({
            "id_entidad": int(id_entidad) if id_entidad is not None else None,
            "entidad": entidad,
            "id_distrito": int(id_distrito) if id_distrito is not None else None,
            "cabecera": cabecera,
            "dia": dia_cumplimiento,
            "completo": dia_cumplimiento < total_dias,
        })

    return results


@app.get("/api/avance-distritos")
async def get_avance_distritos():
    """
    Devuelve el día en que cada distrito alcanzó el 100% de cumplimiento
    para cada variable y PEC.

    Estructura de respuesta:
    {
      "pec18": { "etapa1": { "visitados": [...], "ccrl": [...] },
                 "etapa2": { "nombramientos": [...], "capacitacion": [...], "simulacros": [...] } },
      "pec21": { ... },
      "pec24": { ... },
    }
    """
    resultado = {
        "pec18": {"etapa1": {}, "etapa2": {}},
        "pec21": {"etapa1": {}, "etapa2": {}},
        "pec24": {"etapa1": {}, "etapa2": {}},
    }

    for cfg in _AVANCE_PEC_CONFIG:
        archivo_path = os.path.join(DATASETS_DIR, cfg["archivo"])
        etapa_key = f"etapa{cfg['etapa']}"

        if not os.path.exists(archivo_path):
            # Si el archivo no existe, registrar claves vacías y continuar.
            for var_key in cfg["hojas"]:
                resultado[cfg["pec"]][etapa_key][var_key] = []
            continue

        try:
            wb = openpyxl.load_workbook(archivo_path, read_only=True, data_only=True)
            for var_key, sheet_name in cfg["hojas"].items():
                if sheet_name not in wb.sheetnames:
                    resultado[cfg["pec"]][etapa_key][var_key] = []
                    continue
                ws = wb[sheet_name]
                resultado[cfg["pec"]][etapa_key][var_key] = _parse_avance_sheet(
                    ws, cfg["total_dias"]
                )
            wb.close()
        except Exception as exc:
            print(f"[avance-distritos] Error leyendo {cfg['archivo']}: {exc}")
            for var_key in cfg["hojas"]:
                resultado[cfg["pec"]][etapa_key][var_key] = []

    return JSONResponse(content=resultado)


@app.get("/api/campeche")
async def get_campeche_data():
    """
    Devuelve los datos de desempeño por sección para Campeche.
    """
    campeche_path = os.path.join(DATASETS_DIR, "Campeche_Desempeño_x_seccion.xlsx")
    if not os.path.exists(campeche_path):
        return JSONResponse(status_code=404, content={"error": "Archivo no encontrado"})

    try:
        wb = openpyxl.load_workbook(campeche_path, data_only=True)
        data = {}
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            rows = list(ws.iter_rows(values_only=True))
            if not rows:
                data[sheet_name] = []
                continue
            headers = [str(h).strip() if h is not None else '' for h in rows[0]]
            sheet_records = []
            for r in rows[1:]:
                if not r or r[0] is None:
                    continue
                row_dict = {}
                for h, val in zip(headers, r):
                    if isinstance(val, float):
                        row_dict[h] = round(val, 6)
                    else:
                        row_dict[h] = val
                sheet_records.append(row_dict)
            data[sheet_name] = sheet_records
        wb.close()
        return JSONResponse(content=data)
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})


@app.get("/api/recontrataciones/debug")
def debug_recontrataciones():
    """
    Endpoint de diagnóstico para comprobar la disponibilidad de datasets.
    """
    directory_exists = os.path.isdir(DATASETS_DIR)
    archivos = sorted(os.listdir(DATASETS_DIR)) if directory_exists else []

    return JSONResponse(content={
        "datasets_dir_configured": bool(os.environ.get("DATASETS_DIR")),
        "datasets_dir_exists": directory_exists,
        "xlsx_files": [f for f in archivos if f.lower().endswith(('.xlsx', '.xls', '.xlsm')) and not f.startswith('~$')]
    })


def _get_recontrataciones_files():
    import re
    from datetime import datetime

    if not os.path.isdir(DATASETS_DIR):
        return []

    files = []
    for filename in os.listdir(DATASETS_DIR):
        if filename.startswith("~$"):
            continue
        match = re.fullmatch(
            r"(\d{8})_recontrataciones_(.+)\.(xlsx|xlsm)",
            filename,
            flags=re.IGNORECASE,
        )
        if not match:
            continue
        if normalize_recontrataciones_estado(match.group(2)) == "concentrado":
            continue
        try:
            file_date = datetime.strptime(match.group(1), "%Y%m%d").date()
        except ValueError:
            continue
        filepath = os.path.join(DATASETS_DIR, filename)
        files.append((file_date, os.path.getmtime(filepath), filename, filepath, match.group(2)))
    return sorted(files, key=lambda item: (item[0], item[1], item[2]), reverse=True)


@app.get("/api/recontrataciones/estados")
def get_estados_con_recontrataciones():
    """Lista las entidades con un archivo de recontrataciones disponible."""
    estados = []
    estados_normalizados = set()
    for _, _, _, _, estado in _get_recontrataciones_files():
        estado_normalizado = normalize_recontrataciones_estado(estado)
        if estado_normalizado and estado_normalizado not in estados_normalizados:
            estados.append(estado)
            estados_normalizados.add(estado_normalizado)
    return JSONResponse(content={"estados": estados})


def normalize_recontrataciones_estado(text):
    import re
    import unicodedata

    nfkd = unicodedata.normalize("NFKD", str(text or ""))
    without_accents = "".join(c for c in nfkd if not unicodedata.combining(c)).casefold()
    normalized = re.sub(r"[^a-z0-9]", "", without_accents)
    if normalized in {"ciudaddemexico", "distritofederal"}:
        return "ciudaddemexico"
    return normalized


def _recontrataciones_row_key(row):
    if len(row) < 3 or row[1] is None or row[2] is None:
        return None

    entidad = normalize_recontrataciones_estado(row[1])
    if entidad.isdigit():
        entidad = entidad.zfill(2)
    if not entidad:
        return None
    distrito = str(row[2]).strip()
    if entidad == "entidad" or normalize_recontrataciones_estado(distrito) in {"distrito", "adosdigitos"}:
        return None
    if distrito.isdigit():
        return entidad, "distrito", distrito.zfill(2)

    cabecera = normalize_recontrataciones_estado(row[3]) if len(row) > 3 else ""
    if not entidad or not cabecera or cabecera == "cabecera":
        return None
    return entidad, "cabecera", cabecera


def _recontrataciones_header_columns(rows, header_row_idx, final_column):
    group_row = rows[header_row_idx]
    metric_row = rows[header_row_idx + 1] if header_row_idx + 1 < len(rows) else ()
    columns = {}
    current_group = ""
    metric_labels = {
        normalize_recontrataciones_estado(label)
        for label in (
            "Número de personas contactadas",
            "Número de personas interesadas",
            "Número de personas no interesadas",
            "Número de personas sin respuesta",
            "Número de personas entrevistadas",
        )
    }
    for column_idx in range(4, final_column + 1):
        group_label = (
            str(group_row[column_idx]).replace("\n", " ").strip()
            if column_idx < len(group_row) and group_row[column_idx]
            else ""
        )
        metric = metric_row[column_idx] if column_idx < len(metric_row) else None
        if group_label:
            current_group = group_label
        elif metric and normalize_recontrataciones_estado(str(metric)) not in metric_labels:
            current_group = str(metric).replace("\n", " ").strip()
        if not metric and group_label:
            metric = group_label
        if not metric and column_idx < len(group_row):
            metric = group_row[column_idx]
        if current_group and metric:
            columns[(
                normalize_recontrataciones_estado(current_group),
                normalize_recontrataciones_estado(str(metric).replace("\n", " ")),
            )] = column_idx
    return columns


def _get_recontrataciones_concentrado_template():
    import re
    from datetime import datetime

    candidates = []
    if not os.path.isdir(DATASETS_DIR):
        return None
    for filename in os.listdir(DATASETS_DIR):
        match = re.fullmatch(
            r"(\d{8})_recontrataciones_concentrado\.xlsx",
            filename,
            flags=re.IGNORECASE,
        )
        if not match:
            continue
        try:
            file_date = datetime.strptime(match.group(1), "%Y%m%d").date()
        except ValueError:
            continue
        candidates.append((file_date, os.path.join(DATASETS_DIR, filename)))
    return max(candidates, key=lambda item: item[0])[1] if candidates else None


def _get_recontrataciones_projections():
    template_path = _get_recontrataciones_concentrado_template()
    if not template_path:
        return False, {}

    workbook = openpyxl.load_workbook(template_path, data_only=True, read_only=True)
    try:
        worksheet = workbook.active
        max_column = min(max(worksheet.max_column, 1), 64)
        rows = list(worksheet.iter_rows(
            min_col=1,
            max_col=max_column,
            values_only=True,
        ))
    finally:
        workbook.close()

    header_row_idx = next(
        (
            idx for idx, row in enumerate(rows)
            if len(row) > 3
            and str(row[1] or "").strip().lower() == "entidad"
            and str(row[2] or "").strip().lower() == "distrito"
            and str(row[3] or "").strip().lower() == "cabecera"
        ),
        None,
    )
    if header_row_idx is None:
        return False, {}

    projection_column_idx = next(
        (
            column_idx
            for row in rows[header_row_idx:header_row_idx + 3]
            for column_idx, value in enumerate(row)
            if value
            and "proyeccion"
            in normalize_recontrataciones_estado(str(value).replace("\n", " "))
        ),
        None,
    )
    if projection_column_idx is None:
        return False, {}

    projections = {}
    for row in rows[header_row_idx + 3:]:
        key = _recontrataciones_row_key(row)
        if not key or key[1] != "distrito":
            continue
        value = row[projection_column_idx] if projection_column_idx < len(row) else None
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            projections[key] = value
    return True, projections


@app.get("/api/recontrataciones/exportar")
def exportar_recontrataciones_concentrado():
    from copy import copy
    from datetime import date

    if not os.path.isdir(DATASETS_DIR):
        return JSONResponse(status_code=500, content={"error": "Carpeta datasets no encontrada en el servidor."})

    template_path = _get_recontrataciones_concentrado_template()
    if not template_path:
        return JSONResponse(
            status_code=404,
            content={"error": "No se encontró la plantilla YYYYMMDD_recontrataciones_concentrado.xlsx en datasets."},
        )

    try:
        workbook = openpyxl.load_workbook(template_path)
        worksheet = workbook.active
        header_scan_rows = worksheet.iter_rows(
            min_col=1,
            max_col=4,
            values_only=True,
        )
        header_row_idx = next(
            (
                idx for idx, row in enumerate(header_scan_rows)
                if len(row) > 3
                and str(row[1] or "").strip().lower() == "entidad"
                and str(row[2] or "").strip().lower() == "distrito"
                and str(row[3] or "").strip().lower() == "cabecera"
            ),
            None,
        )
        if header_row_idx is None:
            workbook.close()
            return JSONResponse(
                status_code=422,
                content={"error": "La plantilla no contiene los encabezados Entidad, Distrito y Cabecera."},
            )

        header_scan_max_column = min(max(worksheet.max_column, 1), 64)
        header_rows = list(worksheet.iter_rows(
            min_row=header_row_idx + 1,
            max_row=header_row_idx + 3,
            min_col=1,
            max_col=header_scan_max_column,
            values_only=True,
        ))
        final_column = max(
            column_idx + 1
            for row in header_rows
            for column_idx, value in enumerate(row)
            if value is not None
        )
        template_rows = list(worksheet.iter_rows(
            min_col=1,
            max_col=final_column,
            values_only=True,
        ))
        template_columns = _recontrataciones_header_columns(
            template_rows, header_row_idx, final_column - 1
        )
        projection_metric = normalize_recontrataciones_estado("Proyección SE y CAE 2026 - 2027")
        projection_column_idx = next(
            (
                column_idx for (group, metric), column_idx in template_columns.items()
                if metric == projection_metric or group == projection_metric
            ),
            None,
        )
        target_rows = {}
        for row_idx in range(header_row_idx + 1, len(template_rows)):
            key = _recontrataciones_row_key(template_rows[row_idx])
            if key:
                target_rows[key] = row_idx + 1
                for column_idx in range(5, final_column + 1):
                    if column_idx - 1 != projection_column_idx:
                        worksheet.cell(row=row_idx + 1, column=column_idx).value = None

        total_metric = normalize_recontrataciones_estado("Total de personas contactadas")
        contacted_metric = normalize_recontrataciones_estado("Número de personas contactadas")
        total_column_idx = next(
            (
                column_idx for (group, metric), column_idx in template_columns.items()
                if group == total_metric and metric == total_metric
            ),
            None,
        )
        contacted_column_indices = [
            column_idx for (group, metric), column_idx in template_columns.items()
            if metric == contacted_metric and group != total_metric
        ]

        available_files = _get_recontrataciones_files()
        processed_states = set()
        for _, _, _, filepath, file_state in available_files:
            normalized_state = normalize_recontrataciones_estado(file_state)
            if normalized_state in processed_states:
                continue
            processed_states.add(normalized_state)

            source_workbook = openpyxl.load_workbook(filepath, data_only=True, read_only=True)
            try:
                source_rows = list(source_workbook.active.iter_rows(
                    min_col=1,
                    max_col=min(max(source_workbook.active.max_column, 1), 64),
                    values_only=True,
                ))
            finally:
                source_workbook.close()

            source_header_idx = next(
                (
                    idx for idx, row in enumerate(source_rows)
                    if len(row) > 3
                    and str(row[1] or "").strip().lower() == "entidad"
                    and str(row[2] or "").strip().lower() == "distrito"
                    and str(row[3] or "").strip().lower() == "cabecera"
                ),
                None,
            )
            if source_header_idx is None:
                raise ValueError(f"{os.path.basename(filepath)} no contiene los encabezados esperados.")

            source_columns = _recontrataciones_header_columns(
                source_rows, source_header_idx, min(max(len(row) for row in source_rows), 64) - 1
            )
            matching_columns = [
                (target_idx, source_columns[column_key])
                for column_key, target_idx in template_columns.items()
                if column_key in source_columns and target_idx != projection_column_idx
            ]

            for source_row in source_rows[source_header_idx + 1:]:
                key = _recontrataciones_row_key(source_row)
                if key not in target_rows:
                    continue
                target_row_idx = target_rows[key]
                for target_column_idx, source_column_idx in matching_columns:
                    value = source_row[source_column_idx] if source_column_idx < len(source_row) else None
                    worksheet.cell(row=target_row_idx, column=target_column_idx + 1).value = value
                if total_column_idx is not None:
                    total_cell = worksheet.cell(row=target_row_idx, column=total_column_idx + 1)
                    if total_cell.value is None:
                        contacted_values = [
                            worksheet.cell(row=target_row_idx, column=column_idx + 1).value
                            for column_idx in contacted_column_indices
                        ]
                        total_cell.value = sum(
                            value for value in contacted_values
                            if isinstance(value, (int, float)) and not isinstance(value, bool)
                        )

        for row_idx in target_rows.values():
            for column_idx in range(2, final_column + 1):
                cell = worksheet.cell(row=row_idx, column=column_idx)
                font = copy(cell.font)
                font.color = "FF000000"
                cell.font = font

        output = io.BytesIO()
        workbook.save(output)
        workbook.close()
        output.seek(0)
        filename = f"{date.today():%Y%m%d}_recontrataciones_concentrado.xlsx"
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": f"No fue posible generar el concentrado: {exc}"})


@app.get("/api/recontrataciones/{estado}")
def get_recontrataciones_estado(estado: str):
    """
    Obtiene los datos del dataset de recontrataciones para un estado dado.
    Identifica el estado a partir de la última palabra del nombre del archivo Excel antes de la extensión.
    Ejemplo: 20261020_recontrataciones_aguascalientes.xlsx -> aguascalientes
    Usa el directorio de datasets configurado y compara nombres sin distinguir acentos o mayúsculas.
    """
    target_norm = normalize_recontrataciones_estado(estado)

    target_dir = DATASETS_DIR
    if not os.path.isdir(target_dir):
        return JSONResponse(status_code=500, content={"error": "Carpeta datasets no encontrada en el servidor"})

    available_files = _get_recontrataciones_files()
    matching_file = next(
        (filepath for _, _, _, filepath, file_state in available_files
         if normalize_recontrataciones_estado(file_state) == target_norm),
        None,
    )

    if not matching_file or not os.path.exists(matching_file):
        return JSONResponse(
            status_code=404,
            content={
                "error": f"Dataset de recontrataciones no encontrado para {estado}",
                "carpeta_explorada": target_dir,
                "archivos_encontrados": [filename for _, _, filename, _, _ in available_files]
            }
        )

    try:
        wb = openpyxl.load_workbook(matching_file, data_only=True, read_only=True)
        ws = wb.active
        all_rows = list(ws.iter_rows(
            min_col=1,
            max_col=min(max(ws.max_column, 1), 64),
            values_only=True,
        ))
        wb.close()

        header_row_idx = next(
            (
                idx
                for idx, row in enumerate(all_rows)
                if len(row) > 3
                and str(row[1] or "").strip().lower() == "entidad"
                and str(row[2] or "").strip().lower() == "distrito"
                and str(row[3] or "").strip().lower() == "cabecera"
            ),
            None,
        )
        if header_row_idx is None:
            return JSONResponse(
                status_code=422,
                content={"error": "El archivo no contiene los encabezados esperados de recontrataciones."},
            )

        group_row = all_rows[header_row_idx]
        metric_row = all_rows[header_row_idx + 1] if header_row_idx + 1 < len(all_rows) else ()
        process_specs = [
            ("pec_2023_2024", "Proceso Electoral Concurrente 2023-2024"),
            (
                "pe_judicial_2024_2025",
                "Proceso Electoral Extraordinario para la elección de diversos cargos del Poder Judicial de la Federación 2024-2025",
            ),
            (
                "pel_2024_2026",
                "Proceso Electoral Local 2024-2025 Durango y Veracruz / Proceso Electoral Local 2025-2026 Coahuila",
            ),
        ]
        metric_keys = {
            "número de personas contactadas": "personas_contactadas",
            "número de personas interesadas": "personas_interesadas",
            "número de personas no interesadas": "personas_no_interesadas",
            "número de personas sin respuesta": "personas_sin_respuesta",
            "número de personas entrevistadas": "personas_entrevistadas",
        }
        process_starts = []
        for process_id, process_label in process_specs:
            process_prefix = normalize_recontrataciones_estado(process_label.split(" / ", 1)[0])
            start = next(
                (
                idx
                for idx in range(4, len(group_row))
                if process_prefix
                in normalize_recontrataciones_estado(str(group_row[idx] or "").replace("\n", " "))
                ),
                None,
            )
            if start is not None:
                process_starts.append((process_id, start))

        total_column_idx = next(
            (
                idx
                for idx in range(4, len(group_row))
                if "totaldepersonascontactadas"
                in normalize_recontrataciones_estado(str(group_row[idx] or ""))
            ),
            len(group_row),
        )
        process_columns = {
            process_id: list(range(start, (
                process_starts[index + 1][1]
                if index + 1 < len(process_starts)
                else total_column_idx
            )))
            for index, (process_id, start) in enumerate(process_starts)
        }

        if len(process_columns) != len(process_specs):
            return JSONResponse(
                status_code=422,
                content={"error": "El archivo no contiene los tres bloques de procesos electorales esperados."},
            )

        def cell_value(row, index):
            value = row[index] if index < len(row) else None
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                return value
            if value is None or str(value).strip() == "":
                return 0
            return str(value).strip()

        def sum_values(values):
            numeric_values = [
                value for value in values
                if isinstance(value, (int, float)) and not isinstance(value, bool)
            ]
            if numeric_values:
                return sum(numeric_values)
            nonempty = [str(value).strip() for value in values if value is not None and str(value).strip()]
            return nonempty[0] if nonempty and all(value.lower() == "no aplica" for value in nonempty) else 0

        process_labels = {
            process_id: process_label for process_id, process_label in process_specs
        }
        projection_available, projections = _get_recontrataciones_projections()
        distritos = []

        for row_idx in range(header_row_idx + 1, len(all_rows)):
            r = all_rows[row_idx]
            if len(r) < 4 or r[1] is None or r[2] is None or r[3] is None:
                continue

            distrito = str(r[2]).strip()
            if not distrito.isdigit():
                continue

            procesos = {}
            for process_id, columns in process_columns.items():
                metrics = {}
                for column_idx in columns:
                    metric_label = str(metric_row[column_idx] or "").replace("\n", " ").strip().lower()
                    metric_key = metric_keys.get(metric_label)
                    if metric_key:
                        metrics[metric_key] = cell_value(r, column_idx)
                procesos[process_id] = metrics

            contactados = [
                proceso.get("personas_contactadas", 0)
                for proceso in procesos.values()
            ]
            global_metrics = {
                metric_key: sum_values(
                    [proceso.get(metric_key, 0) for proceso in procesos.values()]
                )
                for metric_key in metric_keys.values()
            }
            observaciones = str(r[20]).strip() if len(r) > 20 and r[20] is not None else ""
            projection_key = _recontrataciones_row_key(r)
            distritos.append({
                "entidad": str(r[1]).strip(),
                "distrito": distrito,
                "cabecera": str(r[3]).strip(),
                "procesos": procesos,
                "global": global_metrics,
                "total_personas_contactadas": sum_values(contactados),
                "proyeccion_personas_contactar": projections.get(projection_key),
                "observaciones": observaciones,
            })

        if not distritos:
            return JSONResponse(
                status_code=422,
                content={"error": "El archivo no contiene filas de distritos válidas."},
            )

        totales_procesos = {}
        for process_id in process_columns:
            totales_procesos[process_id] = {
                metric_key: sum_values(
                    [dist["procesos"][process_id].get(metric_key, 0) for dist in distritos]
                )
                for metric_key in metric_keys.values()
            }

        totales_globales = {
            metric_key: sum_values(
                [dist["global"].get(metric_key, 0) for dist in distritos]
            )
            for metric_key in metric_keys.values()
        }
        observaciones_jle = []
        for dist in distritos:
            if dist["observaciones"] and dist["observaciones"].lower() != "no aplica":
                observaciones_jle.append(f"Distrito {dist['distrito']}: {dist['observaciones']}")

        return JSONResponse(content={
            "procesos": process_labels,
            "totales": {
                "procesos": totales_procesos,
                "global": totales_globales,
                "total_personas_contactadas": totales_globales["personas_contactadas"],
                "proyeccion_personas_contactar": (
                    sum(
                        dist["proyeccion_personas_contactar"]
                        for dist in distritos
                        if isinstance(dist["proyeccion_personas_contactar"], (int, float))
                        and not isinstance(dist["proyeccion_personas_contactar"], bool)
                    )
                    if projection_available
                    else None
                ),
                "observaciones": " ".join(observaciones_jle),
            },
            "distritos": distritos,
            "proyeccion_disponible": projection_available,
            "archivo": os.path.basename(matching_file)
        })
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})





if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
