# 📑 Documentación Metodológica y Científica: Reductor de Días

Este documento detalla el rigor matemático y estadístico detrás de la aplicación **Reductor de Días**. El objetivo es proporcionar una base técnica sólida para la toma de decisiones institucionales en el **INE**.

---

## 1. Marco Teórico: El Modelo de Cumplimiento

El proceso de visitas se modela como una función de cumplimiento acumulado $C(t)$ en el tiempo $t$, donde $t \in [1, 50]$. Históricamente, este proceso sigue una **curva logística** o "Curva en S", caracterizada por tres fases:
1.  **Fase de Latencia:** Arranque lento de la operación.
2.  **Fase de Crecimiento Lineal:** Máximo rendimiento de campo.
3.  **Fase de Saturación:** Rendimientos decrecientes al buscar los casos más difíciles.

---

## 2. Análisis Estadístico Descriptivo e Inferencial

### 2.1. Momentos Estadísticos
Para cada día $t$, se calcula el vector de cumplimiento $X_t = \{x_{1,t}, x_{2,t}, \dots, x_{n,t}\}$, donde $n=300$. Se obtienen los siguientes momentos:

*   **Media Aritmética ($\mu$):** $\bar{x}_t = \frac{1}{n} \sum_{i=1}^{n} x_{i,t}$
*   **Varianza ($\sigma^2$):** $s^2_t = \frac{1}{n-1} \sum_{i=1}^{n} (x_{i,t} - \bar{x}_t)^2$
*   **Asimetría (Skewness):** $\gamma_1 = E\left[\left(\frac{X-\mu}{\sigma}\right)^3\right]$ (Indica si el rezago se concentra en pocos distritos).
*   **Curtosis:** $\gamma_2 = E\left[\left(\frac{X-\mu}{\sigma}\right)^4\right] - 3$ (Indica la concentración de distritos cerca de la media).

### 2.2. Ajuste de Distribuciones Probabilísticas
El sistema evalúa el ajuste de los datos reales a funciones de densidad de probabilidad (PDF) teóricas mediante la prueba de **Kolmogorov-Smirnov (K-S)**:

*   **Distribución Beta:** Ideal para variables acotadas en $[0, 1]$.
    $$f(x; \alpha, \beta) = \frac{x^{\alpha-1}(1-x)^{\beta-1}}{B(\alpha, \beta)}$$
*   **Distribución Normal:** Utilizada para evaluar la convergencia central del cumplimiento.
    $$f(x; \mu, \sigma) = \frac{1}{\sigma\sqrt{2\pi}} e^{-\frac{1}{2}\left(\frac{x-\mu}{\sigma}\right)^2}$$

---

## 3. Aprendizaje No Supervisado: Clustering

Para identificar patrones de comportamiento sin etiquetas previas, se utiliza el algoritmo **K-Means**.

### 3.1. Estandarización y Distancia
Dado que los distritos pueden tener escalas distintas, los datos se normalizan mediante **Z-Score**: $z = \frac{x - \mu}{\sigma}$. La similitud entre distritos se mide con la **Distancia Euclidiana**:
$$d(p, q) = \sqrt{\sum_{t=1}^{50} (p_t - q_t)^2}$$

### 3.2. Selección de Grupos ($k$)
El sistema ofrece dos modalidades de agrupamiento:
1.  **Modo Automático:** Utiliza el **Coeficiente de Silueta ($S$):** $S_i = \frac{b_i - a_i}{\max(a_i, b_i)}$ para determinar el número óptimo de clusters que maximiza la cohesión interna.
2.  **Modo Manual:** Permite al usuario seleccionar un rango de entre 2 y 10 clusters (familias) para realizar micro-segmentación operativa basada en el volumen de distritos ($n=300$).

### 3.3. Reducción de Dimensionalidad (PCA)
Para visualizar 50 dimensiones (días) en un plano 2D, se utiliza el **Análisis de Componentes Principales (PCA)**, proyectando los datos en los autovectores que maximizan la varianza explicada.

### 3.4. Agrupación Inteligente (1D K-Means Clustering)
En el contexto de la supervisión de campo, el rendimiento no es homogéneo. Para facilitar la toma de decisiones tácticas, la herramienta implementa un modelo de agrupamiento unidimensional (1D K-Means) enfocado específicamente en la métrica del **déficit** de cumplimiento.

Imaginemos que cada distrito tiene una "calificación" de qué tan atrasado va (su déficit). El objetivo del algoritmo es agrupar a los distritos de forma que aquellos con un nivel de atraso similar queden juntos. Matemáticamente, si llamamos $D$ al conjunto de estos déficits, el modelo busca organizarlos utilizando la siguiente fórmula:

