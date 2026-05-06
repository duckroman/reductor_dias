"""
main.py - FastAPI backend para el analisis de cumplimiento de visitas del INE.
Sirve endpoints REST que el frontend React consume.
"""

from fastapi import FastAPI, Query, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import analysis
import shutil
import os

app = FastAPI(title="Reductor de Dias - INE", version="1.0.0")

# CORS para desarrollo local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cargar datos una vez al inicio
_df = None
_matrix = None
_day_cols = None


def get_data():
    global _df, _matrix, _day_cols
    if _df is None:
        _df = analysis.load_data()
        _matrix, _day_cols = analysis.get_data_matrix(_df)
    return _df, _matrix, _day_cols


@app.get("/api/data")
def get_full_data():
    """Retorna datos completos (300 distritos x 50 dias)."""
    df, matrix, _ = get_data()
    return analysis.compute_full_data(df, matrix)


@app.get("/api/stats")
def get_stats():
    """Retorna estadisticos descriptivos por dia."""
    _, matrix, _ = get_data()
    return analysis.compute_summary_stats(matrix)


@app.get("/api/distributions/{day}")
def get_distributions(day: int):
    """Ajusta distribuciones teoricas para un dia especifico."""
    _, matrix, _ = get_data()
    if day < 1 or day > matrix.shape[1]:
        return {"error": f"Dia debe estar entre 1 y {matrix.shape[1]}"}
    return analysis.fit_distributions(matrix, day)


@app.get("/api/correlation")
def get_correlation():
    """Retorna la matriz de correlacion temporal."""
    _, matrix, _ = get_data()
    return analysis.compute_correlation(matrix)


@app.get("/api/boxplot")
def get_boxplot():
    """Datos para box plots temporales."""
    _, matrix, _ = get_data()
    return analysis.compute_boxplot_data(matrix)


@app.get("/api/clusters")
def get_clusters(k: int = Query(None, ge=2, le=10)):
    """Ejecuta K-Means clustering con seleccion manual o automatica de K."""
    _, matrix, _ = get_data()
    return analysis.compute_clusters(matrix, k=k)


@app.get("/api/reductor")
def get_reductor(
    threshold: float = Query(0.90, ge=0.0, le=1.0),
    coverage: float = Query(0.80, ge=0.0, le=1.0),
    manual_day: int = Query(None, ge=1, le=50)
):
    """Analisis de punto optimo para reduccion de dias."""
    _, matrix, _ = get_data()
    return analysis.compute_reductor(matrix, threshold=threshold, coverage=coverage, manual_day=manual_day)


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Sube un archivo de Excel para reemplazar los datos de analisis."""
    global _df, _matrix, _day_cols
    try:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        filepath = os.path.join(base, "cumplimiento_visitas_custom.xlsx")
        print(f"--- Recibiendo archivo: {file.filename} ---")
        
        contents = await file.read()
        if not contents:
            raise ValueError("El archivo está vacío")
            
        with open(filepath, "wb") as f:
            f.write(contents)
        
        print(f"Archivo guardado en: {filepath}. Iniciando recarga de datos...")
        
        # Intentar cargar para validar formato
        new_df = analysis.load_data(filepath)
        new_matrix, new_day_cols = analysis.get_data_matrix(new_df)
        
        # Si todo bien, actualizar globales
        _df = new_df
        _matrix = new_matrix
        _day_cols = new_day_cols
        
        print(f"Recarga exitosa: {len(_df)} distritos, {len(_day_cols)} días.")
        return {"message": "Archivo cargado y procesado exitosamente", "filename": file.filename}
        
    except Exception as e:
        print(f"ERROR en upload_file: {str(e)}")
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Error al procesar el archivo: {str(e)}")

@app.get("/api/health")
def health():
    return {"status": "ok", "message": "Backend activo"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
