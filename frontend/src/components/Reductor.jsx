import React, { useState, useEffect } from 'react';
import { getReductorAnalysis } from '../services/api';
import PlotlyComponent from 'react-plotly.js';
import { AlertTriangle, TrendingDown, Target, CheckCircle2 } from 'lucide-react';

const Plot = PlotlyComponent.default || PlotlyComponent;

const Reductor = () => {
  const [threshold, setThreshold] = useState(0.90);
  const [coverage, setCoverage] = useState(0.80);
  const [manualDay, setManualDay] = useState(0); // 0 means use auto recommendation
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await getReductorAnalysis(threshold, coverage, manualDay === 0 ? null : manualDay);
        setData(result);
      } catch (error) {
        console.error("Error fetching reductor data", error);
      }
      setLoading(false);
    };
    // Debounce to avoid too many requests while sliding
    const timer = setTimeout(() => {
      fetchData();
    }, 500);
    return () => clearTimeout(timer);
  }, [threshold, coverage, manualDay]);

  return (
    <div className="dashboard-container">
      <h2>🎯 Reductor de Días - Análisis de Punto Óptimo</h2>

      <div className="info-box">
        <h4>¿Qué estamos viendo aquí?</h4>
        <p className="explanation-text">
          Esta es la herramienta principal para la toma de decisiones. Sirve para responder: <strong>"¿En qué día puedo detener el trabajo en campo garantizando que la mayoría de los distritos cumplieron su meta?"</strong>. 
          El sistema calculará automáticamente un día recomendado, pero puedes probar tus propios recortes de tiempo para ver qué pasaría.
        </p>
      </div>
      
      <div className="controls panel">
        <div className="control-group">
          <label>
            Umbral de Cumplimiento (La meta por distrito): {(threshold * 100).toFixed(0)}%
            <span className="explanation-text micro" style={{marginBottom: '5px'}}>
              ¿Cuánto avance consideras que es "suficiente" para un distrito?
            </span>
            <input 
              type="range" 
              min="0.50" max="0.99" step="0.01"
              value={threshold} 
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="slider"
            />
          </label>
        </div>
        <div className="control-group">
          <label>
            Cobertura Nacional Esperada: {(coverage * 100).toFixed(0)}%
            <span className="explanation-text micro" style={{marginBottom: '5px'}}>
              ¿Qué porcentaje de los 300 distritos deben llegar a la meta antes de cortar?
            </span>
            <input 
              type="range" 
              min="0.50" max="1.0" step="0.01"
              value={coverage} 
              onChange={(e) => setCoverage(parseFloat(e.target.value))}
              className="slider"
            />
          </label>
        </div>
        <div className="control-group highlight-control" style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '10px', borderRadius: '8px', border: '1px solid #ff7f0e' }}>
          <label>
            <strong style={{color: '#ff7f0e'}}>Probar Recorte Manual:</strong> {manualDay === 0 ? "Automático (Recomendado por la IA)" : `Forzar Día ${manualDay}`}
            <span className="explanation-text micro" style={{marginBottom: '5px'}}>
              Mueve este control para ignorar a la IA y ver qué pasaría si decides cortar el trabajo en el día que tú elijas.
            </span>
            <input 
              type="range" 
              min="0" max={data ? data.dias.length : 50} step="1"
              value={manualDay} 
              onChange={(e) => setManualDay(parseInt(e.target.value))}
              className="slider"
            />
          </label>
        </div>
      </div>

      {loading && !data ? (
        <div className="loading">Calculando punto óptimo...</div>
      ) : !data ? (
        <div className="loading">Error al cargar análisis del reductor.</div>
      ) : (
        <>
          <div className="kpi-grid" style={{ marginTop: '20px' }}>
            <div className="kpi-card highlight">
              <div className="kpi-icon"><Target /></div>
              <div className="kpi-content">
                <h3>Día Recomendado</h3>
                <div className="kpi-value highlight-value">Día {data.recommended_day}</div>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon"><TrendingDown /></div>
              <div className="kpi-content">
                <h3>Día de Rendimiento Decreciente (Knee)</h3>
                <div className="kpi-value">{data.knee_day ? `Día ${data.knee_day}` : 'N/A'}</div>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon"><CheckCircle2 /></div>
              <div className="kpi-content">
                <h3>Cobertura Alcanzada en Día Rec.</h3>
                <div className="kpi-value">
                  {data.coverage_by_day[data.recommended_day - 1] 
                    ? (data.coverage_by_day[data.recommended_day - 1] * 100).toFixed(1) + '%' 
                    : 'N/A'}
                </div>
              </div>
            </div>
            <div className="kpi-card alert">
              <div className="kpi-icon"><AlertTriangle /></div>
              <div className="kpi-content">
                <h3>Distritos en Riesgo</h3>
                <div className="kpi-value">{data.total_risk_districts}</div>
              </div>
            </div>
          </div>

          <div className="charts-grid">
            <div className="chart-card">
              <h3>Rendimiento Marginal vs Acumulado</h3>
              <div className="chart-wrapper">
                <Plot
                  data={[
                    {
                      x: data.dias,
                      y: data.mean_by_day.map(v => v * 100),
                      type: 'scatter',
                      mode: 'lines',
                      name: 'Acumulado Promedio (%)',
                      line: { color: '#3A6BC5', width: 3 },
                      yaxis: 'y1',
                    },
                    {
                      x: data.dias,
                      y: data.marginal_returns.map(v => v * 100),
                      type: 'bar',
                      name: 'Incremento Marginal (%)',
                      marker: { color: 'rgba(255, 127, 14, 0.6)' },
                      yaxis: 'y2',
                    }
                  ]}
                  layout={{
                    margin: { t: 10, r: 50, b: 40, l: 50 },
                    xaxis: { title: 'Día' },
                    yaxis: { title: 'Cumplimiento (%)', range: [0, 100] },
                    yaxis2: { 
                      title: 'Incremento (%)', 
                      overlaying: 'y', 
                      side: 'right',
                      range: [0, Math.max(...data.marginal_returns) * 120] 
                    },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    font: { color: '#e0e0e0' },
                    legend: { orientation: 'h', y: -0.2 },
                    shapes: [
                      {
                        type: 'line',
                        x0: data.recommended_day,
                        x1: data.recommended_day,
                        y0: 0,
                        y1: 100,
                        line: { color: '#ff3333', width: 2, dash: 'dot' }
                      }
                    ],
                    annotations: [
                      {
                        x: data.recommended_day,
                        y: 100,
                        xref: 'x',
                        yref: 'y1',
                        text: 'Corte Recomendado',
                        showarrow: true,
                        arrowhead: 2,
                        ax: -40,
                        ay: -40,
                        font: { color: '#ff3333' }
                      }
                    ]
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '350px' }}
                />
              </div>
            </div>

            <div className="chart-card">
              <h3>Cobertura de Distritos por Día</h3>
              <div className="chart-wrapper">
                <Plot
                  data={[
                    {
                      x: data.dias,
                      y: data.coverage_by_day.map(v => v * 100),
                      type: 'scatter',
                      mode: 'lines',
                      name: '% Distritos que cumplen',
                      line: { color: '#2ca02c', width: 3 },
                    }
                  ]}
                  layout={{
                    margin: { t: 10, r: 10, b: 40, l: 50 },
                    xaxis: { title: 'Día' },
                    yaxis: { title: 'Cobertura (%)', range: [0, 100] },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    font: { color: '#e0e0e0' },
                    shapes: [
                      {
                        type: 'line',
                        x0: 1,
                        x1: data.dias.length,
                        y0: coverage * 100,
                        y1: coverage * 100,
                        line: { color: '#ff7f0e', width: 2, dash: 'dash' }
                      },
                      {
                        type: 'line',
                        x0: data.recommended_day,
                        x1: data.recommended_day,
                        y0: 0,
                        y1: 100,
                        line: { color: '#ff3333', width: 2, dash: 'dot' }
                      }
                    ]
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '350px' }}
                />
              </div>
            </div>

            <div className="chart-card wide">
              <h3>Simulación de Escenarios (Comparativa)</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Si cortamos el Día...</th>
                    <th>Cumplimiento Medio</th>
                    <th>Mediana</th>
                    <th>Distritos &gt; 80%</th>
                    <th>Distritos &gt; 90%</th>
                    <th>Distritos en Riesgo ({'<'} {(threshold*100).toFixed(0)}%)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.scenarios.map((s) => (
                    <tr key={s.dia} className={s.dia === data.recommended_day ? 'highlight-row' : ''}>
                      <td>Día {s.dia} {s.dia === data.recommended_day && '🎯'}</td>
                      <td>{(s.media * 100).toFixed(1)}%</td>
                      <td>{(s.mediana * 100).toFixed(1)}%</td>
                      <td>{s.pct_above_80.toFixed(1)}%</td>
                      <td>{s.pct_above_90.toFixed(1)}%</td>
                      <td className={s.distritos_en_riesgo > 50 ? 'danger-text' : ''}>
                        {s.distritos_en_riesgo}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.risk_districts.length > 0 && (
              <div className="chart-card wide alert-card">
                <h3>Top Distritos en Riesgo (Día {data.recommended_day})</h3>
                <p>Estos distritos no alcanzarán el umbral del {(threshold*100).toFixed(0)}% si se recorta a {data.recommended_day} días.</p>
                <div className="risk-tags">
                  {data.risk_districts.map((d) => (
                    <div key={d.distrito} className="risk-tag">
                      Distrito {d.distrito} 
                      <span className="risk-value">{(d.cumplimiento * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                  {data.total_risk_districts > 20 && (
                    <div className="risk-tag more">+ {data.total_risk_districts - 20} más</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Reductor;
