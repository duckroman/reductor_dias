# Metodología del Ranking de los 300 Distritos

> Documento de referencia que describe cómo se calcula y determina cuáles distritos son más rápidos o lentos en el componente `SeccionesGHMap.jsx`.

---

## 1. Variables y pesos por etapa

El ranking utiliza distintas variables dependiendo de la etapa de capacitación. Cada variable tiene un **peso asignado** que refleja su importancia relativa.

### 1ª Etapa de Capacitación

| Variable | Descripción | Peso |
|---|---|---|
| `ccrl_estabilizacion` | Punto de estabilización de CCRL | **0.40** |
| `numero_optimo` | Número óptimo | **0.30** |
| `ciudadania_estabilizacion` | Punto de estabilización de ciudadanía visitada | **0.20** |
| `ciudadania_95` | 95% de ciudadanía visitada | **0.10** |

> **Nota:** La variable `numero_optimo` no está disponible para el dataset PEC 2017-2018.

### 2ª Etapa de Capacitación

| Variable | Descripción | Peso |
|---|---|---|
| `simulacros_estabilizacion` | Punto de estabilización de asistencia a simulacros | **0.30** |
| `capacitaciones_estabilizacion` | Punto de estabilización de capacitaciones | **0.25** |
| `capacitaciones_95` | 95% de capacitaciones | **0.20** |
| `nombramientos_estabilizacion` | Punto de estabilización de nombramientos | **0.15** |
| `nombramientos_95` | 95% de nombramientos | **0.10** |

---

## 2. Cálculo del puntaje (`getDistritoScore`)

Para cada distrito se calcula un **puntaje ponderado** con la siguiente fórmula:

```
puntaje = Σ (valor_variable_i × peso_i)
```

- Se recorren las variables de la etapa correspondiente.
- Solo se consideran variables con valores numéricos válidos.
- El valor de cada variable representa **cuántos días** toma alcanzar cierto hito de capacitación.
- **Un puntaje mayor indica más días para alcanzar los indicadores, es decir, un distrito más lento.**

### Ejemplo (Etapa 1)

Si un distrito tiene:
- `ccrl_estabilizacion = 10`
- `numero_optimo = 8`
- `ciudadania_estabilizacion = 12`
- `ciudadania_95 = 15`

Su puntaje sería:

```
puntaje = (10 × 0.40) + (8 × 0.30) + (12 × 0.20) + (15 × 0.10)
        = 4.0 + 2.4 + 2.4 + 1.5
        = 10.3
```

---

## 3. Ordenamiento y asignación de posiciones (`getStageRanking`)

Una vez calculado el puntaje de cada distrito, se ordenan de forma **ascendente** (menor puntaje primero):

```js
const sorted = [...getStageDistritos(stage, tab)].sort((a, b) =>
    compareDistritosByScore(a, b, variables)  // ascendente: a - b
);
return sorted.map((d, idx) => ({ ...d, __posicion: idx + 1 }));
```

Esto produce:

| Posición | Significado |
|---|---|
| **Posición 1** | Puntaje más bajo → **distrito más rápido** (alcanza sus indicadores en menos días) |
| **Posición 300** | Puntaje más alto → **distrito más lento** (tarda más días en alcanzar sus indicadores) |

---

## 4. Visualización en el modal de ranking

El modal permite al usuario alternar entre dos vistas de ordenamiento:

- **"Más rápido primero"**: Muestra las filas ordenadas por `__posicion` ascendente (1, 2, 3…).
- **"Más lento primero"**: Muestra las filas ordenadas por `__posicion` descendente (300, 299, 298…).

> La columna "Posición" siempre muestra el número asignado original (el `__posicion` calculado una sola vez); solo cambia el **orden visual** de las filas en la tabla.

### Heatmap de variables

Cada celda de variable se colorea con un degradado:
- **Verde** (`rgb(79, 227, 173)`) → Valor bajo (más rápido).
- **Rojo** (`rgb(255, 32, 20)`) → Valor alto (más lento / foco rojo).

El color se interpola linealmente entre el mínimo y el máximo de todos los valores de la etapa.

---

## 5. Datasets disponibles

El ranking puede consultarse para distintos periodos mediante pestañas:

| Pestaña | Dataset |
|---|---|
| PEC 2023-2024 | `distritos_analisis_3.json` |
| PEC 2020-2021 | `distritos_analisis_3_PEC21.json` |
| PEC 2017-2018 | `distritos_analisis_3_PEC18.json` |
| Promedio | `distritos_analisis_PECPromedio.json` |

Cada dataset contiene las propiedades `etapa1` y `etapa2` con los datos de los 300 distritos.

---

## Resumen

El ranking es una **suma ponderada de indicadores de días** de cada distrito. Cada variable representa cuántos días toma alcanzar cierto hito de capacitación. Los distritos que acumulan **menos días ponderados** se consideran **más rápidos** y obtienen las posiciones más altas (posición 1 = más rápido). La diferencia entre la 1ª Etapa y la 2ª Etapa son las **variables y sus pesos**, pero la **mecánica de cálculo es idéntica**.

---

### Referencias en el código

- Variables y pesos: `STAGE1_VARIABLES` (líneas 90-95) y `STAGE2_VARIABLES` (líneas 97-103)
- Cálculo del puntaje: `getDistritoScore` (líneas 133-142)
- Comparador de ordenamiento: `compareDistritosByScore` (líneas 145-146)
- Generación del ranking: `getStageRanking` (líneas 606-612)
- Modal de ranking: `renderRankingModal` (líneas 1535-1699)
