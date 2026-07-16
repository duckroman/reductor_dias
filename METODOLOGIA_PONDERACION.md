# Metodología de ponderación para determinar distritos más rápidos y más lentos

Este documento explica cómo se calcula, para cada distrito, un puntaje que
permite compararlo contra el resto del país y determinar qué tan rápido o
lento avanza dentro de cada etapa de capacitación.

## 1. Variables consideradas y su ponderación

Cada etapa mide el avance de un distrito a través de varias variables (todas
expresadas en días). No todas tienen la misma importancia para determinar la
velocidad real de un distrito, por lo que a cada una se le asignó un peso:

### Primera etapa

| Variable | Ponderación |
|---|---|
| Punto de estabilización de ciudadanía visitada | 20% |
| 95% de ciudadanía visitada | 10% |
| Punto de estabilización de CCRL | 40% |
| Número óptimo | 30% |
| **Total** | **100%** |

### Segunda etapa

| Variable | Ponderación |
|---|---|
| 95% de nombramientos | 10% |
| Punto de estabilización de nombramientos | 15% |
| 95% de capacitaciones | 20% |
| Punto de estabilización de capacitaciones | 25% |
| Punto de estabilización de asistencia a simulacros | 30% |
| **Total** | **100%** |

## 2. Cálculo del puntaje de velocidad

Para cada distrito se calcula un **promedio ponderado** de sus variables:

```
puntaje = (valor_1 × peso_1 + valor_2 × peso_2 + ... + valor_n × peso_n)
          -----------------------------------------------------------
                      peso_1 + peso_2 + ... + peso_n
```

- Si al distrito le falta el valor de alguna variable, esa variable se
  excluye tanto del numerador como del denominador, de modo que el resultado
  siga siendo una proporción correcta entre las variables disponibles.
- **A menor puntaje, el distrito es más rápido.** A mayor puntaje, el
  distrito es más lento.

## 3. Posición (ranking nacional)

Con el puntaje de cada distrito, se ordenan los 300 distritos de menor a
mayor puntaje. La **Posición** es el lugar que ocupa cada distrito en ese
ordenamiento:

- **Posición 1** = el distrito más rápido del país en esa etapa.
- **Posición 300** = el distrito más lento del país en esa etapa.

La Posición es un valor fijo por distrito: no cambia aunque la tabla se
muestre ordenada alfabéticamente por entidad, ya que refleja el lugar que le
corresponde por su velocidad, no el orden en el que se está mostrando en un
momento dado.

## 4. Ordenamiento dentro de la tarjeta de una entidad

Dentro de la tarjeta de una entidad específica, el mismo puntaje ponderado se
usa para ofrecer un botón que alterna entre:

- Orden original (por ID de distrito).
- Orden de más lento a más rápido (mayor a menor puntaje).

## 5. Relación valor–color (mapa de calor)

El color de cada celda (verde → rojo) se calcula usando **una sola escala por
etapa**, construida a partir de todos los valores de todas las variables de
esa etapa, en los 300 distritos del país. Esto garantiza que un mismo número
de días se pinte siempre del mismo color, sin importar en qué variable,
distrito o tarjeta aparezca.

- Verde: valores más bajos (más rápido).
- Rojo: valores más altos (más lento — "foco rojo").

## 6. Ajustar las ponderaciones en el futuro

Las ponderaciones están definidas en el código (`EntidadPromedio.jsx`) dentro
de las constantes `STAGE1_VARIABLES` y `STAGE2_VARIABLES`, en el campo
`weight` de cada variable (como valor decimal, por ejemplo `0.20` para 20%).
Para modificarlas, basta con actualizar esos valores; la fórmula normaliza
automáticamente entre la suma de los pesos usados, por lo que, aunque no
sumen exactamente 100%, el cálculo seguirá siendo proporcionalmente correcto.
Aun así, se recomienda que siempre sumen 100% para que cada porcentaje
represente directamente su peso real dentro del cálculo.
