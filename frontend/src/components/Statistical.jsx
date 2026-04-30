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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const dist = await getDistributions(day);
        const box = await getBoxplot();
        const corr = await getCorrelation();
        
        setDistData(dist);
        setBoxData(box);
        setCorrData(corr);
      } catch (error) {
        console.error("Error fetching statistical data", error);
      }
      setLoading(false);
    };
    fetchData();
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
      ) : (!distData || !boxData || !corrData) ? (
        <div className="loading">Error al cargar datos estadísticos.</div>
      ) : (
        <div className="charts-grid">
          <div className="chart-card">
            <h3>Distribución de Distritos (Día {day})</h3>
            <p className="explanation-text mb-15">
              <strong>¿Cómo leer esto?</strong> Las barras azules muestran cuántos distritos tienen qué porcentaje de avance. 
              Si las barras están muy juntas, todos van parejos. Las líneas de colores (Normal y Beta) son moldes matemáticos para ver si el comportamiento es predecible.
            </p>
            <div className="chart-wrapper">
              {distData && distData.histogram && (
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
                    margin: { t: 10, r: 10, b: 40, l: 40 },
                    xaxis: { title: 'Porcentaje de Cumplimiento' },
                    yaxis: { title: 'Cantidad de Distritos' },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    font: { color: '#e0e0e0' },
                    legend: { orientation: 'h', y: -0.2 }
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '300px' }}
                />
              )}
            </div>
          </div>

          <div className="chart-card">
            <h3>Evolución de la Desigualdad (Cajas y Bigotes)</h3>
            <p className="explanation-text mb-15">
              <strong>¿Cómo leer esto?</strong> Cada "caja" representa un día. La caja azul encierra a la mitad de los distritos (los más "normales"). 
              La línea en medio de la caja es la mitad exacta. Las líneas que salen (bigotes) muestran hasta dónde llegan los distritos más atrasados y los más adelantados.
            </p>
            <div className="chart-wrapper">
              {boxData && (
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
                    margin: { t: 10, r: 10, b: 40, l: 40 },
                    xaxis: { title: 'Día' },
                    yaxis: { title: 'Cumplimiento', range: [0, 1] },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    font: { color: '#e0e0e0' },
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '300px' }}
                />
              )}
            </div>
          </div>
          
          <div className="chart-card wide">
            <h3>Matriz de Correlación Temporal</h3>
            <p className="explanation-text mb-15">
              <strong>¿Cómo leer esto?</strong> Este cuadro compara los días entre sí para ver qué tan parecidos son los resultados. 
              Los cuadros azules muy oscuros significan que el orden de los distritos (quién va ganando y quién perdiendo) casi no cambió entre esos dos días. 
              Si ves cuadros claros, significa que las posiciones cambiaron mucho.
            </p>
            <div className="chart-wrapper heatmap-wrapper">
              {corrData && (
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
                    margin: { t: 10, r: 10, b: 60, l: 60 },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    font: { color: '#e0e0e0' },
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '400px' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Statistical;
