import React, { useState, useEffect } from 'react';
import { getReductorAnalysis } from '../services/api';
import PlotlyComponent from 'react-plotly.js';
import { AlertTriangle, TrendingDown, Target, CheckCircle2 } from 'lucide-react';

const Plot = PlotlyComponent.default || PlotlyComponent;

const Reductor = ({ sheet, state }) => {
  const [threshold, setThreshold] = useState(0.90);
  const [coverage, setCoverage] = useState(0.80);
  const [manualDay, setManualDay] = useState(0); // 0 means use auto recommendation
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAllRisk, setShowAllRisk] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await getReductorAnalysis(threshold, coverage, manualDay === 0 ? null : manualDay, sheet, state);
        setData(result);
      } catch (error) {
        console.error("Error fetching reductor data", error);
      }
      setLoading(false);
    };
    // Debounce to avoid too many requests while sliding
    const timer = setTimeout(() => {
      fetchData();
    }, 200);
    return () => clearTimeout(timer);
  }, [threshold, coverage, manualDay, sheet, state]);

  return (
    <div className="dashboard-container">
      <h2>🎯 Reductor de Días - Análisis de Punto Óptimo</h2>

      <div className="info-box">
        <p className="explanation-text">
          Esta herramienta utiliza algoritmos de detección de codos (Kneedle) y análisis de cobertura probabilística para determinar el equilibrio óptimo entre <strong>tiempo en campo</strong> y <strong>cumplimiento de metas</strong>.
        </p>
        <ul className="explanation-text micro" style={{ marginTop: '10px' }}>
          <li><strong>Umbral de Cumplimiento ($U$):</strong> Meta mínima de avance esperada por cada uno de los 300 distritos.</li>
          <li><strong>Cobertura Nacional ($\Phi$):</strong> Porcentaje mínimo de distritos que deben haber alcanzado el umbral $U$ para considerar el cierre de la etapa.</li>
          <li><strong>Rendimiento Marginal:</strong> El avance adicional logrado cada día. Ayuda a identificar cuándo el esfuerzo extra ya no produce resultados significativos.</li>
        </ul>
      </div>
      
      <div className="controls panel">
        <div className="control-group">
          <label>
            Umbral de Cumplimiento (La meta por distrito): {(threshold * 100).toFixed(0)}%
            <span className="explanation-text micro" style={{marginBottom: '5px'}}>
              Define el nivel de avance considerado como suficiente para el cumplimiento de un distrito.
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
              Define el porcentaje mínimo de los 300 distritos que deben alcanzar la meta antes de concluir la etapa.
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
            <strong style={{color: '#ff7f0e'}}>Ajuste de Día de Corte:</strong> {manualDay === 0 ? "Recomendación Sugerida" : `Manual: Día ${manualDay}`}
            <span className="explanation-text micro" style={{marginBottom: '5px'}}>
              Desplace este control para simular un cierre en una fecha específica y evaluar el impacto en los indicadores de riesgo.
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
                <h3>Día de Corte</h3>
                <div className="kpi-value highlight-value">Día {data.recommended_day}</div>
                <span className="micro-text">{manualDay === 0 ? '(Óptimo calculado)' : '(Selección manual)'}</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon"><TrendingDown /></div>
              <div className="kpi-content">
                <h3>Rendimiento Decreciente</h3>
                <div className="kpi-value">{data.knee_day ? `Día ${data.knee_day}` : 'N/A'}</div>
                <span className="micro-text">Punto donde el avance se estanca</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon"><CheckCircle2 /></div>
              <div className="kpi-content">
                <h3>Cobertura Lograda</h3>
                <div className="kpi-value">
                  {data.coverage_by_day[data.recommended_day - 1] 
                    ? (data.coverage_by_day[data.recommended_day - 1] * 100).toFixed(1) + '%' 
                    : 'N/A'}
                </div>
                <span className="micro-text">Distritos que alcanzaron el {(threshold*100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="kpi-card alert">
              <div className="kpi-icon"><AlertTriangle /></div>
              <div className="kpi-content">
                <h3>Distritos con Rezago</h3>
                <div className="kpi-value">{data.total_risk_districts}</div>
                <span className="micro-text">No llegan a la meta el Día {data.recommended_day}</span>
              </div>
            </div>
          </div>

          <div className="panel reasoning-panel" style={{ marginTop: '15px', borderLeft: '4px solid #3A6BC5', background: 'rgba(58, 107, 197, 0.1)' }}>
             <p className="explanation-text" style={{ fontSize: '1rem', color: '#e0e0e0' }}>
               <strong>💡 Razonamiento:</strong> {data.recommendation_reason}
             </p>
          </div>

          <div className="charts-grid">
            <div className="chart-card">
              <h3>📈 Eficiencia: Análisis de Rendimiento Marginal</h3>
              <p className="explanation-text micro" style={{marginBottom: '10px'}}>
                Este gráfico compara la ganancia diaria de avance (barras) contra el progreso acumulado (línea). El punto de optimización ocurre cuando las barras de crecimiento diario comienzan a disminuir su tamaño de forma sostenida, indicando que el operativo ha entrado en una fase de cierre donde cada día adicional requiere más esfuerzo para obtener el mismo resultado.
              </p>
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
                        text: 'Punto de Corte',
                        showarrow: true,
                        arrowhead: 2,
                        ax: -40,
                        ay: -40,
                        font: { color: '#ff3333', size: 10 }
                      }
                    ]
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '350px' }}
                />
              </div>
            </div>

            <div className="chart-card">
              <h3>🗺️ Cobertura Probabilística de Distritos</h3>
              <p className="explanation-text micro" style={{marginBottom: '10px'}}>
                Muestra la progresión de los 300 distritos conforme superan el umbral establecido. La intersección de la curva de cobertura con la línea de meta (naranja) define el día técnico de cumplimiento. Si la curva tiene una pendiente muy baja, significa que hay un grupo de distritos rezagados que están retrasando la conclusión general del operativo nacional.
              </p>
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
                <h3>⚠️ Top Distritos en Riesgo (Día {data.recommended_day})</h3>
                <p>Estos distritos no alcanzarán el umbral del {(threshold*100).toFixed(0)}% si se recorta a {data.recommended_day} días.</p>
                <div className="risk-tags">
                  {(showAllRisk ? data.risk_districts : data.risk_districts.slice(0, 20)).map((d) => (
                    <div key={d.distrito} className="risk-tag">
                      {d.distrito} 
                      <span className="risk-value">{(d.cumplimiento * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                  {!showAllRisk && data.total_risk_districts > 20 && (
                    <div 
                      className="risk-tag more" 
                      onClick={() => setShowAllRisk(true)}
                      style={{ cursor: 'pointer', background: '#ff7f0e', color: 'white' }}
                      title="Click para ver todos"
                    >
                      + {data.total_risk_districts - 20} más
                    </div>
                  )}
                  {showAllRisk && data.total_risk_districts > 20 && (
                    <div 
                      className="risk-tag more" 
                      onClick={() => setShowAllRisk(false)}
                      style={{ cursor: 'pointer', background: '#666', color: 'white' }}
                    >
                      Ver menos
                    </div>
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
