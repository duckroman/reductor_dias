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

### 3.2. Optimización de Grupos ($k$)
El número óptimo de clusters se determina mediante el **Coeficiente de Silueta ($S$):**
$$S_i = \frac{b_i - a_i}{\max(a_i, b_i)}$$
Donde $a_i$ es la distancia media intra-cluster y $b_i$ la distancia media al cluster más cercano.

### 3.3. Reducción de Dimensionalidad (PCA)
Para visualizar 50 dimensiones (días) en un plano 2D, se utiliza el **Análisis de Componentes Principales (PCA)**, proyectando los datos en los autovectores que maximizan la varianza explicada.

---

## 4. Algoritmo de Reducción de Días

El "Día Óptimo" se calcula mediante la convergencia de tres criterios técnicos:

### 4.1. Algoritmo Kneedle (Detección de "Codos")
Busca el punto de máxima curvatura en la función de cumplimiento acumulado. Para una curva cóncava, se busca el punto $x$ que maximiza la distancia perpendicular a la línea que une el inicio y el fin de la curva.
$$K(x) = \frac{|f''(x)|}{(1 + f'(x)^2)^{3/2}}$$

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
