import React, { useState, useEffect } from 'react';
import { getClusters } from '../services/api';
import PlotlyComponent from 'react-plotly.js';

const Plot = PlotlyComponent.default || PlotlyComponent;

const Clustering = ({ sheet, state }) => {
  const [clusterData, setClusterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [k, setK] = useState(0); // 0 means automatic

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getClusters(k === 0 ? null : k, sheet, state);
        setClusterData(data);
      } catch (error) {
        console.error("Error fetching cluster data", error);
      }
      setLoading(false);
    };
    fetchData();
  }, [k, sheet, state]);

  if (!clusterData && loading) return <div className="loading">Analizando clusters (K-Means)...</div>;
  if (!clusterData) return <div className="loading">Error al cargar clusters.</div>;

  const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];

  return (
    <div className="dashboard-container">
      <h2>Agrupación de Distritos (Clustering)</h2>
      
      <div className="info-box">
        <p className="explanation-text">
          El sistema ha analizado el comportamiento de todos los distritos, agrupándolos ("Clustering") según su ritmo de trabajo. 
          En lugar de un análisis individual de 300 distritos, se pueden identificar grupos que comparten patrones similares de desempeño.
        </p>
      </div>

      <div className="controls panel" style={{ marginBottom: '20px' }}>
        <div className="control-group">
          <label>
            <strong>Número de Grupos (K):</strong> {k === 0 ? `Automático (Sugerido: ${clusterData.best_k})` : `${k} Grupos`}
            <span className="explanation-text micro" style={{marginBottom: '5px'}}>
              Desplace este control para ajustar la granularidad de la agrupación en un mayor o menor número de grupos.
            </span>
            <input 
              type="range" 
              min="0" max="10" step="1"
              value={k} 
              onChange={(e) => setK(parseInt(e.target.value))}
              className="slider"
            />
          </label>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card highlight">
          <div className="kpi-content">
            <h3>Grupos Activos</h3>
            <div className="kpi-value highlight-value">{clusterData.best_k}</div>
            <span className="explanation-text micro">Familias de distritos con comportamientos similares.</span>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Comportamiento Promedio por Grupo (Tendencias Dinámicas)</h3>
          <p className="explanation-text mb-15">
            Este gráfico de líneas no representa a distritos individuales, sino a "familias de comportamiento". Cada línea es el promedio matemático de un grupo de distritos que han trabajado a ritmos similares. Se busca observar trayectorias ascendentes constantes; cualquier "plateau" o estancamiento en una de estas líneas indica un problema sistémico que afecta a todo ese grupo. Comparar estas curvas permite identificar qué grupos lograron un despegue rápido y cuáles están experimentando una desaceleración crítica en las etapas finales del operativo.
          </p>
          <div className="chart-wrapper">
            <Plot
              data={clusterData.cluster_profiles.map((p, i) => ({
                y: p.profile,
                x: Array.from({length: p.profile.length}, (_, i) => i + 1),
                type: 'scatter',
                mode: 'lines',
                name: p.name || `Grupo ${String.fromCharCode(65 + i)}`,
                line: { color: colors[i % colors.length], width: 3 }
              }))}
              layout={{
                margin: { t: 10, r: 10, b: 40, l: 40 },
                xaxis: { title: 'Día del Operativo' },
                yaxis: { title: 'Nivel de Cumplimiento (%)', tickformat: '.0%' },
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

        <div className="chart-card">
          <h3>Mapa de Similitud y Posicionamiento Estratégico</h3>
          <p className="explanation-text mb-15" style={{ fontSize: '0.9rem' }}>
            Este mapa de dispersión utiliza una técnica de reducción de dimensionalidad (PCA) para proyectar el comportamiento de 50 días en un plano de dos ejes. Es una herramienta diagnóstica poderosa para visualizar la estructura del cumplimiento nacional.<br/><br/>
            <strong>Eje Horizontal (Cumplimiento):</strong> Los puntos hacia la derecha representan distritos con un desempeño superior al promedio nacional. Los puntos a la izquierda señalan distritos en zona de riesgo.<br/>
            <strong>Eje Vertical (Dinámica de Trabajo):</strong> Este eje separa a los distritos según su "ritmo". Los distritos en la parte superior suelen ser aquellos con un arranque explosivo que luego se estabilizan, mientras que los de la parte inferior pueden tener un crecimiento más tardío o irregular.<br/><br/>
            <span style={{ color: '#818cf8', fontSize: '0.85rem' }}>
              💡 <strong>Interpretación:</strong> La formación de "nubes" de puntos muy compactas indica una alta estandarización en los procesos de esos distritos. Los puntos aislados (outliers) representan distritos con comportamientos únicos que ameritan una auditoría o supervisión especial.
            </span>
          </p>
          <div className="chart-wrapper">
            <Plot
              data={clusterData.cluster_profiles.map((p, i) => {
                const indices = clusterData.labels.reduce((acc, lbl, idx) => {
                  if (lbl === p.cluster) acc.push(idx);
                  return acc;
                }, []);
                return {
                  x: indices.map(idx => clusterData.pca.x[idx]),
                  y: indices.map(idx => clusterData.pca.y[idx]),
                  text: indices.map(idx => clusterData.district_names ? clusterData.district_names[idx] : `Distrito ${idx + 1}`),
                  type: 'scatter',
                  mode: 'markers',
                  hoverinfo: 'text+name',
                  name: p.name || `Grupo ${String.fromCharCode(65 + i)}`,
                  marker: { color: colors[i % colors.length], size: 8, opacity: 0.7 }
                };
              })}
              layout={{
                margin: { t: 10, r: 10, b: 40, l: 40 },
                xaxis: { title: 'Eje de Cumplimiento (PCA 1)', showgrid: false },
                yaxis: { title: 'Eje de Dinámica (PCA 2)', showgrid: false },
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

        <div className="chart-card wide">
          <h3>Resumen de Clusters</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Cluster</th>
                <th>Número de Distritos</th>
                <th>Media Día 1</th>
                <th>Media Día 50</th>
                <th>Desviación Día 50</th>
              </tr>
            </thead>
            <tbody>
              {clusterData.cluster_profiles.map((p) => (
                <tr key={p.cluster}>
                  <td>{p.name || `Cluster ${p.cluster}`}</td>
                  <td>{p.n_distritos}</td>
                  <td>{(p.mean_day1 * 100).toFixed(2)}%</td>
                  <td>{(p.mean_final * 100).toFixed(2)}%</td>
                  <td>{(p.std_final * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Clustering;
