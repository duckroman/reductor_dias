import React, { useState, useEffect } from 'react';
import { getClusters } from '../services/api';
import PlotlyComponent from 'react-plotly.js';

const Plot = PlotlyComponent.default || PlotlyComponent;

const Clustering = () => {
  const [clusterData, setClusterData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getClusters();
        setClusterData(data);
      } catch (error) {
        console.error("Error fetching cluster data", error);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="loading">Analizando clusters (K-Means)...</div>;
  if (!clusterData) return <div>No hay datos de clusters.</div>;

  const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];

  return (
    <div className="dashboard-container">
      <h2>Clustering de Distritos (K-Means)</h2>
      
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-content">
            <h3>K Óptimo Encontrado</h3>
            <div className="kpi-value">{clusterData.best_k}</div>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Perfiles de Clusters (Curvas Promedio)</h3>
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
          <h3>Distribución PCA 2D</h3>
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
