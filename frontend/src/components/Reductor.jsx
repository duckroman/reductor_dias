import React, { useState, useEffect } from 'react';
import { getReductorAnalysis } from '../services/api';
import PlotlyComponent from 'react-plotly.js';
import { AlertTriangle, TrendingDown, Target, CheckCircle2 } from 'lucide-react';

const Plot = PlotlyComponent.default || PlotlyComponent;

const getDeterministicJitter = (distrito, clusterName) => {
  let hash = 0;
  for (let i = 0; i < distrito.length; i++) {
    hash = distrito.charCodeAt(i) + ((hash << 5) - hash);
  }
  const rawJitter = Math.abs(hash % 100) / 100; // entre 0 y 1
  
  if (clusterName === 'muy_lejos') {
    // Grupo crítico: parte inferior (como los puntos verdes abajo) -> Y entre 10 y 35
    return 10 + rawJitter * 25;
  } else if (clusterName === 'medio') {
    // Grupo medio: parte superior/media (como los puntos naranjas) -> Y entre 40 y 85
    return 40 + rawJitter * 45;
  } else {
    // Grupo cercano: parte superior/media derecha (como los puntos azules) -> Y entre 40 y 85
    return 40 + rawJitter * 45;
  }
};

const Reductor = ({ sheet, state }) => {
  const [threshold, setThreshold] = useState(0.90);
  const [coverage, setCoverage] = useState(0.80);
  const [manualDay, setManualDay] = useState(0); // 0 means use auto recommendation
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAllRisk, setShowAllRisk] = useState(false);
  const [showCluster, setShowCluster] = useState(false);
  const [clusterChartType, setClusterChartType] = useState('bar');
  const [theme1, setTheme1] = useState('dark');
  const [theme2, setTheme2] = useState('dark');
  const [theme3, setTheme3] = useState('dark');

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

  const handleDownloadReport = () => {
    const url = `/api/reductor/report?threshold=${threshold}&coverage=${coverage}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
              min="0.50" max="1.00" step="0.01"
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ flex: 1 }}>
              <strong style={{color: '#ff7f0e'}}>Ajuste de Día de Corte:</strong> {manualDay === 0 ? "Recomendación Sugerida" : `Manual: Día ${manualDay}`}
              <span className="explanation-text micro" style={{marginBottom: '5px'}}>
                Desplace este control para simular un cierre en una fecha específica.
              </span>
            </label>
            {manualDay !== 0 && (
              <button 
                onClick={() => setManualDay(0)}
                style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#ff7f0e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Resetear a Sugerido
              </button>
            )}
          </div>
          <input 
            type="range" 
            min="0" max={data ? data.dias.length : 50} step="1"
            value={manualDay} 
            onChange={(e) => setManualDay(parseInt(e.target.value))}
            className="slider"
          />
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
                <span className="micro-text">Punto de codo detectado</span>
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
                <span className="micro-text">Distritos en meta el Día {data.recommended_day}</span>
              </div>
            </div>
            <div className="kpi-card alert">
              <div className="kpi-icon"><AlertTriangle /></div>
              <div className="kpi-content">
                <h3>Distritos con Rezago</h3>
                <div className="kpi-value">{data.total_risk_districts}</div>
                <span className="micro-text">
                  No llegan a la meta el Día {data.recommended_day}
                  {data.risk_districts && data.risk_districts.length > 0 && (
                    <><br /><strong>Rango:</strong> {(data.risk_districts[0].cumplimiento * 100).toFixed(1)}% - {(data.risk_districts[data.risk_districts.length - 1].cumplimiento * 100).toFixed(1)}%</>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="panel reasoning-panel" style={{ marginTop: '15px', borderLeft: '4px solid #3A6BC5', background: 'rgba(58, 107, 197, 0.1)' }}>
             <p className="explanation-text" style={{ fontSize: '1rem', color: '#e0e0e0' }}>
               <strong>💡 Por qué se recomienda el Día {data.recommended_day}:</strong> {data.recommendation_reason}
             </p>
          </div>

          <div className="charts-grid">
            <div className={`chart-card ${theme1 === 'light' ? 'light-theme' : ''}`}>
              <div className="chart-card-header">
                <h3>📈 Eficiencia: Análisis de Rendimiento Marginal</h3>
                <button 
                  className={`theme-toggle-btn ${theme1 === 'light' ? 'light' : 'dark'}`}
                  onClick={() => setTheme1(theme1 === 'light' ? 'dark' : 'light')}
                >
                  {theme1 === 'light' ? '☀️ Claro' : '🌙 Oscuro'}
                </button>
              </div>
              <p className="explanation-text mb-15">
                Este gráfico ayuda a visualizar la relación entre el avance total y el esfuerzo diario.
                La <strong>Línea Azul (Progreso Acumulado)</strong> muestra el promedio nacional de cumplimiento a través del tiempo.
                Las <strong>Barras Naranja (Rendimiento Marginal)</strong> representan el <strong>avance nuevo</strong> del día (la "velocidad"); muestran cuánto aumentó el promedio nacional hoy respecto al día anterior.
                El punto óptimo ocurre cuando estas barras se vuelven constantes y pequeñas, indicando que el esfuerzo extra ya no produce resultados significativos.
              </p>
              <div className="chart-wrapper">
                <Plot
                  data={[
                    {
                      x: data.dias,
                      y: data.mean_by_day.map(v => v * 100),
                      type: 'scatter',
                      mode: 'lines',
                      name: 'Progreso Acumulado (%)',
                      line: { color: '#3A6BC5', width: 3 },
                      yaxis: 'y1',
                    },
                    {
                      x: data.dias,
                      y: data.marginal_returns.map(v => v * 100),
                      type: 'bar',
                      name: 'Avance por Día (%)',
                      marker: { color: 'rgba(255, 127, 14, 0.6)' },
                      yaxis: 'y2',
                    }
                  ]}
                  layout={{
                    margin: { t: 10, r: 50, b: 50, l: 60 },
                    xaxis: { 
                      title: { text: 'Tiempo (Días de Operación)', font: { size: 12, color: theme1 === 'light' ? '#0f172a' : '#e0e0e0' } },
                      tickfont: { color: theme1 === 'light' ? '#0f172a' : '#e0e0e0' },
                      gridcolor: theme1 === 'light' ? '#cbd5e1' : 'rgba(255,255,255,0.05)'
                    },
                    yaxis: { 
                      title: { text: 'Cumplimiento Total (%)', font: { size: 12, color: theme1 === 'light' ? '#0f172a' : '#e0e0e0' } },
                      tickfont: { color: theme1 === 'light' ? '#0f172a' : '#e0e0e0' },
                      range: [0, 100],
                      gridcolor: theme1 === 'light' ? '#cbd5e1' : 'rgba(255,255,255,0.05)'
                    },
                    yaxis2: { 
                      title: { text: 'Avance Diario (%)', font: { size: 12, color: theme1 === 'light' ? '#0f172a' : '#e0e0e0' } },
                      tickfont: { color: theme1 === 'light' ? '#0f172a' : '#e0e0e0' },
                      overlaying: 'y', 
                      side: 'right',
                      range: [0, Math.max(...data.marginal_returns) * 120] 
                    },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    font: { color: theme1 === 'light' ? '#0f172a' : '#e0e0e0' },
                    legend: { orientation: 'h', y: -0.3 },
                    shapes: [
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

            <div className={`chart-card ${theme2 === 'light' ? 'light-theme' : ''}`}>
              <div className="chart-card-header">
                <h3>🗺️ Cobertura Probabilística de Distritos</h3>
                <button 
                  className={`theme-toggle-btn ${theme2 === 'light' ? 'light' : 'dark'}`}
                  onClick={() => setTheme2(theme2 === 'light' ? 'dark' : 'light')}
                >
                  {theme2 === 'light' ? '☀️ Claro' : '🌙 Oscuro'}
                </button>
              </div>
              <p className="explanation-text mb-15">
                Este indicador muestra el avance del país basado en el cumplimiento de metas individuales.
                La <strong>Línea Verde (Distritos en Meta)</strong> representa el porcentaje de los {data.total_districts || 300} distritos que ya alcanzaron el umbral del {(threshold*100).toFixed(0)}%.
                Esta línea sube porque es una métrica acumulativa: conforme pasan los días, más distritos logran "cruzar la meta" y se suman al grupo de éxito.
                El objetivo es cruzar la <strong>Línea Punteada Naranja</strong>, que es la cobertura nacional mínima requerida para concluir la etapa.
              </p>
              <div className="chart-wrapper">
                <Plot
                  data={[
                    {
                      x: data.dias,
                      y: data.coverage_by_day.map(v => v * 100),
                      text: (data.counts_by_day || []).map(c => `(${c} distritos)`),
                      hovertemplate: 'Día %{x}<br>Cobertura: %{y:.1f}%<br>%{text}<extra></extra>',
                      type: 'scatter',
                      mode: 'lines',
                      name: 'Distritos en Meta (%)',
                      line: { color: '#2ca02c', width: 3 },
                    }
                  ]}
                  layout={{
                    margin: { t: 10, r: 20, b: 50, l: 60 },
                    xaxis: { 
                      title: { text: 'Tiempo (Días de Operación)', font: { size: 12, color: theme2 === 'light' ? '#0f172a' : '#e0e0e0' } },
                      tickfont: { color: theme2 === 'light' ? '#0f172a' : '#e0e0e0' },
                      gridcolor: theme2 === 'light' ? '#cbd5e1' : 'rgba(255,255,255,0.05)'
                    },
                    yaxis: { 
                      title: { text: 'Porcentaje de Distritos en Meta (%)', font: { size: 12, color: theme2 === 'light' ? '#0f172a' : '#e0e0e0' } },
                      tickfont: { color: theme2 === 'light' ? '#0f172a' : '#e0e0e0' },
                      range: [0, 100],
                      gridcolor: theme2 === 'light' ? '#cbd5e1' : 'rgba(255,255,255,0.05)'
                    },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    font: { color: theme2 === 'light' ? '#0f172a' : '#e0e0e0' },
                    legend: { orientation: 'h', y: -0.3 },
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>Simulación de Escenarios (Comparativa)</h3>
                {sheet === 'Global' && (
                  <button 
                    onClick={handleDownloadReport}
                    className="download-report-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #10B981, #059669)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.9rem',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.15)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    }}
                  >
                    <span>📥</span> Descargar Reporte Excel
                  </button>
                )}
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Si cortamos el Día...</th>
                    <th>Cumplimiento Medio</th>
                    <th>Distritos &gt; Umbral de cumplimiento establecido</th>
                    <th>Distritos con 100%</th>
                    <th>Distritos en riesgo de llegar al Umbral establecido</th>
                  </tr>
                </thead>
                <tbody>
                  {data.scenarios.map((s) => (
                    <tr key={s.dia} className={s.dia === data.recommended_day ? 'highlight-row' : ''}>
                      <td>Día {s.dia} {s.dia === data.recommended_day && '🎯'}</td>
                      <td>{(s.media * 100).toFixed(1)}%</td>
                      <td>{s.pct_above_threshold.toFixed(1)}% ({s.count_above_threshold})</td>
                      <td>{s.pct_at_100.toFixed(1)}% ({s.count_at_100})</td>
                      <td className={s.distritos_en_riesgo > 50 ? 'danger-text' : ''}>
                        {s.distritos_en_riesgo}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.risk_districts.length > 0 && (
              <div className="chart-card wide alert-card" style={{marginTop: '20px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '15px'}}>
                  <div>
                    <h3 style={{marginTop: 0}}>⚠️ Top Distritos en Riesgo (Día {data.recommended_day})</h3>
                    <p style={{margin: 0}}>Estos distritos no alcanzarán el umbral del {(threshold*100).toFixed(0)}% si se recorta a {data.recommended_day} días.</p>
                  </div>
                  <button 
                    onClick={() => setShowCluster(!showCluster)}
                    style={{padding: '8px 15px', background: '#3A6BC5', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'}}
                  >
                    {showCluster ? 'Ocultar Análisis de Perfiles' : '📊 Analizar Perfiles de Riesgo'}
                  </button>
                </div>
                <div className="risk-grid-container">
                  {(showAllRisk ? data.risk_districts : data.risk_districts.slice(0, 20)).map((d, idx) => (
                    <div key={d.distrito} className="risk-item-new">
                      <span className="risk-number">{idx + 1}.</span>
                      <span className="risk-label">{d.distrito}</span>
                      <span className="risk-percent">{(d.cumplimiento * 100).toFixed(1)}%</span>
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

                {showCluster && data.risk_clusters && (
                  <div className="cluster-panel" style={{
                    marginTop: '25px', 
                    padding: '20px', 
                    background: theme3 === 'light' ? '#ffffff' : 'rgba(20, 20, 25, 0.4)', 
                    borderRadius: '8px', 
                    border: theme3 === 'light' ? '1px solid #cbd5e1' : '1px solid #333',
                    color: theme3 === 'light' ? '#0f172a' : '#e0e0e0'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: theme3 === 'light' ? '1px solid #cbd5e1' : '1px solid #444', paddingBottom: '10px', marginBottom: '15px' }}>
                      <h4 style={{ margin: 0, color: theme3 === 'light' ? '#1e3a8a' : '#4da6ff' }}>
                        Agrupación Inteligente (1D K-Means Clustering)
                      </h4>
                      <button 
                        className={`theme-toggle-btn ${theme3 === 'light' ? 'light' : 'dark'}`}
                        onClick={() => setTheme3(theme3 === 'light' ? 'dark' : 'light')}
                      >
                        {theme3 === 'light' ? '☀️ Claro' : '🌙 Oscuro'}
                      </button>
                    </div>
                    <p className="micro-text" style={{ marginBottom: '20px', color: theme3 === 'light' ? '#475569' : '#888' }}>
                      El algoritmo K-Means ha analizado matemáticamente la varianza en el déficit de estos distritos para clasificarlos en 3 perfiles de riesgo natural, permitiendo focalizar la atención donde es más urgente.
                    </p>

                    <div style={{marginBottom: '20px'}}>
                      <div style={{display: 'flex', justifyContent: 'flex-end', marginBottom: '10px'}}>
                        <div style={{background: theme3 === 'light' ? '#f1f5f9' : 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '4px', display: 'inline-flex', border: theme3 === 'light' ? '1px solid #cbd5e1' : 'none'}}>
                          <button 
                            onClick={() => setClusterChartType('bar')}
                            style={{
                              padding: '5px 10px', 
                              background: clusterChartType === 'bar' ? '#3A6BC5' : 'transparent', 
                              color: clusterChartType === 'bar' ? 'white' : (theme3 === 'light' ? '#475569' : '#aaa'), 
                              border: 'none', 
                              borderRadius: '3px', 
                              cursor: 'pointer',
                              fontWeight: '500'
                            }}
                          >
                            📊 Barras
                          </button>
                          <button 
                            onClick={() => setClusterChartType('scatter1')}
                            style={{
                              padding: '5px 10px', 
                              background: clusterChartType === 'scatter1' ? '#3A6BC5' : 'transparent', 
                              color: clusterChartType === 'scatter1' ? 'white' : (theme3 === 'light' ? '#475569' : '#aaa'), 
                              border: 'none', 
                              borderRadius: '3px', 
                              cursor: 'pointer',
                              fontWeight: '500'
                            }}
                          >
                            🔵 Dispersión 1
                          </button>
                          <button 
                            onClick={() => setClusterChartType('scatter2')}
                            style={{
                              padding: '5px 10px', 
                              background: clusterChartType === 'scatter2' ? '#3A6BC5' : 'transparent', 
                              color: clusterChartType === 'scatter2' ? 'white' : (theme3 === 'light' ? '#475569' : '#aaa'), 
                              border: 'none', 
                              borderRadius: '3px', 
                              cursor: 'pointer',
                              fontWeight: '500'
                            }}
                          >
                            🟢 Dispersión 2
                          </button>
                        </div>
                      </div>
                      <Plot
                        data={[
                          {
                            x: clusterChartType === 'scatter2'
                              ? data.risk_clusters.muy_lejos.distritos.map(d => (d.cumplimiento * 100).toFixed(1))
                              : data.risk_clusters.muy_lejos.distritos.map(d => d.distrito),
                            y: clusterChartType === 'scatter2'
                              ? data.risk_clusters.muy_lejos.distritos.map(d => getDeterministicJitter(d.distrito, 'muy_lejos'))
                              : data.risk_clusters.muy_lejos.distritos.map(d => (d.cumplimiento * 100).toFixed(1)),
                            text: data.risk_clusters.muy_lejos.distritos.map(d => d.distrito),
                            hovertemplate: clusterChartType === 'scatter2' ? 'Distrito: %{text}<br>Cumplimiento: %{x}%<extra></extra>' : undefined,
                            type: (clusterChartType === 'scatter1' || clusterChartType === 'scatter2') ? 'scatter' : 'bar',
                            mode: (clusterChartType === 'scatter1' || clusterChartType === 'scatter2') ? 'markers' : undefined,
                            name: 'Muy alejado',
                            marker: { 
                              color: '#ff3333', 
                              size: clusterChartType === 'scatter1' ? 12 : (clusterChartType === 'scatter2' ? 14 : undefined), 
                              opacity: clusterChartType === 'scatter2' ? 0.75 : undefined,
                              line: (clusterChartType === 'scatter1' || clusterChartType === 'scatter2') ? { color: 'white', width: 1 } : undefined 
                            }
                          },
                          {
                            x: clusterChartType === 'scatter2'
                              ? data.risk_clusters.medio.distritos.map(d => (d.cumplimiento * 100).toFixed(1))
                              : data.risk_clusters.medio.distritos.map(d => d.distrito),
                            y: clusterChartType === 'scatter2'
                              ? data.risk_clusters.medio.distritos.map(d => getDeterministicJitter(d.distrito, 'medio'))
                              : data.risk_clusters.medio.distritos.map(d => (d.cumplimiento * 100).toFixed(1)),
                            text: data.risk_clusters.medio.distritos.map(d => d.distrito),
                            hovertemplate: clusterChartType === 'scatter2' ? 'Distrito: %{text}<br>Cumplimiento: %{x}%<extra></extra>' : undefined,
                            type: (clusterChartType === 'scatter1' || clusterChartType === 'scatter2') ? 'scatter' : 'bar',
                            mode: (clusterChartType === 'scatter1' || clusterChartType === 'scatter2') ? 'markers' : undefined,
                            name: 'Medio',
                            marker: { 
                              color: '#ff7f0e', 
                              size: clusterChartType === 'scatter1' ? 12 : (clusterChartType === 'scatter2' ? 14 : undefined), 
                              opacity: clusterChartType === 'scatter2' ? 0.75 : undefined,
                              line: (clusterChartType === 'scatter1' || clusterChartType === 'scatter2') ? { color: 'white', width: 1 } : undefined 
                            }
                          },
                          {
                            x: clusterChartType === 'scatter2'
                              ? data.risk_clusters.muy_cerca.distritos.map(d => (d.cumplimiento * 100).toFixed(1))
                              : data.risk_clusters.muy_cerca.distritos.map(d => d.distrito),
                            y: clusterChartType === 'scatter2'
                              ? data.risk_clusters.muy_cerca.distritos.map(d => getDeterministicJitter(d.distrito, 'muy_cerca'))
                              : data.risk_clusters.muy_cerca.distritos.map(d => (d.cumplimiento * 100).toFixed(1)),
                            text: data.risk_clusters.muy_cerca.distritos.map(d => d.distrito),
                            hovertemplate: clusterChartType === 'scatter2' ? 'Distrito: %{text}<br>Cumplimiento: %{x}%<extra></extra>' : undefined,
                            type: (clusterChartType === 'scatter1' || clusterChartType === 'scatter2') ? 'scatter' : 'bar',
                            mode: (clusterChartType === 'scatter1' || clusterChartType === 'scatter2') ? 'markers' : undefined,
                            name: 'Muy cerca',
                            marker: { 
                              color: '#eab308', 
                              size: clusterChartType === 'scatter1' ? 12 : (clusterChartType === 'scatter2' ? 14 : undefined), 
                              opacity: clusterChartType === 'scatter2' ? 0.75 : undefined,
                              line: (clusterChartType === 'scatter1' || clusterChartType === 'scatter2') ? { color: 'white', width: 1 } : undefined 
                            }
                          }
                        ]}
                        layout={{
                          margin: { t: 20, r: 20, b: 80, l: 50 },
                          xaxis: { 
                            title: { text: clusterChartType === 'scatter2' ? 'Cumplimiento (%)' : '', font: { color: theme3 === 'light' ? '#0f172a' : '#e0e0e0' } }, 
                            tickangle: clusterChartType === 'scatter2' ? 0 : -45, 
                            font: { size: 10, color: theme3 === 'light' ? '#0f172a' : '#e0e0e0' },
                            tickfont: { color: theme3 === 'light' ? '#0f172a' : '#e0e0e0' },
                            gridcolor: theme3 === 'light' ? '#cbd5e1' : '#444'
                          },
                          yaxis: { 
                            title: { text: clusterChartType === 'scatter2' ? '' : 'Cumplimiento (%)', font: { size: 12, color: theme3 === 'light' ? '#0f172a' : '#e0e0e0' } },
                            tickfont: { color: theme3 === 'light' ? '#0f172a' : '#e0e0e0' },
                            showticklabels: clusterChartType !== 'scatter2',
                            gridcolor: clusterChartType === 'scatter2' ? 'rgba(0,0,0,0)' : (theme3 === 'light' ? '#cbd5e1' : '#444'),
                            showgrid: clusterChartType !== 'scatter2'
                          },
                          paper_bgcolor: 'rgba(0,0,0,0)',
                          plot_bgcolor: 'rgba(0,0,0,0)',
                          font: { color: theme3 === 'light' ? '#0f172a' : '#e0e0e0' },
                          legend: { orientation: 'h', y: 1.15 }
                        }}
                        useResizeHandler={true}
                        style={{ width: '100%', height: '300px' }}
                      />
                    </div>
                    
                    <div style={{display: 'flex', gap: '15px', flexWrap: 'wrap'}}>
                      {/* Muy Alejado */}
                      <div style={{
                        flex: 1, 
                        minWidth: '200px', 
                        background: theme3 === 'light' ? '#fef2f2' : 'rgba(255, 51, 51, 0.05)', 
                        padding: '15px', 
                        borderRadius: '5px', 
                        borderLeft: '4px solid #ff3333',
                        border: theme3 === 'light' ? '1px solid #fee2e2' : 'none',
                        borderLeftWidth: '4px'
                      }}>
                        <h5 style={{margin: '0 0 10px 0', color: theme3 === 'light' ? '#b91c1c' : '#ff8080'}}>🔴 Muy alejado de la marca ({data.risk_clusters.muy_lejos.distritos.length})</h5>
                        <div style={{fontSize: '0.85em', color: theme3 === 'light' ? '#4b5563' : '#ccc', marginBottom: '10px'}}>
                          Promedio faltante: <strong>{(data.risk_clusters.muy_lejos.promedio_deficit * 100).toFixed(1)}%</strong>
                        </div>
                        <ul style={{margin: 0, paddingLeft: '20px', fontSize: '0.85em', color: theme3 === 'light' ? '#374151' : '#e0e0e0'}}>
                          {data.risk_clusters.muy_lejos.distritos.map(d => (
                            <li key={d.distrito}>{d.distrito} ({(d.cumplimiento * 100).toFixed(1)}%)</li>
                          ))}
                          {data.risk_clusters.muy_lejos.distritos.length === 0 && <li>-</li>}
                        </ul>
                      </div>
                      
                      {/* Medio */}
                      <div style={{
                        flex: 1, 
                        minWidth: '200px', 
                        background: theme3 === 'light' ? '#fff7ed' : 'rgba(255, 127, 14, 0.05)', 
                        padding: '15px', 
                        borderRadius: '5px', 
                        borderLeft: '4px solid #ff7f0e',
                        border: theme3 === 'light' ? '1px solid #ffedd5' : 'none',
                        borderLeftWidth: '4px'
                      }}>
                        <h5 style={{margin: '0 0 10px 0', color: theme3 === 'light' ? '#c2410c' : '#ffaa55'}}>🟠 Medianamente alejado ({data.risk_clusters.medio.distritos.length})</h5>
                        <div style={{fontSize: '0.85em', color: theme3 === 'light' ? '#4b5563' : '#ccc', marginBottom: '10px'}}>
                          Promedio faltante: <strong>{(data.risk_clusters.medio.promedio_deficit * 100).toFixed(1)}%</strong>
                        </div>
                        <ul style={{margin: 0, paddingLeft: '20px', fontSize: '0.85em', color: theme3 === 'light' ? '#374151' : '#e0e0e0'}}>
                          {data.risk_clusters.medio.distritos.map(d => (
                            <li key={d.distrito}>{d.distrito} ({(d.cumplimiento * 100).toFixed(1)}%)</li>
                          ))}
                          {data.risk_clusters.medio.distritos.length === 0 && <li>-</li>}
                        </ul>
                      </div>
                      
                      {/* Muy Cerca */}
                      <div style={{
                        flex: 1, 
                        minWidth: '200px', 
                        background: theme3 === 'light' ? '#fefce8' : 'rgba(255, 204, 0, 0.05)', 
                        padding: '15px', 
                        borderRadius: '5px', 
                        borderLeft: '4px solid #eab308',
                        border: theme3 === 'light' ? '1px solid #fef08a' : 'none',
                        borderLeftWidth: '4px'
                      }}>
                        <h5 style={{margin: '0 0 10px 0', color: theme3 === 'light' ? '#854d0e' : '#ffe680'}}>🟡 Muy cerca de la marca ({data.risk_clusters.muy_cerca.distritos.length})</h5>
                        <div style={{fontSize: '0.85em', color: theme3 === 'light' ? '#4b5563' : '#ccc', marginBottom: '10px'}}>
                          Promedio faltante: <strong>{(data.risk_clusters.muy_cerca.promedio_deficit * 100).toFixed(1)}%</strong>
                        </div>
                        <ul style={{margin: 0, paddingLeft: '20px', fontSize: '0.85em', color: theme3 === 'light' ? '#374151' : '#e0e0e0'}}>
                          {data.risk_clusters.muy_cerca.distritos.map(d => (
                            <li key={d.distrito}>{d.distrito} ({(d.cumplimiento * 100).toFixed(1)}%)</li>
                          ))}
                          {data.risk_clusters.muy_cerca.distritos.length === 0 && <li>-</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Reductor;
