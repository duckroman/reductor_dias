"""
main.py - FastAPI backend para el analisis de cumplimiento de visitas del INE.
Sirve endpoints REST que el frontend React consume.
Soporta multiples hojas de Excel y filtrado por entidad federativa.
Soporta seleccion de datasets predefinidos por etapa operativa.
"""

from fastapi import FastAPI, Query, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import analysis
import os

app = FastAPI(title="Reductor de Dias - INE", version="3.0.0")

# CORS para desarrollo local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# CONSTANTES: Datasets por Etapa
# ============================================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASETS_DIR = os.path.join(BASE_DIR, "datasets")

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
        filepath = os.path.join(BASE_DIR, "cumplimiento_visitas_custom.xlsx")
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
