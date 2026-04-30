import React, { useState, useEffect } from 'react';
import { getStats, getFullData } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import PlotlyComponent from 'react-plotly.js';
import { Activity, CheckCircle, Target, TrendingUp } from 'lucide-react';

const Plot = PlotlyComponent.default || PlotlyComponent;

const Dashboard = () => {
  const [stats, setStats] = useState([]);
  const [fullData, setFullData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsData = await getStats();
        const full = await getFullData();
        setStats(statsData);
        setFullData(full);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching dashboard data", error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="loading">Cargando datos del dashboard...</div>;

  const latestStats = stats[stats.length - 1];

  // Prepare heatmap data
  const zValues = fullData ? fullData.matrix : [];
  const xDays = fullData ? fullData.dias : [];
  const yDistricts = fullData ? fullData.distritos : [];

  return (
    <div className="dashboard-container">
      <h2>Dashboard General de Cumplimiento</h2>
      
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon"><Activity /></div>
          <div className="kpi-content">
            <h3>Cumplimiento Promedio (Día {latestStats.dia})</h3>
            <div className="kpi-value">{(latestStats.media * 100).toFixed(1)}%</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><CheckCircle /></div>
          <div className="kpi-content">
            <h3>Distritos &gt; 90%</h3>
            <div className="kpi-value">{latestStats.pct_above_90.toFixed(1)}%</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><Target /></div>
          <div className="kpi-content">
            <h3>Mediana Global</h3>
            <div className="kpi-value">{(latestStats.mediana * 100).toFixed(1)}%</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><TrendingUp /></div>
          <div className="kpi-content">
            <h3>Crecimiento Diario Prom.</h3>
            <div className="kpi-value">{((latestStats.media - stats[stats.length-2].media) * 100).toFixed(2)}%</div>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card wide">
          <h3>Evolución del Cumplimiento Promedio</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="dia" stroke="#888" label={{ value: 'Días', position: 'insideBottom', offset: -5 }} />
                <YAxis stroke="#888" tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} />
                <Tooltip formatter={(val) => `${(val * 100).toFixed(1)}%`} />
                <Legend />
                <Line type="monotone" dataKey="media" name="Media" stroke="#3A6BC5" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="mediana" name="Mediana" stroke="#2B579A" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card wide">
          <h3>Mapa de Calor: Distritos vs Días</h3>
          <div className="chart-wrapper heatmap-wrapper">
            {fullData && (
              <Plot
                data={[
                  {
                    z: zValues,
                    x: xDays,
                    y: yDistricts,
                    type: 'heatmap',
                    colorscale: 'Viridis',
                    colorbar: { title: 'Cumplimiento' },
                  }
                ]}
                layout={{
                  margin: { t: 10, r: 10, b: 40, l: 50 },
                  xaxis: { title: 'Día' },
                  yaxis: { title: 'Distrito' },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  font: { color: '#e0e0e0' },
                  autosize: true
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '400px' }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
