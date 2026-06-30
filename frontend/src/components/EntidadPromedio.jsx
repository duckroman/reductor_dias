import React, { useState, useEffect } from 'react';
import { 
  getEntidadesData, 
  uploadEntidadesFile, 
  getEntidadesClustering, 
  getEstadoDistritos 
} from '../services/api';
import PlotlyComponent from 'react-plotly.js';
import { AlertTriangle, TrendingDown, Target, CheckCircle2, Upload, Table, Map, Layers } from 'lucide-react';

const Plot = PlotlyComponent.default || PlotlyComponent;

const getDeterministicJitter = (distrito, clusterName) => {
  let hash = 0;
  for (let i = 0; i < distrito.length; i++) {
    hash = distrito.charCodeAt(i) + ((hash << 5) - hash);
  }
  const rawJitter = Math.abs(hash % 100) / 100;
  if (clusterName === 'muy_lejos') return 10 + rawJitter * 25;
  if (clusterName === 'medio') return 40 + rawJitter * 45;
  return 40 + rawJitter * 45;
};

const EntidadPromedio = ({ activeSheet }) => {
  // Averages dataset state
  const [entidadesData, setEntidadesData] = useState([]);
  const [filename, setFilename] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showTable, setShowTable] = useState(false);

  // Map & Selected State state
  const [geoJson, setGeoJson] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  // Removed stage selector; map will show both stage averages

  // Clustering state
  const [clusterK1, setClusterK1] = useState(3);
  const [clusterK2, setClusterK2] = useState(3);
  const [clustersStage1, setClustersStage1] = useState([]);
  const [clustersStage2, setClustersStage2] = useState([]);

  // Selected State Districts state
  const [districtData, setDistrictData] = useState(null);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [showAllRisk, setShowAllRisk] = useState(false);
  const [clusterChartType, setClusterChartType] = useState('bar');
  const [manualDay, setManualDay] = useState(0);

  // Themes
  const [theme1, setTheme1] = useState('dark');
  const [theme2, setTheme2] = useState('dark');
  const [theme3, setTheme3] = useState('dark');

  // Load Averages Dataset on mount
  useEffect(() => {
    loadData();
    fetch('/mexico_geo.json')
      .then(r => r.json())
      .then(data => setGeoJson(data))
      .catch(e => console.error('Error loading GeoJSON', e));
  }, []);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const res = await getEntidadesData();
      setEntidadesData(res.data || []);
      setFilename(res.filename || '');
    } catch (e) {
      console.error('Error loading entity averages', e);
    } finally {
      setLoadingData(false);
    }
  };

  // Load Clusters when K changes or data changes
  useEffect(() => {
    if (entidadesData.length === 0) return;
    const fetchClusters = async () => {
      try {
        const res1 = await getEntidadesClustering(1, clusterK1);
        setClustersStage1(res1.profiles || []);

        const res2 = await getEntidadesClustering(2, clusterK2);
        setClustersStage2(res2.profiles || []);
      } catch (e) {
        console.error('Error loading clusters', e);
      }
    };
    fetchClusters();
  }, [clusterK1, clusterK2, entidadesData]);

  // Load Selected State District data
  useEffect(() => {
    if (!selectedState) {
      setDistrictData(null);
      return;
    }
    const fetchDistricts = async () => {
      setLoadingDistricts(true);
      try {
        const res = await getEstadoDistritos(
          selectedState, 
          activeSheet, 
          manualDay === 0 ? null : manualDay
        );
        setDistrictData(res);
        if (manualDay === 0 && res && res.eval_day) {
          setManualDay(res.eval_day);
        }
      } catch (e) {
        console.error('Error loading district details', e);
      } finally {
        setLoadingDistricts(false);
      }
    };
    fetchDistricts();
  }, [selectedState, activeSheet, manualDay]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadEntidadesFile(file);
      setFilename(res.filename);
      await loadData();
      alert('Archivo de promedios estatales cargado con éxito.');
    } catch (err) {
      console.error(err);
      alert('Error al cargar el archivo de promedios estatales. Revise el formato.');
    } finally {
      setUploading(false);
    }
  };

  // Prepare map data
  const getMapPlot = () => {
    if (!geoJson || entidadesData.length === 0) return null;

    const stateMap = {};
    entidadesData.forEach(s => {
      if (s.Entidad) {
        stateMap[s.Entidad.toLowerCase().trim()] = s;
      }
    });

    const locations = geoJson.features.map(f => f.properties.name);
    const values = locations.map(name => {
      const s = stateMap[name.toLowerCase().trim()];
      if (!s) return 0;
      return s.E1_Promedio || 0; // use stage 1 for color scale
    });

    const hoverTexts = locations.map(name => {
      const s = stateMap[name.toLowerCase().trim()];
      if (!s) return `${name}: Sin datos`;
      const val1 = s.E1_Promedio || 0;
      const val2 = s.E2_Promedio || 0;
      return `<b>${name}</b><br>Promedio Etapa 1: ${val1.toFixed(2)} días<br>Promedio Etapa 2: ${val2.toFixed(2)} días`;
    });

    return (
      <Plot
        data={[{
          type: 'choropleth',
          geojson: geoJson,
          locations: locations,
          z: values,
          featureidkey: 'properties.name',
          colorscale: [
            [0, '#fce4f3'],
            [0.25, '#f5a0d8'],
            [0.5, '#e0449f'],
            [0.75, '#c2006e'],
            [1.0, '#8b004f']
          ],
          marker: {
            line: {
              color: selectedState ? locations.map(n =>
                n.toLowerCase().trim() === selectedState.toLowerCase().trim() ? '#d5007f' : 'rgba(213,0,127,0.25)'
              ) : 'rgba(213,0,127,0.25)',
              width: selectedState ? locations.map(n =>
                n.toLowerCase().trim() === selectedState.toLowerCase().trim() ? 3 : 0.7
              ) : 0.7,
            }
          },
          hoverinfo: 'text',
          text: hoverTexts,
          hoverlabel: {
            bgcolor: '#ffffff',
            bordercolor: '#d5007f',
            font: { family: 'Outfit, sans-serif', size: 13, color: '#1e0010' },
          },
          colorbar: {
            title: { text: 'Días', font: { color: '#6b0040', size: 12 } },
            tickfont: { color: '#6b0040' },
            len: 0.8,
          },
          selectedpoints: selectedState ? [locations.findIndex(l => l.toLowerCase().trim() === selectedState.toLowerCase().trim())] : undefined,
        }]}
        layout={{
          geo: {
            scope: 'north america',
            showframe: false,
            showcoastlines: false,
            showland: true,
            landcolor: '#fff0f9',
            showocean: true,
            oceancolor: '#f8e4f3',
            showlakes: false,
            projection: { type: 'mercator' },
            center: { lat: 23.6345, lon: -102.5528 },
            lonaxis: { range: [-118, -86] },
            lataxis: { range: [14, 33] },
            bgcolor: '#fdf2fa',
          },
          margin: { t: 0, r: 0, b: 0, l: 0 },
          paper_bgcolor: '#fdf2fa',
          plot_bgcolor: '#fdf2fa',
          font: { color: '#6b0040' },
          dragmode: false,
          height: 380,
        }}
        useResizeHandler={true}
        style={{ width: '100%' }}
        onClick={(event) => {
          if (event && event.points && event.points[0]) {
            const clickedState = event.points[0].location;
            if (clickedState) {
              setSelectedState(prev => prev === clickedState ? null : clickedState);
              setManualDay(0);
            }
          }
        }}
        config={{ displayModeBar: false, scrollZoom: false }}
      />
    );
  };

  return (
    <div className="dashboard-container ep-light">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#d5007f' }}>📊 Análisis de Promedios por Entidad y Clustering</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="sidebar-btn ep-action-btn" 
            onClick={() => setShowTable(!showTable)}
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Table size={16} /> {showTable ? 'Ocultar Dataset' : 'Ver Dataset'}
          </button>
          <label className="ep-upload-btn" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <Upload size={16} /> {uploading ? '⏳ Cargando...' : 'Cargar Dataset'}
            <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {filename && (
        <div className="ep-file-indicator" style={{ marginBottom: '20px', maxWidth: '350px' }}>
          <div className="ep-file-label">Archivo de Promedios Estatal</div>
          <span>{filename}</span>
        </div>
      )}

      {/* Visor de Dataset en formato Tabla Premium */}
      {showTable && entidadesData.length > 0 && (
        <div className="ep-panel animate-fade-in" style={{ marginBottom: '25px', overflowX: 'auto' }}>
          <h3 style={{ marginTop: 0, color: '#d5007f' }}>📋 Dataset Completo de Promedios por Entidad</h3>
          <table className="ep-table">
            <thead>
              <tr style={{ background: '#fce4f3' }}>
                <th>Circ.</th>
                <th>ID Estado</th>
                <th>Entidad</th>
                <th>E1 2017-2018</th>
                <th>E1 2020-2021</th>
                <th>E1 2023-2024</th>
                <th style={{ color: '#c084fc', fontWeight: 'bold' }}>E1 Promedio</th>
                <th>E2 2017-2018</th>
                <th>E2 2020-2021</th>
                <th>E2 2023-2024</th>
                <th style={{ color: '#c084fc', fontWeight: 'bold' }}>E2 Promedio</th>
              </tr>
            </thead>
            <tbody>
              {entidadesData.map((row, idx) => (
                <tr key={idx} className={selectedState?.toLowerCase() === row.Entidad?.toLowerCase() ? 'highlight-row' : ''}>
                  <td>{row.Circunscripción}</td>
                  <td>{row['ID Estado']}</td>
                  <td>{row.Entidad}</td>
                  <td>{row.E1_2017_2018}</td>
                  <td>{row.E1_2020_2021}</td>
                  <td>{row.E1_2023_2024}</td>
                  <td style={{ fontWeight: '600' }}>{row.E1_Promedio?.toFixed(2)}</td>
                  <td>{row.E2_2017_2018}</td>
                  <td>{row.E2_2020_2021}</td>
                  <td>{row.E2_2023_2024}</td>
                  <td style={{ fontWeight: '600' }}>{row.E2_Promedio?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid-2col" style={{ gap: '20px', marginBottom: '25px' }}>
        {/* Mapa de México */}
        <div className="ep-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#d5007f' }}>
              <Map size={18} /> Mapa de Promedios Estatales
            </h3>
          </div>
          <p className="explanation-text micro ep-text-muted" style={{ marginBottom: '15px' }}>
            Haga clic en un estado para ver la información de sus distritos agrupados bajo el umbral del 95% y sus gráficas de rendimiento.
          </p>
          <div style={{ background: '#fdf2fa', borderRadius: '12px', overflow: 'hidden' }}>
            {geoJson ? getMapPlot() : <div style={{ height: '350px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#9b5982' }}>Cargando mapa de México...</div>}
          </div>
          {selectedState && (
            <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(213,0,127,0.08)', border: '1px solid rgba(213,0,127,0.3)', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.9rem', color: '#8b004f' }}>🏛️ Estado seleccionado: <strong style={{ color: '#d5007f' }}>{selectedState}</strong></span>
              <button onClick={() => setSelectedState(null)} style={{ border: 'none', background: 'transparent', color: '#d5007f', cursor: 'pointer', fontWeight: 600 }}>Quitar filtro ✕</button>
            </div>
          )}
        </div>

        {/* Panel de Clustering */}
        <div className="ep-panel" style={{ padding: '20px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: '#d5007f' }}>
            <Layers size={18} /> Herramienta de Agrupamiento (Clusters)
          </h3>
          <p className="explanation-text micro ep-text-muted" style={{ marginBottom: '20px' }}>
            Permite agrupar los estados en 2, 3, 4 y 5 grupos homogéneos según sus promedios históricos en cada etapa.
          </p>

          {/* Clusters Etapa 1 */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, color: '#8b004f' }}>1ª Etapa de Capacitación</h4>
              <div style={{ display: 'flex', gap: '5px' }}>
                {[2, 3, 4, 5].map(k => (
                  <button 
                    key={k} 
                    onClick={() => setClusterK1(k)}
                    className={`ep-k-btn ${clusterK1 === k ? 'active' : ''}`}
                  >
                    K={k}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${clusterK1}, 1fr)`, gap: '10px', alignItems: 'start' }}>
              {clustersStage1.map((c, idx) => (
                <div key={idx} className="ep-cluster-col" style={{ borderTop: `3px solid hsl(${320 + idx * (80/Math.max(clusterK1-1,1))}, 75%, 40%)` }}>
                  <div className="ep-cluster-header" style={{ color: `hsl(${320 + idx * (80/Math.max(clusterK1-1,1))}, 75%, 35%)` }}>
                    <strong>Grupo {idx + 1}</strong>
                    <span className="ep-cluster-range">{c.min_val.toFixed(1)}–{c.max_val.toFixed(1)} días</span>
                  </div>
                  <ul className="ep-cluster-list">
                    {c.estados.map(est => (
                      <li key={est.Entidad} className="ep-cluster-item">
                        <span className="ep-cluster-state">{est.Entidad}</span>
                        <span className="ep-cluster-days">{(est.E1_Promedio ?? est.promedio ?? est.value ?? 0).toFixed(1)} d</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Clusters Etapa 2 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, color: '#8b004f' }}>2ª Etapa de Nombramientos</h4>
              <div style={{ display: 'flex', gap: '5px' }}>
                {[2, 3, 4, 5].map(k => (
                  <button 
                    key={k} 
                    onClick={() => setClusterK2(k)}
                    className={`ep-k-btn ${clusterK2 === k ? 'active' : ''}`}
                  >
                    K={k}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${clusterK2}, 1fr)`, gap: '10px', alignItems: 'start' }}>
              {clustersStage2.map((c, idx) => (
                <div key={idx} className="ep-cluster-col" style={{ borderTop: `3px solid hsl(${200 + idx * (80/Math.max(clusterK2-1,1))}, 75%, 40%)` }}>
                  <div className="ep-cluster-header" style={{ color: `hsl(${200 + idx * (80/Math.max(clusterK2-1,1))}, 75%, 35%)` }}>
                    <strong>Grupo {idx + 1}</strong>
                    <span className="ep-cluster-range">{c.min_val.toFixed(1)}–{c.max_val.toFixed(1)} días</span>
                  </div>
                  <ul className="ep-cluster-list">
                    {c.estados.map(est => (
                      <li key={est.Entidad} className="ep-cluster-item">
                        <span className="ep-cluster-state">{est.Entidad}</span>
                        <span className="ep-cluster-days">{(est.E2_Promedio ?? est.promedio ?? est.value ?? 0).toFixed(1)} d</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Desglose de Distritos del Estado Seleccionado */}
      {selectedState && (
        <div className="ep-panel animate-fade-in" style={{ borderLeft: '4px solid #d5007f' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#d5007f' }}>🏛️ Análisis Detallado de Distritos en {selectedState} (Umbral de 95%)</h3>
            {districtData && (
              <span className="micro-text" style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
                Rubro: {districtData.sheet} | Días del dataset: {districtData.dias.length}
              </span>
            )}
          </div>

          {loadingDistricts ? (
            <div className="loading">Cargando datos de distritos de {selectedState}...</div>
          ) : !districtData || districtData.total_districts === 0 ? (
            <div className="loading" style={{ color: '#f87171' }}>No hay datos detallados de distritos disponibles para este estado en el dataset activo.</div>
          ) : (
            <>
              {/* Slider de Día del Estado */}
              <div className="controls panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <div className="control-group" style={{ margin: 0 }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>Día de Evaluación en Distritos:</strong> Día {manualDay}</span>
                    <span className="micro-text" style={{ color: '#94a3b8' }}>Ajuste para analizar la distribución en esta fecha</span>
                  </label>
                  <input 
                    type="range" 
                    min="1" max={districtData.dias.length} step="1"
                    value={manualDay} 
                    onChange={(e) => setManualDay(parseInt(e.target.value))}
                    className="slider"
                  />
                </div>
              </div>

              {/* KPIs de los distritos del estado */}
              <div className="kpi-grid" style={{ marginBottom: '25px' }}>
                <div className="kpi-card highlight">
                  <div className="kpi-icon"><Target /></div>
                  <div className="kpi-content">
                    <h3>Total Distritos</h3>
                    <div className="kpi-value highlight-value">{districtData.total_districts}</div>
                    <span className="micro-text">En la entidad</span>
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-icon"><CheckCircle2 /></div>
                  <div className="kpi-content">
                    <h3>Cumplimiento Promedio</h3>
                    <div className="kpi-value">
                      {(districtData.mean_by_day[manualDay - 1] * 100).toFixed(1)}%
                    </div>
                    <span className="micro-text">Día {manualDay}</span>
                  </div>
                </div>
                <div className="kpi-card alert">
                  <div className="kpi-icon"><AlertTriangle /></div>
                  <div className="kpi-content">
                    <h3>Rezagados (&lt; 95%)</h3>
                    <div className="kpi-value">
                      {districtData.risk_clusters.medio.distritos.length + districtData.risk_clusters.muy_lejos.distritos.length}
                    </div>
                    <span className="micro-text">Bajo el umbral del 95%</span>
                  </div>
                </div>
              </div>

              {/* Agrupamiento de Distritos por Cercanía al 95% */}
              <div className="cluster-panel" style={{
                padding: '20px', 
                background: theme3 === 'light' ? '#ffffff' : 'rgba(20, 20, 25, 0.4)', 
                borderRadius: '8px', 
                border: theme3 === 'light' ? '1px solid #cbd5e1' : '1px solid #333',
                color: theme3 === 'light' ? '#0f172a' : '#e0e0e0',
                marginBottom: '25px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: theme3 === 'light' ? '1px solid #cbd5e1' : '1px solid #444', paddingBottom: '10px', marginBottom: '15px' }}>
                  <h4 style={{ margin: 0, color: '#a78bfa' }}>
                    Agrupación de Distritos por Cercanía al 95% de Cumplimiento
                  </h4>
                  <button 
                    className={`theme-toggle-btn ${theme3 === 'light' ? 'light' : 'dark'}`}
                    onClick={() => setTheme3(theme3 === 'light' ? 'dark' : 'light')}
                  >
                    {theme3 === 'light' ? '☀️ Claro' : '🌙 Oscuro'}
                  </button>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                    <div style={{ background: theme3 === 'light' ? '#f1f5f9' : 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '4px', display: 'inline-flex', border: theme3 === 'light' ? '1px solid #cbd5e1' : 'none' }}>
                      <button 
                        onClick={() => setClusterChartType('bar')}
                        className={`theme-toggle-btn ${clusterChartType === 'bar' ? 'active' : ''}`}
                        style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: '4px' }}
                      >
                        📊 Barras
                      </button>
                      <button 
                        onClick={() => setClusterChartType('scatter1')}
                        className={`theme-toggle-btn ${clusterChartType === 'scatter1' ? 'active' : ''}`}
                        style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: '4px' }}
                      >
                        🔵 Dispersión 1
                      </button>
                      <button 
                        onClick={() => setClusterChartType('scatter2')}
                        className={`theme-toggle-btn ${clusterChartType === 'scatter2' ? 'active' : ''}`}
                        style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: '4px' }}
                      >
                        🟢 Dispersión 2
                      </button>
                    </div>
                  </div>
                  
                  <Plot
                    data={[
                      {
                        x: clusterChartType === 'scatter2'
                          ? districtData.risk_clusters.muy_lejos.distritos.map(d => (d.cumplimiento * 100).toFixed(1))
                          : districtData.risk_clusters.muy_lejos.distritos.map(d => d.distrito),
                        y: clusterChartType === 'scatter2'
                          ? districtData.risk_clusters.muy_lejos.distritos.map(d => getDeterministicJitter(d.distrito, 'muy_lejos'))
                          : districtData.risk_clusters.muy_lejos.distritos.map(d => (d.cumplimiento * 100).toFixed(1)),
                        text: districtData.risk_clusters.muy_lejos.distritos.map(d => d.distrito),
                        hovertemplate: clusterChartType === 'scatter2' ? 'Distrito: %{text}<br>Cumplimiento: %{x}%<extra></extra>' : undefined,
                        type: (clusterChartType === 'scatter1' || clusterChartType === 'scatter2') ? 'scatter' : 'bar',
                        mode: (clusterChartType === 'scatter1' || clusterChartType === 'scatter2') ? 'markers' : undefined,
                        name: 'Muy alejado del 95%',
                        marker: { 
                          color: '#ff3333', 
                          size: clusterChartType === 'scatter1' ? 12 : (clusterChartType === 'scatter2' ? 14 : undefined), 
                          opacity: clusterChartType === 'scatter2' ? 0.75 : undefined,
                        }
                      },
                      {
                        x: clusterChartType === 'scatter2'
                          ? districtData.risk_clusters.medio.distritos.map(d => (d.cumplimiento * 100).toFixed(1))
                          : districtData.risk_clusters.medio.distritos.map(d => d.distrito),
                        y: clusterChartType === 'scatter2'
                          ? districtData.risk_clusters.medio.distritos.map(d => getDeterministicJitter(d.distrito, 'medio'))
                          : districtData.risk_clusters.medio.distritos.map(d => (d.cumplimiento * 100).toFixed(1)),
                        text: districtData.risk_clusters.medio.distritos.map(d => d.distrito),
                        hovertemplate: clusterChartType === 'scatter2' ? 'Distrito: %{text}<br>Cumplimiento: %{x}%<extra></extra>' : undefined,
                        type: (clusterChartType === 'scatter1' || clusterChartType === 'scatter2') ? 'scatter' : 'bar',
                        mode: (clusterChartType === 'scatter1' || clusterChartType === 'scatter2') ? 'markers' : undefined,
                        name: 'Medianamente alejado del 95%',
                        marker: { 
                          color: '#ff7f0e', 
                          size: clusterChartType === 'scatter1' ? 12 : (clusterChartType === 'scatter2' ? 14 : undefined), 
                          opacity: clusterChartType === 'scatter2' ? 0.75 : undefined,
                        }
                      },
                      {
                        x: clusterChartType === 'scatter2'
                          ? districtData.risk_clusters.muy_cerca.distritos.map(d => (d.cumplimiento * 100).toFixed(1))
                          : districtData.risk_clusters.muy_cerca.distritos.map(d => d.distrito),
                        y: clusterChartType === 'scatter2'
                          ? districtData.risk_clusters.muy_cerca.distritos.map(d => getDeterministicJitter(d.distrito, 'muy_cerca'))
                          : districtData.risk_clusters.muy_cerca.distritos.map(d => (d.cumplimiento * 100).toFixed(1)),
                        text: districtData.risk_clusters.muy_cerca.distritos.map(d => d.distrito),
                        hovertemplate: clusterChartType === 'scatter2' ? 'Distrito: %{text}<br>Cumplimiento: %{x}%<extra></extra>' : undefined,
                        type: (clusterChartType === 'scatter1' || clusterChartType === 'scatter2') ? 'scatter' : 'bar',
                        mode: (clusterChartType === 'scatter1' || clusterChartType === 'scatter2') ? 'markers' : undefined,
                        name: 'Cercano o por encima del 95%',
                        marker: { 
                          color: '#10b981', 
                          size: clusterChartType === 'scatter1' ? 12 : (clusterChartType === 'scatter2' ? 14 : undefined), 
                          opacity: clusterChartType === 'scatter2' ? 0.75 : undefined,
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
                        title: { text: 'Cumplimiento (%)', font: { size: 12, color: theme3 === 'light' ? '#0f172a' : '#e0e0e0' } },
                        tickfont: { color: theme3 === 'light' ? '#0f172a' : '#e0e0e0' },
                        showticklabels: clusterChartType !== 'scatter2',
                        gridcolor: clusterChartType === 'scatter2' ? 'rgba(0,0,0,0)' : (theme3 === 'light' ? '#cbd5e1' : '#444'),
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

                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                  {/* Muy Alejado */}
                  <div style={{
                    flex: 1, 
                    minWidth: '220px', 
                    background: theme3 === 'light' ? '#fef2f2' : 'rgba(255, 51, 51, 0.05)', 
                    padding: '15px', 
                    borderRadius: '5px', 
                    borderLeft: '4px solid #ff3333',
                    border: theme3 === 'light' ? '1px solid #fee2e2' : 'none',
                    borderLeftWidth: '4px'
                  }}>
                    <h5 style={{ margin: '0 0 10px 0', color: theme3 === 'light' ? '#b91c1c' : '#ff8080' }}>🔴 Muy alejado del 95% ({districtData.risk_clusters.muy_lejos.distritos.length})</h5>
                    <div style={{ fontSize: '0.85em', color: theme3 === 'light' ? '#4b5563' : '#ccc', marginBottom: '10px' }}>
                      Déficit promedio: <strong>{(districtData.risk_clusters.muy_lejos.promedio_deficit * 100).toFixed(1)}%</strong>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85em', color: theme3 === 'light' ? '#374151' : '#e0e0e0' }}>
                      {districtData.risk_clusters.muy_lejos.distritos.map(d => (
                        <li key={d.distrito}>{d.distrito} ({(d.cumplimiento * 100).toFixed(1)}%)</li>
                      ))}
                      {districtData.risk_clusters.muy_lejos.distritos.length === 0 && <li>Ninguno</li>}
                    </ul>
                  </div>

                  {/* Medio */}
                  <div style={{
                    flex: 1, 
                    minWidth: '220px', 
                    background: theme3 === 'light' ? '#fff7ed' : 'rgba(255, 127, 14, 0.05)', 
                    padding: '15px', 
                    borderRadius: '5px', 
                    borderLeft: '4px solid #ff7f0e',
                    border: theme3 === 'light' ? '1px solid #ffedd5' : 'none',
                    borderLeftWidth: '4px'
                  }}>
                    <h5 style={{ margin: '0 0 10px 0', color: theme3 === 'light' ? '#c2410c' : '#ffaa55' }}>🟠 Medianamente alejado ({districtData.risk_clusters.medio.distritos.length})</h5>
                    <div style={{ fontSize: '0.85em', color: theme3 === 'light' ? '#4b5563' : '#ccc', marginBottom: '10px' }}>
                      Déficit promedio: <strong>{(districtData.risk_clusters.medio.promedio_deficit * 100).toFixed(1)}%</strong>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85em', color: theme3 === 'light' ? '#374151' : '#e0e0e0' }}>
                      {districtData.risk_clusters.medio.distritos.map(d => (
                        <li key={d.distrito}>{d.distrito} ({(d.cumplimiento * 100).toFixed(1)}%)</li>
                      ))}
                      {districtData.risk_clusters.medio.distritos.length === 0 && <li>Ninguno</li>}
                    </ul>
                  </div>

                  {/* Cercanos o encima */}
                  <div style={{
                    flex: 1, 
                    minWidth: '220px', 
                    background: theme3 === 'light' ? '#f0fdf4' : 'rgba(16, 185, 129, 0.05)', 
                    padding: '15px', 
                    borderRadius: '5px', 
                    borderLeft: '4px solid #10b981',
                    border: theme3 === 'light' ? '1px solid #dcfce7' : 'none',
                    borderLeftWidth: '4px'
                  }}>
                    <h5 style={{ margin: '0 0 10px 0', color: theme3 === 'light' ? '#15803d' : '#80ffc0' }}>🟢 Cercano o encima del 95% ({districtData.risk_clusters.muy_cerca.distritos.length})</h5>
                    <div style={{ fontSize: '0.85em', color: theme3 === 'light' ? '#4b5563' : '#ccc', marginBottom: '10px' }}>
                      Distritos con cumplimiento sólido
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85em', color: theme3 === 'light' ? '#374151' : '#e0e0e0' }}>
                      {districtData.risk_clusters.muy_cerca.distritos.map(d => (
                        <li key={d.distrito}>
                          {d.distrito} ({(d.cumplimiento * 100).toFixed(1)}%) {d.status ? '✅' : ''}
                        </li>
                      ))}
                      {districtData.risk_clusters.muy_cerca.distritos.length === 0 && <li>Ninguno</li>}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Gráficas adicionales (Progreso vs Marginal, Cobertura, Simulación) */}
              <div className="charts-grid">
                {/* 1. Progreso vs Marginal */}
                <div className={`chart-card ${theme1 === 'light' ? 'light-theme' : ''}`}>
                  <div className="chart-card-header">
                    <h3>📈 Progreso Acumulado vs Rendimiento Marginal ({selectedState})</h3>
                    <button 
                      className={`theme-toggle-btn ${theme1 === 'light' ? 'light' : 'dark'}`}
                      onClick={() => setTheme1(theme1 === 'light' ? 'dark' : 'light')}
                    >
                      {theme1 === 'light' ? '☀️ Claro' : '🌙 Oscuro'}
                    </button>
                  </div>
                  <div className="chart-wrapper">
                    <Plot
                      data={[
                        {
                          x: districtData.dias,
                          y: districtData.mean_by_day.map(v => v * 100),
                          type: 'scatter',
                          mode: 'lines',
                          name: 'Progreso Acumulado (%)',
                          line: { color: '#8b5cf6', width: 3 },
                          yaxis: 'y1',
                        },
                        {
                          x: districtData.dias,
                          y: districtData.marginal_returns.map(v => v * 100),
                          type: 'bar',
                          name: 'Avance Diario (%)',
                          marker: { color: 'rgba(167, 139, 250, 0.4)' },
                          yaxis: 'y2',
                        }
                      ]}
                      layout={{
                        margin: { t: 10, r: 50, b: 50, l: 60 },
                        xaxis: { 
                          title: { text: 'Días de Operación', font: { color: theme1 === 'light' ? '#0f172a' : '#e0e0e0' } },
                          tickfont: { color: theme1 === 'light' ? '#0f172a' : '#e0e0e0' },
                          gridcolor: theme1 === 'light' ? '#cbd5e1' : 'rgba(255,255,255,0.05)'
                        },
                        yaxis: { 
                          title: { text: 'Progreso (%)', font: { color: theme1 === 'light' ? '#0f172a' : '#e0e0e0' } },
                          tickfont: { color: theme1 === 'light' ? '#0f172a' : '#e0e0e0' },
                          range: [0, 100],
                          gridcolor: theme1 === 'light' ? '#cbd5e1' : 'rgba(255,255,255,0.05)'
                        },
                        yaxis2: { 
                          title: { text: 'Avance Diario (%)', font: { color: theme1 === 'light' ? '#0f172a' : '#e0e0e0' } },
                          tickfont: { color: theme1 === 'light' ? '#0f172a' : '#e0e0e0' },
                          overlaying: 'y', 
                          side: 'right',
                          range: [0, Math.max(...districtData.marginal_returns) * 120] 
                        },
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        font: { color: theme1 === 'light' ? '#0f172a' : '#e0e0e0' },
                        legend: { orientation: 'h', y: -0.3 }
                      }}
                      useResizeHandler={true}
                      style={{ width: '100%', height: '320px' }}
                    />
                  </div>
                </div>

                {/* 2. Cobertura Probabilística */}
                <div className={`chart-card ${theme2 === 'light' ? 'light-theme' : ''}`}>
                  <div className="chart-card-header">
                    <h3>🗺️ Cobertura de Distritos en {selectedState} (&gt;= 95%)</h3>
                    <button 
                      className={`theme-toggle-btn ${theme2 === 'light' ? 'light' : 'dark'}`}
                      onClick={() => setTheme2(theme2 === 'light' ? 'dark' : 'light')}
                    >
                      {theme2 === 'light' ? '☀️ Claro' : '🌙 Oscuro'}
                    </button>
                  </div>
                  <div className="chart-wrapper">
                    <Plot
                      data={[
                        {
                          x: districtData.dias,
                          y: districtData.coverage_by_day.map(v => v * 100),
                          text: (districtData.counts_by_day || []).map(c => `(${c} distritos)`),
                          hovertemplate: 'Día %{x}<br>Cobertura: %{y:.1f}%<br>%{text}<extra></extra>',
                          type: 'scatter',
                          mode: 'lines',
                          name: 'Distritos >= 95% (%)',
                          line: { color: '#10b981', width: 3 },
                        }
                      ]}
                      layout={{
                        margin: { t: 10, r: 20, b: 50, l: 60 },
                        xaxis: { 
                          title: { text: 'Días de Operación', font: { color: theme2 === 'light' ? '#0f172a' : '#e0e0e0' } },
                          tickfont: { color: theme2 === 'light' ? '#0f172a' : '#e0e0e0' },
                          gridcolor: theme2 === 'light' ? '#cbd5e1' : 'rgba(255,255,255,0.05)'
                        },
                        yaxis: { 
                          title: { text: 'Distritos en Meta (%)', font: { color: theme2 === 'light' ? '#0f172a' : '#e0e0e0' } },
                          tickfont: { color: theme2 === 'light' ? '#0f172a' : '#e0e0e0' },
                          range: [0, 100],
                          gridcolor: theme2 === 'light' ? '#cbd5e1' : 'rgba(255,255,255,0.05)'
                        },
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        font: { color: theme2 === 'light' ? '#0f172a' : '#e0e0e0' },
                        legend: { orientation: 'h', y: -0.3 }
                      }}
                      useResizeHandler={true}
                      style={{ width: '100%', height: '320px' }}
                    />
                  </div>
                </div>

                {/* 3. Simulación de Escenarios */}
                <div className="chart-card wide">
                  <h3>Simulación de Escenarios (Estado: {selectedState})</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Si cortamos el Día...</th>
                        <th>Cumplimiento Medio</th>
                        <th>Mediana</th>
                        <th>Distritos &gt;= 95% (Cobertura)</th>
                        <th>En Riesgo (&lt; 95%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {districtData.scenarios.map((s) => (
                        <tr key={s.dia} className={s.dia === manualDay ? 'highlight-row' : ''}>
                          <td>Día {s.dia} {s.dia === manualDay && '🎯'}</td>
                          <td>{(s.media * 100).toFixed(1)}%</td>
                          <td>{(s.mediana * 100).toFixed(1)}%</td>
                          <td>{s.pct_above_threshold.toFixed(1)}% ({s.count_above_threshold})</td>
                          <td className={s.distritos_en_riesgo > 0 ? 'danger-text' : ''}>
                            {s.distritos_en_riesgo}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default EntidadPromedio;
