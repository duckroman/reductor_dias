"""
main.py - FastAPI backend para el analisis de cumplimiento de visitas del INE.
Sirve endpoints REST que el frontend React consume.
Soporta multiples hojas de Excel y filtrado por entidad federativa.
"""

from fastapi import FastAPI, Query, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import analysis
import os

app = FastAPI(title="Reductor de Dias - INE", version="2.0.0")

# CORS para desarrollo local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache multi-hoja: { sheet_name: (df, matrix, day_cols) }
_sheets_cache = {}
_available_sheets = []
_active_filename = None # Para rastrear el nombre real del archivo cargado


def _get_filepath():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for name in ["cumplimiento_visitas_custom.xlsx",
                  "PEC_2023-2024.xlsx",
                  "cumplimiento_visitas_nuevo.xlsx",
                  "cumplimiento_visitas.xlsx"]:
        p = os.path.join(base, name)
        if os.path.exists(p):
            return p
    return None


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
            matrices = []
            base_df = None
            day_cols = None
            for s in _available_sheets:
                if s == "Global": continue
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


@app.get("/api/sheets")
def get_sheets():
    """Retorna la lista de hojas disponibles en el Excel."""
    _ensure_sheets()
    sheets_list = ["Global"] + _available_sheets if _available_sheets else []
    return {"sheets": sheets_list}


@app.get("/api/active-file")
def get_active_file():
    """Retorna el nombre del archivo Excel que está siendo utilizado."""
    global _active_filename
    if _active_filename:
        return {"filename": _active_filename}
    
    fp = _get_filepath()
    if fp:
        return {"filename": os.path.basename(fp)}
    return {"filename": None, "error": "No se encontró ningún archivo de datos"}


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
        
        # Aprovechar la cache si existe
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
async def upload_file(file: UploadFile = File(...)):
    """Sube un archivo de Excel para reemplazar los datos de analisis."""
    global _sheets_cache, _available_sheets, _active_filename
    try:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        filepath = os.path.join(base, "cumplimiento_visitas_custom.xlsx")
        print(f"--- Recibiendo archivo: {file.filename} ---")

        contents = await file.read()
        if not contents:
            raise ValueError("El archivo está vacío")

        with open(filepath, "wb") as f:
            f.write(contents)

        print(f"Archivo guardado en: {filepath}. Limpiando caché...")

        # Limpiar cache completo y recargar hojas
        _sheets_cache = {}
        _available_sheets = analysis.get_sheet_names(filepath)
        _active_filename = file.filename

        print(f"Recarga exitosa. Hojas disponibles: {_available_sheets}")
        return {"message": "Archivo cargado y procesado exitosamente", "filename": file.filename, "sheets": _available_sheets}

    except Exception as e:
        print(f"ERROR en upload_file: {str(e)}")
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Error al procesar el archivo: {str(e)}")

@app.get("/api/health")
def health():
    return {"status": "ok", "message": "Backend activo v2"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
