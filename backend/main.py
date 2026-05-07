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


def _get_filepath():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for name in ["cumplimiento_visitas_custom.xlsx",
                  "cumplimiento_completo_v1_poblado.xlsx",
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

    if sheet not in _sheets_cache:
        fp = _get_filepath()
        df = analysis.load_data(fp, sheet_name=sheet)
        matrix, day_cols = analysis.get_data_matrix(df)
        _sheets_cache[sheet] = (df, matrix, day_cols)

    df, matrix, day_cols = _sheets_cache[sheet]

    # Filtrar por estado si se solicita
    if state:
        df, matrix, day_cols = analysis.filter_by_state(df, state)

    return df, matrix, day_cols


@app.get("/api/sheets")
def get_sheets():
    """Retorna la lista de hojas disponibles en el Excel."""
    _ensure_sheets()
    return {"sheets": _available_sheets}


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


@app.get("/api/clusters")
def get_clusters(k: int = Query(None, ge=2, le=10), sheet: str = Query(None), state: str = Query(None)):
    """Ejecuta K-Means clustering."""
    df, matrix, _ = get_data(sheet, state)
    return analysis.compute_clusters(matrix, df=df, k=k)


@app.get("/api/reductor")
def get_reductor(
    threshold: float = Query(0.90, ge=0.0, le=1.0),
    coverage: float = Query(0.80, ge=0.0, le=1.0),
    manual_day: int = Query(None, ge=1, le=56),
    sheet: str = Query(None),
    state: str = Query(None)
):
    """Analisis de punto optimo para reduccion de dias."""
    df, matrix, _ = get_data(sheet, state)
    return analysis.compute_reductor(matrix, df=df, threshold=threshold, coverage=coverage, manual_day=manual_day)


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
    global _sheets_cache, _available_sheets
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
