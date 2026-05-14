# CONTEXTO DEL PROYECTO — Reductor de Días (INE)

> **Propósito**: Este archivo permite que cualquier agente AI retome el proyecto donde se dejó.
> **Última actualización**: 2026-05-14T15:15 CST

## Reglas de Negocio Específicas

### 1. Estructura Multi-Etapa con Selección de Datasets
El sistema se divide en dos fases operativas distintas, seleccionables desde el inicio:
*   **Etapa 1 (Visitas y Notificaciones)**: Analiza los rubros *Visitas*, *Notificaciones* y *Ciudadanos CR*. El cálculo **Global** promedia estos tres indicadores.
*   **Etapa 2 (Nombramientos y Capacitación)**: Analiza los rubros *Nombramientos*, *Capacitación* y *Asistencia a Simulacros*. El cálculo **Global** promedia estos tres indicadores.
*   **Sustituciones de FMDC**: Rubro especializado de la Etapa 2, estrictamente excluido de cálculos globales y del menú principal; accesible vía `/sustituciones`.

### 1b. Datasets Predefinidos por Etapa
Cada etapa tiene datasets predefinidos almacenados en `datasets/`. El flujo de selección es: **Etapa → Dataset → Análisis**.

| Etapa | Dataset |
|-------|--------|
| 1 | `PE_2020-2021_1a.xlsx`, `PEC_2023-2024_1a.xlsx` |
| 2 | `PE_2020-2021_2a.xlsx`, `PEC_2023-2024_2a.xlsx`, `PEL_2022-2023_Coahuila.xlsx` |

**Reglas críticas**:
*   Al cambiar de dataset o etapa, se limpia toda la caché del backend.
*   El sistema adapta automáticamente la cantidad de días y distritos al dataset seleccionado.
*   Solo se muestran y calculan datos del dataset activo.
*   Al refrescar la página, se vuelve a la pantalla de selección.

### 2. Estándar de Comunicación
*   Toda la interfaz debe utilizar lenguaje **impersonal y profesional** (ej. "se observa", "se evalúa") para garantizar un tono ejecutivo y neutro.

---

## 🎯 Objetivo del Proyecto

Analizar el cumplimiento de visitas a ciudadanos en **300 distritos electorales del INE** a lo largo de **50 días**. El objetivo principal es determinar **a cuántos días se puede reducir el periodo de visitas** asegurando el mayor cumplimiento posible.

## 📋 Decisiones del Usuario

1. **Datos existentes**: Se pueden reemplazar completamente (Día 1 y Día 2 originales)
2. **Distritos**: Se mantienen como números 1–300 (sin nombres)
3. **Framework**: React (Vite) para frontend + FastAPI (Python) para backend
4. **Entorno**: Conda, nombre `dataINE`
5. **Desarrollo**: Por etapas, con archivo de contexto para continuidad

## 🏗️ Arquitectura

```
reductor_dias/
├── datasets/                       # Datasets predefinidos por etapa
│   ├── PE_2020-2021_1a.xlsx        # Etapa 1
│   ├── PEC_2023-2024_1a.xlsx       # Etapa 1
│   ├── PE_2020-2021_2a.xlsx        # Etapa 2
│   ├── PEC_2023-2024_2a.xlsx       # Etapa 2
│   └── PEL_2022-2023_Coahuila.xlsx # Etapa 2
├── generar_datos.py                # Script generador de datos sintéticos
├── CONTEXTO_PROYECTO.md            # ESTE ARCHIVO
├── backend/
│   ├── main.py                     # FastAPI — endpoints REST (puerto 8000)
│   ├── analysis.py                 # Lógica: estadísticas, clustering, reductor
│   └── requirements.txt            # Dependencias Python
└── frontend/
    ├── package.json
    ├── vite.config.js              # Proxy a backend:8000
    ├── index.html
    └── src/
        ├── App.jsx                 # Layout: Selección Etapa→Dataset→Dashboard
        ├── App.css                 # Estilos premium (dark theme, glassmorphism)
        ├── components/
        │   ├── Dashboard.jsx       # Tab 1: KPIs, heatmap, curvas
        │   ├── Statistical.jsx     # Tab 2: Distribuciones, box plots, correlación
        │   ├── Clustering.jsx      # Tab 3: K-Means, PCA, silueta
        │   ├── Reductor.jsx        # Tab 4: Punto óptimo, escenarios, riesgo
        │   ├── DatasetViewer.jsx   # Visor de datos crudos con tabla premium
        │   └── SustitucionesPage.jsx # Página especial para el rubro Sustituciones
        └── services/
            └── api.js              # Fetch helpers para el backend
```

## 📊 Datos Sintéticos (generar_datos.py)

- **Modelo**: Curva logística (S-curve) por distrito
- **Parámetros aleatorios por distrito**:
  - `L` (asíntota): 0.75–1.0
  - `k` (velocidad): 0.05–0.20
  - `x0` (punto medio): 15–35
  - Ruido gaussiano: ±1-3%
- **Restricciones**: Valores entre 0 y 1, monótonamente crecientes
- El Excel se sobreescribe completo con los nuevos datos

