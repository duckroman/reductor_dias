import React, { useState, useEffect } from 'react';
import {
  getEntidadesData,
  uploadEntidadesFile,
  getEntidadesClustering,
} from '../services/api';
import PlotlyComponent from 'react-plotly.js';
import { Upload, Table, Map, Layers } from 'lucide-react';

const Plot = PlotlyComponent.default || PlotlyComponent;

const GROUP_COLORS = [
  '#d5007f', // Magenta principal del tema
  '#a855f7', // Violeta moderno
  '#6366f1', // Índigo premium
  '#0ea5e9', // Azul cyan limpio
  '#14b8a6', // Teal fresco
];
const NO_DATA_COLOR = '#f1f5f9';

const STATE_ALIASES = {
  'estado de mexico': 'mexico',
  'edo de mexico': 'mexico',
  'edomex': 'mexico',
  cdmx: 'ciudad de mexico',
  'ciudad mexico': 'ciudad de mexico',
  'ciudad de mexico': 'ciudad de mexico',
  'veracruz de ignacio de la llave': 'veracruz',
  'coahuila de zaragoza': 'coahuila',
  'michoacan de ocampo': 'michoacan',
};

const normalizeText = (value = '') => {
  const normalized = String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  return STATE_ALIASES[normalized] || normalized;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getStageAverage = (row, stage) => {
  if (!row) return 0;
  const field = stage === 1 ? 'E1_Promedio' : 'E2_Promedio';
  return toNumber(row[field] ?? row.promedio ?? row.value, 0);
};

const buildGradientColorscale = (colors) => {
  const maxIndex = Math.max(colors.length - 1, 1);

  return colors.map((color, index) => [index / maxIndex, color]);
};

const EntidadPromedio = () => {
  // Averages dataset state
  const [entidadesData, setEntidadesData] = useState([]);
  const [filename, setFilename] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showTable, setShowTable] = useState(false);

  // Map & selected state state
  const [geoJson, setGeoJson] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [mapStage, setMapStage] = useState(1);

  // Clustering state
  const [clusterK1, setClusterK1] = useState(3);
  const [clusterK2, setClusterK2] = useState(3);
  const [clustersStage1, setClustersStage1] = useState([]);
  const [clustersStage2, setClustersStage2] = useState([]);

  const activeClusters = mapStage === 1 ? clustersStage1 : clustersStage2;
  const activeK = mapStage === 1 ? clusterK1 : clusterK2;
  const activeStageLabel = mapStage === 1 ? '1ª Etapa de Capacitación' : '2ª Etapa de Nombramientos';
  const activeStageShortLabel = mapStage === 1 ? 'Etapa 1' : 'Etapa 2';

  // Load averages dataset and Mexico GeoJSON on mount
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

  // Load clusters when K changes or data changes
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

  const buildEntityMap = () => {
    const stateMap = {};

    entidadesData.forEach(s => {
      if (s.Entidad) {
        stateMap[normalizeText(s.Entidad)] = s;
      }
    });

    return stateMap;
  };

  const buildClusterLookup = (clusters) => {
    const lookup = {};

    clusters.forEach((cluster, clusterIndex) => {
      (cluster.estados || []).forEach(est => {
        if (!est.Entidad) return;

        lookup[normalizeText(est.Entidad)] = {
          group: clusterIndex + 1,
          color: GROUP_COLORS[clusterIndex % GROUP_COLORS.length],
          cluster,
          estado: est,
        };
      });
    });

    return lookup;
  };

  const getSelectedStateInfo = () => {
    if (!selectedState) return null;

    const stateMap = buildEntityMap();
    const clusterLookup = buildClusterLookup(activeClusters);
    const key = normalizeText(selectedState);
    const stateData = stateMap[key];
    const clusterData = clusterLookup[key];

    return {
      promedio: getStageAverage(stateData, mapStage),
      grupo: clusterData?.group || null,
      color: clusterData?.color || NO_DATA_COLOR,
      hasData: Boolean(stateData),
    };
  };

  // Prepare map data. The map now follows the active stage/K from the clustering tool.
  const getMapPlot = () => {
    if (!geoJson || entidadesData.length === 0) return null;

    const stateMap = buildEntityMap();
    const clusterLookup = buildClusterLookup(activeClusters);

    const locations = geoJson.features.map(f => f.properties.name);

    const values = locations.map(name => {
      const clusterInfo = clusterLookup[normalizeText(name)];
      return clusterInfo?.group || 0;
    });

    const hoverTexts = locations.map(name => {
      const key = normalizeText(name);
      const stateData = stateMap[key];
      const clusterInfo = clusterLookup[key];

      if (!stateData) return `<b>${name}</b><br>Sin datos`;

      const average = getStageAverage(stateData, mapStage);
      const groupText = clusterInfo?.group ? `Grupo ${clusterInfo.group}` : 'Sin grupo asignado';

      return `<b>${name}</b><br>${activeStageLabel}: ${average.toFixed(2)} días<br>${groupText}<br>K=${activeK}`;
    });

    const colorscale = buildGradientColorscale([
      NO_DATA_COLOR,
      ...GROUP_COLORS.slice(0, activeK),
    ]);

    return (
      <Plot
        data={[
          {
            type: 'choropleth',
            geojson: geoJson,
            locations,
            z: values,
            zmin: 0,
            zmax: activeK,
            featureidkey: 'properties.name',
            colorscale,
            showscale: true,
            marker: {
              line: {
                color: selectedState
                  ? locations.map(n =>
                    normalizeText(n) === normalizeText(selectedState)
                      ? '#111827'
                      : 'rgba(255,255,255,0.85)'
                  )
                  : 'rgba(255,255,255,0.85)',
                width: selectedState
                  ? locations.map(n =>
                    normalizeText(n) === normalizeText(selectedState) ? 3 : 0.8
                  )
                  : 0.8,
              },
            },
            hoverinfo: 'text',
            text: hoverTexts,
            hoverlabel: {
              bgcolor: '#ffffff',
              bordercolor: '#d5007f',
              font: { family: 'Outfit, sans-serif', size: 13, color: '#1e0010' },
            },
            colorbar: {
              title: {
                text: '<b>Grupos</b>',
                side: 'top',
                font: { color: '#6b0040', size: 13 },
              },
              tickmode: 'array',
              tickvals: Array.from({ length: activeK }, (_, idx) => idx + 1),
              ticktext: Array.from({ length: activeK }, (_, idx) => `Grupo ${idx + 1}`),
              tickfont: {
                color: '#6b0040',
                size: 11,
                family: 'Outfit, sans-serif',
              },
              thickness: 16,
              len: 0.72,
              xpad: 12,
              ypad: 8,
              bgcolor: 'rgba(255,255,255,0.72)',
              bordercolor: 'rgba(213,0,127,0.18)',
              borderwidth: 1,
              outlinewidth: 0,
            },
          },
        ]}
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
          margin: { t: 0, r: 20, b: 0, l: 0 },
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
              setSelectedState(prev => (prev === clickedState ? null : clickedState));
            }
          }
        }}
        config={{ displayModeBar: false, scrollZoom: false }}
      />
    );
  };

  const selectedStateInfo = getSelectedStateInfo();

  return (
    <div className="dashboard-container ep-light" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
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
                <tr key={idx} className={normalizeText(selectedState) === normalizeText(row.Entidad) ? 'highlight-row' : ''}>
                  <td>{row.Circunscripción}</td>
                  <td>{row['ID Estado']}</td>
                  <td>{row.Entidad}</td>
                  <td>{row.E1_2017_2018}</td>
                  <td>{row.E1_2020_2021}</td>
                  <td>{row.E1_2023_2024}</td>
                  <td style={{ fontWeight: '600' }}>{toNumber(row.E1_Promedio).toFixed(2)}</td>
                  <td>{row.E2_2017_2018}</td>
                  <td>{row.E2_2020_2021}</td>
                  <td>{row.E2_2023_2024}</td>
                  <td style={{ fontWeight: '600' }}>{toNumber(row.E2_Promedio).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mapa de México — dinámico por etapa y K activo */}
      <div className="ep-panel" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', gap: '12px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#d5007f' }}>
            <Map size={18} /> Mapa de Clusters Estatales
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: '#8b004f', background: 'rgba(213,0,127,0.08)', border: '1px solid rgba(213,0,127,0.25)', padding: '6px 10px', borderRadius: '999px', fontWeight: 600 }}>
              Visualizando: {activeStageShortLabel} · K={activeK}
            </span>
          </div>
        </div>
        <p className="explanation-text micro ep-text-muted" style={{ marginBottom: '15px' }}>
          El mapa se actualiza con la etapa y el valor K que manipules en la herramienta de agrupamiento. Cada color representa un grupo; al pasar el cursor se muestra únicamente el promedio de la etapa activa.
        </p>
        <div style={{ background: '#fdf2fa', borderRadius: '12px', overflow: 'hidden' }}>
          {geoJson && !loadingData ? getMapPlot() : (
            <div style={{ height: '350px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#9b5982' }}>
              Cargando mapa de México...
            </div>
          )}
        </div>
        {selectedState && (
          <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(213,0,127,0.08)', border: '1px solid rgba(213,0,127,0.3)', borderRadius: '6px', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.9rem', color: '#8b004f' }}>
                🏛️ Estado seleccionado: <strong style={{ color: '#d5007f' }}>{selectedState}</strong>
              </span>
              <span style={{ fontSize: '0.85rem', color: '#8b004f' }}>
                {selectedStateInfo?.hasData
                  ? `${activeStageLabel}: ${selectedStateInfo.promedio.toFixed(2)} días · ${selectedStateInfo.grupo ? `Grupo ${selectedStateInfo.grupo}` : 'Sin grupo asignado'}`
                  : 'Sin datos para la etapa activa'}
              </span>
            </div>
            <button onClick={() => setSelectedState(null)} style={{ border: 'none', background: 'transparent', color: '#d5007f', cursor: 'pointer', fontWeight: 600 }}>
              Quitar selección ✕
            </button>
          </div>
        )}
      </div>

      {/* Panel de Clustering — ancho completo, debajo del mapa */}
      <div className="ep-panel" style={{ padding: '20px', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h3 style={{ marginTop: 0, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', color: '#d5007f' }}>
            <Layers size={18} /> Herramienta de Agrupamiento (Clusters)
          </h3>
          <p className="explanation-text micro ep-text-muted" style={{ margin: 0 }}>
            Permite agrupar los estados en 2, 3, 4 y 5 grupos, con base en la velocidad que se alcanzan las metas en la etapa de capacitacion seleccionada.
          </p>
        </div>

        {/* Clusters Etapa 1 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
            <h4 style={{ margin: 0, color: '#8b004f' }}>1ª Etapa de Capacitación</h4>
            <div style={{ display: 'flex', gap: '5px' }}>
              {[2, 3, 4, 5].map(k => (
                <button
                  key={k}
                  onClick={() => {
                    setMapStage(1);
                    setClusterK1(k);
                  }}
                  className={`ep-k-btn ${clusterK1 === k && mapStage === 1 ? 'active' : ''}`}
                >
                  K={k}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${clusterK1}, minmax(0, 1fr))`, gap: '10px', alignItems: 'start' }}>
            {clustersStage1.map((c, idx) => (
              <div key={idx} className="ep-cluster-col" style={{ borderTop: `3px solid ${GROUP_COLORS[idx % GROUP_COLORS.length]}` }}>
                <div className="ep-cluster-header" style={{ color: GROUP_COLORS[idx % GROUP_COLORS.length] }}>
                  <strong>Grupo {idx + 1}</strong>
                  <span className="ep-cluster-range">{toNumber(c.min_val).toFixed(1)}–{toNumber(c.max_val).toFixed(1)} días</span>
                </div>
                <ul className="ep-cluster-list">
                  {(c.estados || []).map(est => (
                    <li key={est.Entidad} className="ep-cluster-item">
                      <span className="ep-cluster-state">{est.Entidad}</span>
                      <span className="ep-cluster-days">{getStageAverage(est, 1).toFixed(2)} d</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Clusters Etapa 2 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
            <h4 style={{ margin: 0, color: '#8b004f' }}>2ª Etapa de Nombramientos</h4>
            <div style={{ display: 'flex', gap: '5px' }}>
              {[2, 3, 4, 5].map(k => (
                <button
                  key={k}
                  onClick={() => {
                    setMapStage(2);
                    setClusterK2(k);
                  }}
                  className={`ep-k-btn ${clusterK2 === k && mapStage === 2 ? 'active' : ''}`}
                >
                  K={k}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${clusterK2}, minmax(0, 1fr))`, gap: '10px', alignItems: 'start' }}>
            {clustersStage2.map((c, idx) => (
              <div key={idx} className="ep-cluster-col" style={{ borderTop: `3px solid ${GROUP_COLORS[idx % GROUP_COLORS.length]}` }}>
                <div className="ep-cluster-header" style={{ color: GROUP_COLORS[idx % GROUP_COLORS.length] }}>
                  <strong>Grupo {idx + 1}</strong>
                  <span className="ep-cluster-range">{toNumber(c.min_val).toFixed(1)}–{toNumber(c.max_val).toFixed(1)} días</span>
                </div>
                <ul className="ep-cluster-list">
                  {(c.estados || []).map(est => (
                    <li key={est.Entidad} className="ep-cluster-item">
                      <span className="ep-cluster-state">{est.Entidad}</span>
                      <span className="ep-cluster-days">{getStageAverage(est, 2).toFixed(2)} d</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntidadPromedio;
