import React, { useState, useEffect } from 'react';
import { getStats, getFullData, getLaggingDistricts, getComparative } from '../services/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import PlotlyComponent from 'react-plotly.js';
import { Activity, CheckCircle, Target, TrendingUp, AlertTriangle } from 'lucide-react';

const Plot = PlotlyComponent.default || PlotlyComponent;

const Dashboard = ({ sheet, state }) => {
  const [stats, setStats] = useState([]);
  const [fullData, setFullData] = useState(null);
  const [lagging, setLagging] = useState([]);
  const [comparative, setComparative] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsData = await getStats(sheet, state);
        const full = await getFullData(sheet, state);
        const lag = await getLaggingDistricts(sheet, state);
        
        if (sheet === 'Global' || !sheet) {
          const comp = await getComparative(state);
          setComparative(comp);
        } else {
          setComparative([]);
        }

        setStats(statsData);
        setFullData(full);
        setLagging(lag);
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
  const hoverText = (fullData && fullData.distrito_nombres) 
    ? zValues.map((row, i) => row.map(() => fullData.distrito_nombres[i]))
    : [];

  return (
    <div className="dashboard-container">
      <h2>Dashboard General de Cumplimiento</h2>
      
      <div className="info-box">
        <p className="explanation-text">
          Este centro de mando integra los indicadores vitales del operativo nacional. Aquí se monitoriza la salud general del cumplimiento: el promedio de visitas nos indica el volumen de trabajo, mientras que el porcentaje de distritos por encima del 90% revela qué tan cerca estamos de la meta crítica. El crecimiento diario permite proyectar si el ritmo actual es suficiente para concluir en los plazos previstos o si se requiere un refuerzo inmediato en la estrategia de campo.
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
          <h3>Evolución del Cumplimiento Promedio (Curva de Aprendizaje)</h3>
          <p className="explanation-text mb-15">
            Esta línea de tiempo describe la inercia del operativo. Se espera observar una curva con una pendiente pronunciada en los primeros días, lo que representa un arranque sólido. Una curva que se aplana prematuramente sugiere fatiga en el trabajo de campo o dificultades técnicas que están impidiendo el cierre de los distritos más complejos.
          </p>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="dia" stroke="#888" label={{ value: 'Días', position: 'insideBottom', offset: -5 }} />
                <YAxis stroke="#888" tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} />
                <RechartsTooltip formatter={(val) => `${(val * 100).toFixed(1)}%`} />
                <Legend />
                <Line type="monotone" dataKey="media" name="Media" stroke="#3A6BC5" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="mediana" name="Mediana" stroke="#2B579A" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {comparative.length > 0 && (
          <div className="chart-card">
            <h3>📊 Comparativa de Rubros</h3>
            <p className="explanation-text micro mb-15">
              Promedio de avance por cada actividad. Ayuda a identificar rápidamente cuál es el cuello de botella.
            </p>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparative} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="rubro" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 1]} tickFormatter={(tick) => `${(tick * 100).toFixed(0)}%`} stroke="#94a3b8" />
                  <RechartsTooltip 
                    formatter={(value) => [`${(value * 100).toFixed(1)}%`, 'Avance Promedio']}
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#3b82f6', color: '#f8fafc' }} 
                  />
                  <Bar dataKey="avance" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="chart-card wide">
          <h3>Mapa de Calor: Intensidad Operativa por Distrito</h3>
          <p className="explanation-text mb-15">
            Esta matriz visual es el "termómetro" del cumplimiento. Cada fila es un distrito y cada columna un día de operación. Los colores brillantes (amarillo/verde) representan el éxito, mientras que los tonos oscuros (morado) señalan inactividad o rezago. La aparición de líneas oscuras persistentes hacia el final de la matriz es una señal de alerta máxima sobre distritos que podrían no cumplir con la meta en el tiempo estipulado.
          </p>
          <div className="chart-wrapper heatmap-wrapper">
            {fullData && (
              <Plot
                data={[
                  {
                    z: zValues,
                    x: xDays,
                    y: yDistricts,
                    text: hoverText,
                    type: 'heatmap',
                    colorscale: 'Viridis',
                    colorbar: { title: 'Cumplimiento' },
                    hovertemplate: 'Día %{x}<br>Distrito: %{text}<br>Cumplimiento: %{z:.1%}<extra></extra>',
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

      {lagging.length > 0 && (
        <div className="chart-card wide alert-card" style={{ marginTop: '30px' }}>
          <h3 style={{ color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} />
            🚨 Focos Rojos: Top Distritos Rezagados
          </h3>
          <p className="explanation-text" style={{ marginBottom: '20px' }}>
            Esta tabla muestra los distritos con el porcentaje de cumplimiento más bajo hasta la fecha de corte. 
            La columna de <strong>Crecimiento (5 días)</strong> ayuda a identificar distritos que están estancados 
            (crecimiento menor al 1% en los últimos 5 días).
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Distrito</th>
                  <th>Cumplimiento Actual</th>
                  <th>Crecimiento (Últimos 5 Días)</th>
                  <th>Último diagnóstico</th>
                </tr>
              </thead>
              <tbody>
                {lagging.map((dist) => (
                  <tr key={dist.distrito} className={dist.estancado ? 'highlight-row' : ''} style={dist.estancado ? { backgroundColor: 'rgba(239, 68, 68, 0.15)' } : {}}>
                    <td>{dist.distrito}</td>
                    <td><strong className={dist.cumplimiento < 0.6 ? 'danger-text' : ''}>{(dist.cumplimiento * 100).toFixed(1)}%</strong></td>
                    <td>
                      {(dist.crecimiento_5d * 100).toFixed(1)}%
                      {dist.crecimiento_5d < 0 ? ' 📉' : ' 📈'}
                    </td>
                    <td>
                      <span className="risk-tag" style={{ 
                        display: 'inline-flex', 
                        padding: '4px 10px', 
                        fontSize: '0.8rem', 
                        background: dist.estado === 'Se estancó' ? '#991b1b' : 
                                    dist.estado === 'Avanzó lento' ? '#854d0e' : '#166534', 
                        color: dist.estado === 'Se estancó' ? '#fecaca' : 
                               dist.estado === 'Avanzó lento' ? '#fef9c3' : '#dcfce7', 
                        border: 'none' 
                      }}>
                        {dist.estado === 'Se estancó' ? '⚠️ ' : 
                         dist.estado === 'Avanzó lento' ? '⏳ ' : '✅ '}
                        {dist.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
