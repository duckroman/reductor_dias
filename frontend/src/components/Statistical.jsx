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
      
      <div className="controls">
        <label>
          Día para análisis de distribución: {day}
          <input 
            type="range" 
            min="1" max="50" 
            value={day} 
            onChange={(e) => setDay(parseInt(e.target.value))}
            className="slider"
          />
        </label>
      </div>

      {loading ? (
        <div className="loading">Cargando análisis estadístico...</div>
      ) : (
        <div className="charts-grid">
          <div className="chart-card">
            <h3>Distribución Día {day} y Ajustes</h3>
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
                      name: `Normal (p=${distData.normal.ks_pvalue.toFixed(3)})`,
                      line: { color: '#ff7f0e' }
                    }] : []),
                    ...(distData.beta ? [{
                      x: distData.beta.pdf_x,
                      y: distData.beta.pdf_y,
                      type: 'scatter',
                      mode: 'lines',
                      name: `Beta (p=${distData.beta.ks_pvalue.toFixed(3)})`,
                      line: { color: '#2ca02c' }
                    }] : [])
                  ]}
                  layout={{
                    margin: { t: 10, r: 10, b: 40, l: 40 },
                    xaxis: { title: 'Cumplimiento' },
                    yaxis: { title: 'Densidad' },
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
            <h3>Evolución de la Distribución (Boxplots)</h3>
            <div className="chart-wrapper">
              {boxData && (
                <Plot
                  data={[
                    {
                      y: boxData.map(d => d.q1), // Just a placeholder approach, normally we'd pass raw data for boxplot
                      // Plotly Box plot with pre-computed statistics is a bit complex,
                      // we'll pass the stats manually
                      type: 'box',
                      q1: boxData.map(d => d.q1),
                      median: boxData.map(d => d.median),
                      q3: boxData.map(d => d.q3),
                      lowerfence: boxData.map(d => d.min),
                      upperfence: boxData.map(d => d.max),
                      x: boxData.map(d => d.dia),
                      marker: { color: '#3A6BC5' },
                      name: 'Cumplimiento'
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
