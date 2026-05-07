import React, { useState, useEffect } from 'react';
import { getStats, getFullData } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import PlotlyComponent from 'react-plotly.js';
import { Activity, CheckCircle, Target, TrendingUp } from 'lucide-react';

const Plot = PlotlyComponent.default || PlotlyComponent;

const Dashboard = ({ sheet, state }) => {
  const [stats, setStats] = useState([]);
  const [fullData, setFullData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsData = await getStats(sheet, state);
        const full = await getFullData(sheet, state);
        setStats(statsData);
        setFullData(full);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching dashboard data", error);
        setLoading(false);
      }
    };
    fetchData();
  }, [sheet, state]);

  const latestStats = stats.length > 0 ? stats[stats.length - 1] : null;

  if (loading) return <div className="loading">Cargando datos del dashboard...</div>;
  if (!latestStats) return <div className="loading">No hay datos disponibles.</div>;

  // Prepare heatmap data
  const zValues = fullData ? fullData.matrix : [];
  const xDays = fullData ? fullData.dias : [];
  const yDistricts = fullData ? fullData.distritos : [];

  return (
    <div className="dashboard-container">
      <h2>Dashboard General de Cumplimiento</h2>
      
      <div className="info-box">
        <h4>¿Qué estamos viendo aquí?</h4>
        <p className="explanation-text">
          Este panel te da un resumen general de cómo va el trabajo de campo. Las tarjetas de arriba muestran el promedio de visitas realizadas, 
          cuántos distritos ya casi terminan (más del 90%), y el crecimiento diario general. 
        </p>
      </div>
      
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon"><Activity /></div>
          <div className="kpi-content">
            <h3>Cumplimiento Promedio (Día {latestStats.dia})</h3>
            <div className="kpi-value">{(latestStats.media * 100).toFixed(1)}%</div>
            <span className="explanation-text micro">Porcentaje medio de avance en todo el país.</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><CheckCircle /></div>
          <div className="kpi-content">
            <h3>Distritos &gt; 90%</h3>
            <div className="kpi-value">{latestStats.pct_above_90.toFixed(1)}%</div>
            <span className="explanation-text micro">Distritos que ya superaron la meta del 90%.</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><Target /></div>
          <div className="kpi-content">
            <h3>Mediana Global</h3>
            <div className="kpi-value">{(latestStats.mediana * 100).toFixed(1)}%</div>
            <span className="explanation-text micro">La mitad de los distritos va mejor que esto.</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><TrendingUp /></div>
          <div className="kpi-content">
            <h3>Crecimiento Diario Prom.</h3>
            <div className="kpi-value">{stats.length > 1 ? ((latestStats.media - stats[stats.length-2].media) * 100).toFixed(2) : '0.00'}%</div>
            <span className="explanation-text micro">Cuánto se avanzó respecto a ayer.</span>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card wide">
          <h3>Evolución del Cumplimiento Promedio</h3>
          <p className="explanation-text mb-15">
            <strong>¿Cómo leer esto?</strong> Esta línea muestra cómo ha ido subiendo el esfuerzo general a lo largo del tiempo. 
            Queremos ver que la línea suba rápido al principio y se mantenga estable arriba.
          </p>
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
          <p className="explanation-text mb-15">
            <strong>¿Cómo leer esto?</strong> Imagina que esto es un calendario gigante. Cada fila es un distrito y cada columna es un día. 
            El color te dice cómo van: los colores oscuros (morado/azul) significan que casi no llevan visitas, y los colores brillantes (verde/amarillo) 
            significan que ya casi terminan. Si ves manchas oscuras en los últimos días, son distritos que se están quedando muy atrás.
          </p>
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