$$ \arg\min_{S} \sum_{i=1}^{K} \sum_{d_j \in S_i} (d_j - \mu_i)^2 $$

Para entenderlo de forma más amigable, desglosamos los términos de la ecuación:

*   **$K$ (Número de grupos):** Es la cantidad de "cajones" o perfiles en los que queremos clasificar a los distritos. En nuestro caso, el sistema está configurado para buscar $K=3$ niveles de riesgo.
*   **$\arg\min$ (Argumento del mínimo):** Es una instrucción matemática que le dice al algoritmo: *"De todas las formas posibles en las que podrías agrupar a los distritos, elige aquella configuración ($S$) que haga que el resultado de esta cuenta sea lo más pequeño posible"*.
*   **WCSS (Suma de Cuadrados Dentro del Grupo):** Es toda la parte derecha de la fórmula ($\sum \sum \dots$). Básicamente, mide qué tan "dispersos" o diferentes son los distritos dentro de un mismo grupo. Lo hace calculando la distancia entre el déficit de un distrito ($d_j$) y el promedio de su grupo ($\mu_i$). Al buscar que este número sea el mínimo, el algoritmo asegura que los distritos dentro de un mismo grupo sean lo más idénticos posible.

Al resolver esta ecuación iterativamente, el modelo logra segmentar de manera automática y sin sesgos humanos a los distritos en **3 perfiles de riesgo natural**:

1. **Riesgo Bajo (Avance Sólido):** Distritos con déficit mínimo o nulo. Se encuentran dentro de los márgenes óptimos de cumplimiento y requieren únicamente supervisión ordinaria.
2. **Riesgo Medio (Atención Preventiva):** Distritos que comienzan a rezagarse frente al promedio aceptable. Requieren monitoreo activo y ligeros ajustes operativos para corregir su trayectoria y evitar que se conviertan en focos rojos.
3. **Riesgo Alto (Prioritarios):** Distritos con la desviación en déficit más pronunciada y alarmante. Representan las áreas de mayor retraso, requiriendo intervención inmediata o inyección de recursos extraordinarios para no comprometer el logro institucional.

La principal ventaja operativa de este panel es que elimina la subjetividad al definir "qué es un distrito rezagado". Esto permite focalizar la atención institucional y los recursos donde es verdaderamente más urgente, con un respaldo estadístico incuestionable.

---

## 4. Algoritmo de Reducción de Días

El "Día Óptimo" se calcula mediante la convergencia de tres criterios técnicos:

### 4.1. Algoritmo Kneedle y Razonamiento Dinámico
Busca el punto de máxima curvatura en la función de cumplimiento acumulado. El sistema no solo entrega un número, sino un **Razonamiento Lógico** que justifica la recomendación basándose en:
- Cumplimiento de metas de cobertura ($\Phi$).
- Punto de saturación operativa ($Kneedle$).
- Estancamiento crítico o arranque acelerado (Validación de días < 20).

$$R_m(t) = \frac{\Delta C}{\Delta t} = C(t) - C(t-1)$$
El sistema identifica el punto donde $R_m(t) < \epsilon$, donde $\epsilon$ es el umbral de eficiencia institucional. Para evitar sesgos en la visualización, el rendimiento del Día 1 se normaliza a 0 si el punto de partida es alto, permitiendo observar la dinámica real del incremento diario a partir del arranque de la operación.

$$P(C_{D,t} \geq U) \geq \Phi$$
Donde $\Phi$ es la cobertura mínima requerida (ej. 80%).

### 4.4. Sobreajuste Manual (Human-in-the-loop)
El sistema permite que un experto humano sobrescriba el cálculo automático. En este caso, todos los indicadores de riesgo ($Risk Districts$) y estadísticas de cobertura se recalculan dinámicamente tomando el día seleccionado como la nueva frontera de decisión.

---

## 5. Indicadores de Eficiencia Institucional

*   **Eficiencia Acumulada ($\eta$):** Relación entre el avance total y el tiempo invertido.
    $$\eta_t = \frac{C_t - C_1}{t}$$
*   **Costo de Oportunidad:** Días de campo remanentes ($50 - t_{óptimo}$) multiplicados por el costo operativo diario.

---

> **Conclusión Científica:** La herramienta transforma datos operativos en una superficie de decisión optimizada, permitiendo al **INE** transitar de un modelo de gestión basado en plazos fijos a un modelo basado en **rendimiento estadístico**.
