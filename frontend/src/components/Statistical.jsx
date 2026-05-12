import React, { useState, useEffect } from 'react';
import { getDistributions, getBoxplot, getCorrelation } from '../services/api';
import PlotlyComponent from 'react-plotly.js';

const Plot = PlotlyComponent.default || PlotlyComponent;

const Statistical = ({ sheet, state }) => {
  const [day, setDay] = useState(25);
  const [distData, setDistData] = useState(null);
  const [boxData, setBoxData] = useState(null);
  const [corrData, setCorrData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStaticData = async () => {
      const [box, corr] = await Promise.allSettled([
        getBoxplot(sheet, state),
        getCorrelation(sheet, state)
      ]);
      if (box.status === 'fulfilled') setBoxData(box.value);
      if (corr.status === 'fulfilled') setCorrData(corr.value);
    };
    fetchStaticData();
  }, [sheet, state]);

  // Recarga solo los datos que dependen del día seleccionado
  useEffect(() => {
    const fetchDynamicData = async () => {
      setLoading(true);
      try {
        const dist = await getDistributions(day, sheet, state);
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
        <p className="explanation-text">
          En esta sección se evalúa la uniformidad y el comportamiento del avance a lo largo de los días. 
          Aquí se puede observar si la mayoría de los distritos avanzan al mismo ritmo o si existe disparidad significativa (distritos con avance acelerado versus distritos rezagados).
        </p>
      </div>
      
      <div className="controls panel">
        <label>
          <strong>Selecciona un día para analizar:</strong> Día {day}
          <br/>
          <span className="explanation-text micro" style={{marginBottom: '10px', display: 'block'}}>
            Desplace este control para observar el estado de los distritos en un día específico.
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
      ) : (!distData && !boxData) ? (
        <div className="loading">Error crítico: No se pudieron cargar datos estadísticos. Verifica la conexión con el servidor.</div>
      ) : (
        <div className="charts-grid">
          {distData ? (
            <div className="chart-card">
              <h3>Distribución de Distritos (Día {day})</h3>
              <p className="explanation-text mb-15">
                Este gráfico permite observar la homogeneidad del avance en un momento específico del operativo. Las barras azules agrupan a los distritos según su nivel de cumplimiento, mientras que las curvas de ajuste (Normal y Beta) actúan como modelos de referencia para detectar comportamientos atípicos. Si las barras se concentran en un solo bloque, significa que el trabajo de campo avanza de forma sincronizada a nivel nacional.
              </p>
              <div className="chart-wrapper">
                <Plot
                  data={[
                    {
                      x: distData.histogram.bin_centers,
                      y: distData.histogram.counts,
                      type: 'bar',
                      name: 'Frecuencia (Distritos)',
                      marker: { color: 'rgba(58, 107, 197, 0.6)' }
                    },
                    ...(distData.normal ? [{
                      x: distData.normal.pdf_x,
                      y: distData.normal.pdf_y,
                      type: 'scatter',
                      mode: 'lines',
                      name: 'Ajuste Normal (Teórico)',
                      line: { color: '#ef4444', width: 2, dash: 'dot' }
                    }] : []),
                    ...(distData.beta ? [{
                      x: distData.beta.pdf_x,
                      y: distData.beta.pdf_y,
                      type: 'scatter',
                      mode: 'lines',
                      name: 'Ajuste Beta (Realista)',
                      line: { color: '#10b981', width: 2 }
                    }] : [])
                  ]}
                  layout={{
                    margin: { t: 10, r: 10, b: 40, l: 40 },
                    xaxis: { title: 'Cumplimiento (%)', tickformat: '.0%' },
                    yaxis: { title: 'Cantidad de Distritos' },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    font: { color: '#e0e0e0' },
                    legend: { orientation: 'h', y: -0.2 }
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
            <div className="chart-card wide">
              <h3>Evolución de la Variabilidad (Cajas y Bigotes)</h3>
              <p className="explanation-text mb-15">
                Este diagrama es fundamental para entender la estabilidad del operativo a través del tiempo. Cada "caja" representa un día completo de trabajo para los distritos. El tamaño de la caja (rango intercuartílico) muestra qué tan dispersos están los resultados del 50% central de los distritos. Los "bigotes" o líneas extendidas indican los valores extremos; si los bigotes inferiores se mantienen muy abajo conforme pasan los días, se tiene una señal clara de rezago estructural en ciertos distritos que requieren atención inmediata.
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
          
        </div>
      )}
    </div>
  );
};

export default Statistical;