## 🔌 API Endpoints (backend/main.py)

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/data` | GET | Datos completos (300×50 matrix) |
| `/api/data/summary` | GET | Resumen: media, mediana, std por día |
| `/api/stats` | GET | Estadísticos descriptivos completos |
| `/api/distributions/{day}` | GET | Ajuste de distribuciones para un día |
| `/api/clusters` | GET | Resultado de K-Means + PCA |
| `/api/reductor` | GET | Análisis de punto óptimo (knee point) |
| `/api/scenarios` | GET | Comparación de escenarios de corte |

## 🖥️ Frontend (React + Vite)

### Tab 1: Dashboard General
- KPIs cards (cumplimiento promedio, distritos >90%, mediana, desviación)
- Heatmap de cumplimiento (distritos × días)
- Gráfico de líneas (curvas de los 300 distritos, seleccionables)
- Histograma/violin del cumplimiento en un día seleccionable

### Tab 2: Análisis Estadístico
- Ajuste de distribuciones (Normal, Beta, Log-Normal) con test K-S
- Estadísticos descriptivos (media, mediana, varianza, asimetría, curtosis)
- Correlación temporal entre días
- Box plots temporales

### Tab 3: Clustering de Distritos
- K-Means con selección automática de K (método del codo + Silhouette)
- Visualización PCA 2D
- Curvas promedio por cluster
- Tabla de distritos por cluster

### Tab 4: 🎯 Reductor de Días
- Gráfico de rendimiento marginal (Δ cumplimiento / Δ día)
- Curva de cumplimiento promedio con líneas de umbral
- Slider interactivo: % mínimo de cumplimiento aceptable
- Slider: % mínimo de distritos que deben cumplir
- Día óptimo recomendado (Kneedle algorithm)
- Análisis de riesgo: distritos que no alcanzan el umbral
- Tabla de simulación de escenarios (día 20, 25, 30, 35, 40)

## 📦 Dependencias

### Python (conda env: dataINE)
```
python=3.11, fastapi, uvicorn, pandas, numpy, scipy, scikit-learn, openpyxl, kneed
```

### Node.js (frontend)
```
react, react-dom, recharts, plotly.js, react-plotly.js, axios, lucide-react
```

## 🚦 Estado de Progreso

| Etapa | Estado | Descripción |
|---|---|---|
| Etapa 1 | ✅ COMPLETADO | Datos sintéticos generados (`cumplimiento_visitas_nuevo.xlsx`) |
| Etapa 2 | ✅ COMPLETADO | Backend FastAPI (manejo de floats NaN corregido) |
| Etapa 3 | ✅ COMPLETADO | Frontend React + Vite con estilos UI premium (Downgrade a React 18 para compatibilidad con librerías de gráficos) |
| Etapa 4 | ✅ COMPLETADO | Integración frontend-backend funcionando en puertos 5173 y 8000 |
| Etapa 5 | ✅ COMPLETADO | UI Simplificada con explicaciones para usuarios no técnicos y corrección de Boxplot |
| Etapa 6 | ✅ COMPLETADO | Reductor de Días permite control y sobreescritura manual del día óptimo |
| Etapa 7 | ✅ COMPLETADO | Capacidad de cargar archivos Excel (`.xlsx`) desde la UI para recálculo global |
| Etapa 8 | ✅ COMPLETADO | Optimización de lógica de reducción (bias Día 1 corregido), interfaz dinámica con ajuste manual y explicaciones técnicas enriquecidas |
| Etapa 9 | ✅ COMPLETADO | Clustering manual (2-10), razonamiento dinámico de recomendación, corrección de errores en estadísticas y lista expandible de riesgo |
| Etapa 10 | ✅ COMPLETADO | Soporte multi-hoja (4 rubros), sidebar de navegación, mapa interactivo de México por entidad, filtro estatal en todos los paneles |
| Etapa 11 | ✅ COMPLETADO | Cálculo Global multi-rubro, panel de distritos rezagados y alertas tempranas (flatlines), comparativa de rubros, contexto PCA y exportación PDF |
| Etapa 12 | ✅ COMPLETADO | Arquitectura multi-etapa: Selección inicial de fase (Etapa 1 vs Etapa 2), filtrado dinámico de rubros y unificación de lógica de procesamiento Global. |
| Etapa 13 | ✅ COMPLETADO | Sistema de selección de datasets predefinidos por etapa. Visor de datos crudos con tabla premium (headers púrpura, columnas fijas). Limpieza de caché al cambiar etapa/dataset. Adaptación dinámica de días y distritos por dataset. |
| Etapa 14 | ✅ COMPLETADO | Optimización UI/UX del Visor: Tabla responsiva 100% full-width con scroll horizontal dinámico. Lógica avanzada de filtros tipo Excel (Todo/Ninguno) con corrección de z-index (superposición de capas) y prevención de colapso vertical en búsquedas vacías. |

## 🚀 Cómo Ejecutar

```bash
# 1. Activar entorno
conda activate dataINE

# 2. Generar datos (solo primera vez)
python generar_datos.py

# 3. Iniciar backend
cd backend && uvicorn main:app --reload --port 8000

# 4. Iniciar frontend (en otra terminal)
cd frontend && npm run dev
```

## ⚠️ Notas Importantes

- El backend usa CORS habilitado para `localhost:5173` (Vite dev server)
- El frontend tiene proxy configurado en `vite.config.js` hacia `localhost:8000`
- Los datos del Excel se leen bajo demanda y se cachean en memoria; la caché se limpia al cambiar de dataset o etapa
- El Kneedle algorithm se usa para encontrar el "knee point" en la curva de rendimiento marginal
- **No se cargan datos al arrancar**: El usuario debe seleccionar etapa y dataset primero
- Los datasets predefinidos se leen directamente de la carpeta `datasets/` sin necesidad de upload
- Cada dataset puede tener diferente número de días y distritos; el sistema se adapta automáticamente
