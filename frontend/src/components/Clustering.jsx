import React, { useState, useEffect } from 'react';
import { getClusters } from '../services/api';
import PlotlyComponent from 'react-plotly.js';

const Plot = PlotlyComponent.default || PlotlyComponent;

const Clustering = () => {
  const [clusterData, setClusterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [k, setK] = useState(0); // 0 means automatic

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getClusters(k === 0 ? null : k);
        setClusterData(data);
      } catch (error) {
        console.error("Error fetching cluster data", error);
      }
      setLoading(false);
    };
    fetchData();
  }, [k]);

  if (!clusterData && loading) return <div className="loading">Analizando clusters (K-Means)...</div>;
  if (!clusterData) return <div className="loading">Error al cargar clusters.</div>;

  const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];

  return (
    <div className="dashboard-container">
      <h2>Agrupación de Distritos (Clustering)</h2>
      
      <div className="info-box">
        <h4>¿Qué estamos viendo aquí?</h4>
        <p className="explanation-text">
          El sistema analizó el comportamiento de todos los distritos y los agrupó ("Clustering") según su ritmo de trabajo. 
          En lugar de analizar 300 distritos uno por uno, podemos ver unas cuantas "familias" o grupos que comparten el mismo problema o el mismo éxito.
        </p>
      </div>

      <div className="controls panel" style={{ marginBottom: '20px' }}>
        <div className="control-group">
          <label>
            <strong>Número de Grupos (K):</strong> {k === 0 ? `Automático (Sugerido: ${clusterData.best_k})` : `${k} Grupos`}
            <span className="explanation-text micro" style={{marginBottom: '5px'}}>
              Mueve este control para forzar al sistema a agrupar los distritos en más o menos familias.
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
          <h3>Comportamiento Promedio por Grupo</h3>
          <p className="explanation-text mb-15">
            <strong>¿Cómo leer esto?</strong> Cada línea representa el "ritmo de trabajo" típico de una familia entera. 
            Puedes ver rápidamente qué familia se atrasó a mitad de camino o cuál empezó rápido.
          </p>
          <div className="chart-wrapper">
            <Plot
              data={clusterData.cluster_profiles.map((p, i) => ({
                y: p.profile,
                x: Array.from({length: p.profile.length}, (_, i) => i + 1),
                type: 'scatter',
                mode: 'lines',
                name: `Cluster ${p.cluster} (n=${p.n_distritos})`,
                line: { color: colors[i % colors.length], width: 3 }
              }))}
              layout={{
                margin: { t: 10, r: 10, b: 40, l: 40 },
                xaxis: { title: 'Día' },
                yaxis: { title: 'Cumplimiento' },
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
          <h3>Mapa de Similitud entre Distritos</h3>
          <p className="explanation-text mb-15">
            <strong>¿Cómo leer esto?</strong> Imagina que el sistema lee las curvas de los 300 distritos y los dibuja en un mapa. 
            Cada punto es un distrito. Los distritos que están muy pegaditos se comportaron casi igual durante los 50 días.
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
                  type: 'scatter',
                  mode: 'markers',
                  name: `Cluster ${p.cluster}`,
                  marker: { color: colors[i % colors.length], size: 8, opacity: 0.7 }
                };
              })}
              layout={{
                margin: { t: 10, r: 10, b: 40, l: 40 },
                xaxis: { title: 'Componente Principal 1' },
                yaxis: { title: 'Componente Principal 2' },
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
                  <td>Cluster {p.cluster}</td>
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
