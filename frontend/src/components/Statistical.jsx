import React, { useState, useEffect } from 'react';
import { getDistributions, getBoxplot, getCorrelation } from '../services/api';
import PlotlyComponent from 'react-plotly.js';

const Plot = PlotlyComponent.default || PlotlyComponent;

const Statistical = () => {
  const [day, setDay] = useState(25);
  const [distData, setDistData] = useState(null);
  const [boxData, setBoxData] = useState(null);
  const [corrData, setCorrData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Carga inicial de datos que no dependen del día seleccionado
  useEffect(() => {
    const fetchStaticData = async () => {
      const [box, corr] = await Promise.allSettled([
        getBoxplot(),
        getCorrelation()
      ]);
      if (box.status === 'fulfilled') setBoxData(box.value);
      if (corr.status === 'fulfilled') setCorrData(corr.value);
    };
    fetchStaticData();
  }, []);

  // Recarga solo los datos que dependen del día seleccionado
  useEffect(() => {
    const fetchDynamicData = async () => {
      setLoading(true);
      try {
        const dist = await getDistributions(day);
        setDistData(dist);
      } catch (error) {
        console.error("Error loading distributions", error);
      }
      setLoading(false);
    };
    fetchDynamicData();
  }, [day]);

  return (
    <div className="dashboard-container">
      <h2>Análisis Estadístico</h2>
      
      <div className="info-box">
        <h4>¿Qué estamos viendo aquí?</h4>
        <p className="explanation-text">
          En esta sección evaluamos la uniformidad y el comportamiento del avance a lo largo de los días. 
          Aquí puedes ver si la mayoría de los distritos avanzan al mismo ritmo o si hay mucha desigualdad (unos muy adelantados y otros muy atrasados).
        </p>
      </div>
      
      <div className="controls panel">
        <label>
          <strong>Selecciona un día para analizar:</strong> Día {day}
          <br/>
          <span className="explanation-text micro" style={{marginBottom: '10px', display: 'block'}}>
            Mueve este control para ver cómo estaban los distritos en ese día en particular.
          </span>
          <input 
            type="range" 
            min="1" max={boxData ? boxData.length : 50} 
            value={day} 
            onChange={(e) => setDay(parseInt(e.target.value))}
            className="slider"
          />
        </label>
      </div>

      {loading ? (
        <div className="loading">Cargando análisis estadístico...</div>
      ) : (!distData && !boxData && !corrData) ? (
        <div className="loading">Error crítico: No se pudieron cargar datos estadísticos. Verifica la conexión con el servidor.</div>
      ) : (
        <div className="charts-grid">
          {distData ? (
            <div className="chart-card">
              <h3>Distribución de Distritos (Día {day})</h3>
              <p className="explanation-text mb-15">
                <strong>¿Cómo leer esto?</strong> Las barras azules muestran cuántos distritos tienen qué porcentaje de avance. 
                Si las barras están muy juntas, todos van parejos. Las líneas de colores (Normal y Beta) son moldes matemáticos para ver si el comportamiento es predecible.
              </p>
              <div className="chart-wrapper">
                <Plot
                  data={[
                    {
                      x: distData.histogram.bin_centers,
                      y: distData.histogram.counts,
                      type: 'bar',
                      name: 'Datos reales',
                      marker: { color: 'rgba(58, 107, 197, 0.6)' }
                    },
                    ...(distData.normal ? [{
                      x: distData.normal.pdf_x,
                      y: distData.normal.pdf_y,
                      type: 'scatter',
                      mode: 'lines',
                      name: `Normal (Ajuste)`,
                      line: { color: '#ff7f0e' }
                    }] : []),
                    ...(distData.beta ? [{
                      x: distData.beta.pdf_x,
                      y: distData.beta.pdf_y,
                      type: 'scatter',
                      mode: 'lines',
                      name: `Beta (Ajuste)`,
                      line: { color: '#2ca02c' }
                    }] : [])
                  ]}
                  layout={{
                    margin: { t: 30, r: 20, b: 60, l: 60 },
                    xaxis: { 
                      title: 'Nivel de Cumplimiento (0.0 - 1.0)',
                      gridcolor: 'rgba(255,255,255,0.1)'
                    },
                    yaxis: { 
                      title: 'Número de Distritos',
                      gridcolor: 'rgba(255,255,255,0.1)'
                    },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    font: { color: '#e0e0e0' },
                    legend: { orientation: 'h', y: -0.3 }
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '300px' }}
                />
              </div>
            </div>
          ) : (
            <div className="chart-card error-card">Error al cargar gráfico de distribución.</div>
          )}

          {boxData ? (
            <div className="chart-card">
              <h3>Evolución de la Desigualdad (Cajas y Bigotes)</h3>
              <p className="explanation-text mb-15">
                <strong>¿Cómo leer esto?</strong> Cada "caja" representa un día. La caja azul encierra a la mitad de los distritos (los más "normales"). 
                La línea en medio de la caja es la mitad exacta. Las líneas que salen (bigotes) muestran hasta dónde llegan los distritos más atrasados y los más adelantados.
              </p>
              <div className="chart-wrapper">
                <Plot
                  data={[
                    {
                      type: 'box',
                      q1: boxData.map(d => d.q1),
                      median: boxData.map(d => d.median),
                      q3: boxData.map(d => d.q3),
                      lowerfence: boxData.map(d => d.min),
                      upperfence: boxData.map(d => d.max),
                      x: boxData.map(d => d.dia),
                      marker: { color: '#3A6BC5' },
                      name: 'Rango'
                    }
                  ]}
                  layout={{
                    margin: { t: 30, r: 20, b: 60, l: 60 },
                    xaxis: { 
                      title: 'Tiempo (Días)',
                      gridcolor: 'rgba(255,255,255,0.1)'
                    },
                    yaxis: { 
                      title: 'Rango de Cumplimiento (0.0 - 1.0)',
                      range: [0, 1.05],
                      gridcolor: 'rgba(255,255,255,0.1)'
                    },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    font: { color: '#e0e0e0' },
                    shapes: [
                      {
                        type: 'rect',
                        xref: 'x',
                        yref: 'paper',
                        x0: day - 0.5,
                        x1: day + 0.5,
                        y0: 0,
                        y1: 1,
                        fillcolor: 'rgba(255, 127, 14, 0.2)',
                        line: { width: 0 }
                      },
                      {
                        type: 'line',
                        xref: 'x',
                        yref: 'paper',
                        x0: day,
                        x1: day,
                        y0: 0,
                        y1: 1,
                        line: { color: '#ff7f0e', width: 2, dash: 'dot' }
                      }
                    ],
                    annotations: [
                      {
                        x: day,
                        y: 1.02,
                        xref: 'x',
                        yref: 'y',
                        text: `Día ${day}`,
                        showarrow: false,
                        font: { color: '#ff7f0e', bold: true }
                      }
                    ]
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '300px' }}
                />
              </div>
            </div>
          ) : (
            <div className="chart-card error-card">Error al cargar gráfico de evolución (Boxplot).</div>
          )}
          
          {corrData ? (
            <div className="chart-card wide">
              <h3>Matriz de Correlación Temporal</h3>
              <p className="explanation-text mb-15">
                <strong>¿Cómo leer esto?</strong> Este cuadro compara los días entre sí para ver qué tan parecidos son los resultados. 
                Los cuadros azules muy oscuros significan que el orden de los distritos (quién va ganando y quién perdiendo) casi no cambió entre esos dos días. 
                Si ves cuadros claros, significa que las posiciones cambiaron mucho.
              </p>
              <div className="chart-wrapper heatmap-wrapper">
                <Plot
                  data={[
                    {
                      z: corrData.correlation,
                      x: corrData.days.map(d => `Día ${d}`),
                      y: corrData.days.map(d => `Día ${d}`),
                      type: 'heatmap',
                      colorscale: 'Blues',
                    }
                  ]}
                  layout={{
                    margin: { t: 40, r: 20, b: 80, l: 80 },
                    xaxis: { title: 'Día de Referencia' },
                    yaxis: { title: 'Día de Comparación' },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    font: { color: '#e0e0e0' },
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '400px' }}
                />
              </div>
            </div>
          ) : (
            <div className="chart-card wide error-card">Error al cargar matriz de correlación.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Statistical;
