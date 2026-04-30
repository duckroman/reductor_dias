# 🎯 Reductor de Días (INE) - Análisis de Cumplimiento de Visitas

Esta aplicación es una herramienta interactiva de análisis de datos para el INE. Su propósito principal es analizar las curvas de cumplimiento de 300 distritos electorales a lo largo de 50 días y utilizar algoritmos para **encontrar el día óptimo para reducir el periodo de visitas**, asegurando el mayor nivel de cumplimiento posible.

El proyecto consta de una API desarrollada en **FastAPI** (Backend) y una interfaz de usuario creada en **React + Vite** (Frontend).

---

## 🛠️ Requisitos Previos

Para colaborar y ejecutar el proyecto localmente, necesitas tener instalados:

1. **[Miniconda](https://docs.conda.io/en/latest/miniconda.html)** o **Anaconda** (para gestionar el entorno de Python y dependencias).
2. **[Node.js](https://nodejs.org/)** (v18 o superior) y **npm**.
3. **[Git](https://git-scm.com/)** para el control de versiones.

---

## 🚀 Instalación y Despliegue Local

Sigue estos pasos para clonar y ejecutar el entorno de desarrollo en tu máquina local:

### 1. Clonar el repositorio
Si el proyecto se encuentra en un repositorio Git, clónalo usando:
```bash
git clone <URL_DEL_REPOSITORIO>
cd reductor_dias
```

### 2. Configurar el Backend (Python)
El backend utiliza FastAPI y diversas librerías de análisis de datos (Pandas, Scikit-learn, Kneed). 

Crea y activa el entorno virtual usando Conda:
```bash
# Crear el entorno con Python 3.11
conda create -n dataINE python=3.11 -y

# Activar el entorno
conda activate dataINE

# Instalar las dependencias de Python
pip install fastapi uvicorn pandas numpy scipy scikit-learn kneed openpyxl
```

*(Opcional)* Si necesitas volver a generar los datos sintéticos de cumplimiento:
```bash
python generar_datos.py
```

### 3. Configurar el Frontend (React)
El frontend está construido con React 18, Vite y componentes gráficos como Recharts y Plotly.

Abre una **nueva pestaña** de la terminal y navega a la carpeta frontend:
```bash
cd frontend

# Instalar las dependencias de Node
npm install
```

---

## 💻 Ejecución del Proyecto

Para trabajar localmente, necesitarás tener tanto el backend como el frontend corriendo al mismo tiempo.

### Iniciar el Servidor Backend (API)
En la terminal donde tienes activado tu entorno `dataINE`, ejecuta:
```bash
cd backend
uvicorn main:app --reload
```
> El servidor estará disponible en **http://localhost:8000**. (La documentación automática de la API se encuentra en http://localhost:8000/docs).

### Iniciar el Servidor Frontend
En la terminal del frontend, ejecuta:
```bash
npm run dev
```
> La interfaz de usuario estará disponible en **http://localhost:5173**. 

Cualquier cambio que realices en el código del backend (`.py`) o frontend (`.jsx`, `.css`) se recargará automáticamente en el navegador gracias al "Hot Reloading".

---

## 📁 Estructura del Proyecto

```text
reductor_dias/
├── backend/                  # Servidor API
│   ├── main.py               # Endpoints de FastAPI
│   └── analysis.py           # Lógica estadística y modelos (Kneedle, KMeans)
├── frontend/                 # Aplicación visual
│   ├── index.html            # Entry point
│   ├── package.json          # Dependencias de React/Vite
│   ├── vite.config.js        # Configuración de Vite y proxy para el puerto 8000
│   └── src/
│       ├── App.jsx           # Contenedor de la UI y Tabs
│       ├── App.css           # Estilos Premium (Glassmorphism)
│       ├── components/       # Módulos: Dashboard, Statistical, Clustering, Reductor
│       └── services/api.js   # Interfaz Axios para consumo de la API
├── cumplimiento_visitas_nuevo.xlsx # Datos fuente de distritos (Sintéticos)
├── generar_datos.py          # Script para fabricar el comportamiento logístico
└── CONTEXTO_PROYECTO.md      # Registro del diseño arquitectónico
```

## 🤝 Flujo para Colaboradores

1. Crea una nueva rama para tu funcionalidad: `git checkout -b feature/mi-nueva-funcionalidad`
2. Realiza tus cambios y asegúrate de probar que ambos servidores arranquen sin errores.
3. Haz un commit detallado: `git commit -m "Agrega gráfica de barras para el reporte final"`
4. Haz push a tu rama: `git push origin feature/mi-nueva-funcionalidad`
5. Crea un Pull Request para revisión.

> [!NOTE]
> **Compatibilidad React:** El frontend está utilizando la versión 18 de React. Por favor, ten cuidado al actualizar librerías que requieran exclusividad con React 19, ya que actualmente puede generar conflictos con librerías que usan objetos `forwardRef` (como `recharts` y `react-plotly.js`).
