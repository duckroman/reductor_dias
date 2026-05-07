# CONTEXTO DEL PROYECTO — Reductor de Días (INE)

> **Propósito**: Este archivo permite que cualquier agente AI retome el proyecto donde se dejó.
> **Última actualización**: 2026-05-06T16:55 CST

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
├── cumplimiento_visitas.xlsx       # Datos: 300 distritos × 50 días (porcentajes 0-1)
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
        ├── App.jsx                 # Layout principal con 4 tabs
        ├── App.css                 # Estilos premium (dark theme, glassmorphism)
        ├── components/
        │   ├── Dashboard.jsx       # Tab 1: KPIs, heatmap, curvas
        │   ├── Statistical.jsx     # Tab 2: Distribuciones, box plots, correlación
        │   ├── Clustering.jsx      # Tab 3: K-Means, PCA, silueta
        │   └── Reductor.jsx        # Tab 4: Punto óptimo, escenarios, riesgo
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
- Los datos del Excel se leen una vez al arrancar el backend y se cachean en memoria
- El Kneedle algorithm se usa para encontrar el "knee point" en la curva de rendimiento marginal
