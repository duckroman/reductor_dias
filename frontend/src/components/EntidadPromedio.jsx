import React, { useState, useEffect } from 'react';
import {
  getEntidadesData,
  uploadEntidadesFile,
  getEntidadesClustering,
} from '../services/api';
import PlotlyComponent from 'react-plotly.js';
import { Upload, Table, Map, Layers } from 'lucide-react';

const Plot = PlotlyComponent.default || PlotlyComponent;

const GROUP_COLOR_PALETTES = {
  2: ['#4fe3adff', '#FF2014'],
  3: ['#4fe3adff', '#FFD140', '#FF2014'],
  4: ['#4fe3adff', '#b2cf77ff', '#FF6B20', '#FF2014'],
  5: ['#4fe3adff', '#b2cf77ff', '#FFD140', '#FF6B20', '#FF2014'],
};

const NO_DATA_COLOR = '#f1f5f9';

const getGroupPalette = (k = 5) => GROUP_COLOR_PALETTES[k] || GROUP_COLOR_PALETTES[5];

const getGroupColor = (groupIndex, k = 5) => {
  const palette = getGroupPalette(k);
  return palette[groupIndex % palette.length];
};

const STATE_ALIASES = {
  'estado de mexico': 'mexico',
  'edo de mexico': 'mexico',
  edomex: 'mexico',
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

const getStageLabel = (stage) => (
  stage === 1 ? '1ª Etapa de Capacitación' : '2ª Etapa de Nombramientos'
);

const getStageShortLabel = (stage) => (
  stage === 1 ? 'Etapa 1' : 'Etapa 2'
);

const sortClustersByAverage = (clusters = []) => (
  [...clusters].sort((a, b) => toNumber(a.min_val) - toNumber(b.min_val))
);

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

  // Map state
  const [geoJson, setGeoJson] = useState(null);
  const [selectedStates, setSelectedStates] = useState({ 1: null, 2: null });

  // Clustering state
  const [clusterK1, setClusterK1] = useState(3);
  const [clusterK2, setClusterK2] = useState(3);
  const [clustersStage1, setClustersStage1] = useState([]);
  const [clustersStage2, setClustersStage2] = useState([]);

  // Load averages dataset and Mexico GeoJSON on mount
  useEffect(() => {
    loadData();
    fetch(`${import.meta.env.BASE_URL}mexico_geo.json`)
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
    const orderedClusters = sortClustersByAverage(clusters);
    const palette = getGroupPalette(orderedClusters.length);

    orderedClusters.forEach((cluster, clusterIndex) => {
      (cluster.estados || []).forEach(est => {
        if (!est.Entidad) return;

        lookup[normalizeText(est.Entidad)] = {
          group: clusterIndex + 1,
          color: palette[clusterIndex],
          cluster,
          estado: est,
        };
      });
    });

    return lookup;
  };

  const getSelectedStateInfo = (stage, clusters) => {
    const selectedState = selectedStates[stage];
    if (!selectedState) return null;

    const stateMap = buildEntityMap();
    const clusterLookup = buildClusterLookup(clusters);
    const key = normalizeText(selectedState);
    const stateData = stateMap[key];
    const clusterData = clusterLookup[key];

    return {
      promedio: getStageAverage(stateData, stage),
      grupo: clusterData?.group || null,
      color: clusterData?.color || NO_DATA_COLOR,
      hasData: Boolean(stateData),
    };
  };

  const handleStateClick = (stage, clickedState) => {
    setSelectedStates(prev => ({
      ...prev,
      [stage]: prev[stage] === clickedState ? null : clickedState,
    }));
  };

  const clearSelectedState = (stage) => {
    setSelectedStates(prev => ({ ...prev, [stage]: null }));
  };

  const getMapPlot = ({ stage, clusters, activeK }) => {
    if (!geoJson || entidadesData.length === 0 || clusters.length === 0) return null;

    const stateMap = buildEntityMap();
    const clusterLookup = buildClusterLookup(clusters);
    const selectedState = selectedStates[stage];
    const stageLabel = getStageLabel(stage);

    const locations = geoJson.features.map(f => f.properties.name);

    const values = locations.map(name => {
      const clusterInfo = clusterLookup[normalizeText(name)];
      return clusterInfo?.group ?? null;
    });

    const hoverTexts = locations.map(name => {
      const key = normalizeText(name);
      const stateData = stateMap[key];
      const clusterInfo = clusterLookup[key];

      if (!stateData) return `<b>${name}</b><br>Sin datos`;

      const average = getStageAverage(stateData, stage);
      const groupText = clusterInfo?.group ? `Grupo ${clusterInfo.group}` : 'Sin grupo asignado';

      return `<b>${name}</b><br>${stageLabel}: ${average.toFixed(2)} días<br>${groupText}<br>K=${activeK}`;
    });

    const colorscale = buildGradientColorscale(getGroupPalette(activeK));

    return (
      <Plot
        data={[
          {
            type: 'choropleth',
            geojson: geoJson,
            locations,
            z: values,
            zmin: 1,
            zmax: activeK,
            featureidkey: 'properties.name',
            colorscale,
            showscale: true,
            marker: {
              line: {
                color: 'rgba(0,0,0,0)',
                width: 0,
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
                text: `<b>${getStageShortLabel(stage)}</b>`,
                side: 'top',
                font: { color: '#0b5d47', size: 12 },
              },
              tickmode: 'array',
              tickvals: Array.from({ length: activeK }, (_, idx) => idx + 1),
              ticktext: Array.from({ length: activeK }, (_, idx) => {
                if (idx === 0) return `G${idx + 1} · menor`;
                if (idx === activeK - 1) return `G${idx + 1} · mayor`;
                return `G${idx + 1}`;
              }),
              tickfont: {
                color: '#0b5d47',
                size: 10,
                family: 'Outfit, sans-serif',
              },
              ticks: 'outside',
              ticklen: 4,
              tickwidth: 1,
              tickcolor: '#0b5d47',
              thickness: 20,
              len: 0.64,
              xpad: 16,
              ypad: 16,
              bgcolor: 'rgba(255,255,255,0.86)',
              bordercolor: 'rgba(152,255,217,0.45)',
              borderwidth: 1,
              outlinewidth: 0,
            },
          },
          ...(selectedState ? [
            {
              type: 'choropleth',
              geojson: geoJson,
              locations: [selectedState],
              z: [1],
              zmin: 0,
              zmax: 1,
              featureidkey: 'properties.name',
              colorscale: [
                [0, 'rgba(0,0,0,0)'],
                [1, 'rgba(0,0,0,0)'],
              ],
              showscale: false,
              hoverinfo: 'skip',
              marker: {
                line: {
                  color: '#111827',
                  width: 2,
                },
              },
            },
          ] : []),
        ]}
        layout={{
          geo: {
            visible: false,
            projection: {
              type: 'mercator',
              scale: 1.02,
            },
            center: { lat: 23.7, lon: -102.4 },
            lonaxis: { range: [-118.8, -85.6] },
            lataxis: { range: [13.9, 33.4] },
            bgcolor: '#fdf2fa',
          },
          margin: { t: 0, r: 68, b: 0, l: 0 },
          paper_bgcolor: '#fdf2fa',
          plot_bgcolor: '#fdf2fa',
          font: { color: '#6b0040' },
          dragmode: false,
          height: 420,
        }}
        useResizeHandler={true}
        style={{ width: '100%' }}
        onClick={(event) => {
          if (event && event.points && event.points[0]) {
            const clickedState = event.points[0].location;
            if (clickedState) {
              handleStateClick(stage, clickedState);
            }
          }
        }}
        config={{ displayModeBar: false, scrollZoom: false, responsive: true }}
      />
    );
  };

  const renderClusterCards = ({ stage, clusters }) => {
    const orderedClusters = sortClustersByAverage(clusters);

    return (
      <div className="ep-stage-cluster-grid">
        {orderedClusters.map((c, idx) => {
          const groupColor = getGroupColor(idx, orderedClusters.length);
          const groupTone = idx === 0
            ? 'Entidades de avance rápido'
            : idx === orderedClusters.length - 1
              ? 'Entidades de avance menos rápido'
              : 'Entidades de avance intermedio';

          return (
            <div
              key={`${stage}-${idx}`}
              className="ep-cluster-col"
              style={{
                borderTop: `3px solid ${groupColor}`,
                boxShadow: `0 10px 24px rgba(107, 0, 64, 0.06)`,
              }}
            >
              <div className="ep-cluster-header" style={{ color: groupColor }}>
                <strong>Grupo {idx + 1}</strong>
                <span className="ep-cluster-range">
                  {toNumber(c.min_val).toFixed(2)}–{toNumber(c.max_val).toFixed(2)} días
                </span>
              </div>
              <div className="ep-cluster-tone" style={{ color: groupColor }}>
                {groupTone}
              </div>
              <ul className="ep-cluster-list">
                {(c.estados || []).map(est => (
                  <li key={est.Entidad} className="ep-cluster-item">
                    <span className="ep-cluster-state">{est.Entidad}</span>
                    <span className="ep-cluster-days">{getStageAverage(est, stage).toFixed(2)} d</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMapCard = ({ stage, clusters, activeK }) => {
    const selectedState = selectedStates[stage];
    const selectedStateInfo = getSelectedStateInfo(stage, clusters);
    const stageLabel = getStageLabel(stage);

    return (
      <div className="ep-stage-map-card">
        <div className="ep-stage-map-header">
          <h4>
            <Map size={17} /> Mapa de Clusters
          </h4>
          <span className="ep-stage-pill">{getStageShortLabel(stage)} · K={activeK}</span>
        </div>

        <div className="ep-map-shell">
          {geoJson && !loadingData && clusters.length > 0 ? getMapPlot({ stage, clusters, activeK }) : (
            <div className="ep-map-loading">Cargando mapa y grupos...</div>
          )}
        </div>

        {selectedState && (
          <div className="ep-selected-state-card">
            <div>
              <span className="ep-selected-state-title">🏛️ {selectedState}</span>
              <span className="ep-selected-state-detail">
                {selectedStateInfo?.hasData
                  ? `${stageLabel}: ${selectedStateInfo.promedio.toFixed(2)} días · ${selectedStateInfo.grupo ? `Grupo ${selectedStateInfo.grupo}` : 'Sin grupo asignado'}`
                  : 'Sin datos para esta etapa'}
              </span>
            </div>
            <button onClick={() => clearSelectedState(stage)}>Quitar selección ✕</button>
          </div>
        )}
      </div>
    );
  };

  const renderStageSection = ({ stage, title, activeK, setActiveK, clusters }) => (
    <div className="ep-panel ep-stage-card">
      <div className="ep-stage-titlebar">
        <div>
          <h3>
            <Layers size={18} /> {title}
          </h3>
        </div>
        <div className="ep-k-control" aria-label={`Selector de K para ${title}`}>
          {[2, 3, 4, 5].map(k => (
            <button
              key={k}
              onClick={() => setActiveK(k)}
              className={`ep-k-btn ${activeK === k ? 'active' : ''}`}
            >
              K={k}
            </button>
          ))}
        </div>
      </div>

      <div className="ep-stage-layout">
        {renderMapCard({ stage, clusters, activeK })}

        <div className="ep-stage-clusters-panel">
          <div className="ep-side-label">Agrupamiento</div>
          {clusters.length > 0 ? renderClusterCards({ stage, clusters }) : (
            <div className="ep-empty-state">Cargando grupos...</div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-container ep-light" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <style>{`
        .ep-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }

        .ep-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .ep-stage-card {
          padding: 20px;
          margin-bottom: 24px;
        }

        .ep-stage-titlebar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 18px;
        }

        .ep-stage-titlebar h3 {
          margin: 0 0 6px 0;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #d5007f;
        }

        .ep-stage-titlebar p {
          margin: 0;
        }

        .ep-k-control {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
          min-width: 190px;
        }

        .ep-stage-layout {
          display: flex;
          flex-direction: column;
          gap: 18px;
          align-items: stretch;
        }

        .ep-stage-clusters-panel,
        .ep-stage-map-card {
          min-width: 0;
        }

        .ep-side-label {
          display: inline-flex;
          align-items: center;
          margin-bottom: 10px;
          padding: 5px 10px;
          border-radius: 999px;
          background: rgba(213, 0, 127, 0.08);
          border: 1px solid rgba(213, 0, 127, 0.18);
          color: #8b004f;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        .ep-stage-cluster-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 12px;
          align-items: start;
        }

        .ep-stage-card .ep-cluster-item {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: flex-start;
        }

        .ep-stage-card .ep-cluster-state {
          min-width: 0;
          font-size: calc(0.85rem - 2pt);
          line-height: 1.25;
          white-space: normal;
          overflow: visible;
          text-overflow: clip;
          overflow-wrap: normal;
          word-break: normal;
          hyphens: none;
        }

        .ep-stage-card .ep-cluster-days {
          justify-self: end;
          font-size: calc(0.80rem - 2pt);
          white-space: nowrap;
        }

        .ep-general-description {
          width: 100%;
          max-width: none;
          margin: -4px 0 24px 0;
          padding: 0;
          border: none;
          border-radius: 0;
          background: transparent;
          color: #6b0040;
          font-size: 0.94rem;
          line-height: 1.5;
        }

        .ep-stage-map-card {
          border-radius: 16px;
          background: linear-gradient(180deg, #fff7fc 0%, #fdf2fa 100%);
          border: 1px solid rgba(213, 0, 127, 0.12);
          padding: 14px;
          box-shadow: 0 14px 30px rgba(107, 0, 64, 0.07);
        }

        .ep-stage-map-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .ep-stage-map-header h4 {
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #8b004f;
        }

        .ep-stage-pill {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(213, 0, 127, 0.09);
          border: 1px solid rgba(213, 0, 127, 0.22);
          color: #8b004f;
          font-size: 0.82rem;
          font-weight: 700;
          white-space: nowrap;
        }

        .ep-map-shell {
          min-height: 420px;
          overflow: hidden;
          border-radius: 12px;
          background: #fdf2fa;
        }

        .ep-map-loading,
        .ep-empty-state {
          min-height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9b5982;
          border-radius: 12px;
          background: rgba(213, 0, 127, 0.04);
          border: 1px dashed rgba(213, 0, 127, 0.18);
        }

        .ep-map-loading {
          min-height: 420px;
        }

        .ep-selected-state-card {
          margin-top: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: rgba(213, 0, 127, 0.08);
          border: 1px solid rgba(213, 0, 127, 0.26);
          border-radius: 10px;
        }

        .ep-selected-state-card > div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .ep-selected-state-title {
          color: #8b004f;
          font-weight: 800;
          font-size: 0.92rem;
        }

        .ep-selected-state-detail {
          color: #8b004f;
          font-size: 0.84rem;
        }

        .ep-selected-state-card button {
          border: none;
          background: transparent;
          color: #d5007f;
          cursor: pointer;
          font-weight: 700;
          white-space: nowrap;
        }

        @media (max-width: 760px) {
          .ep-topbar,
          .ep-stage-titlebar {
            flex-direction: column;
            align-items: stretch;
          }

          .ep-actions,
          .ep-k-control {
            width: 100%;
            justify-content: flex-start;
          }

          .ep-stage-card {
            padding: 14px;
          }

          .ep-stage-cluster-grid {
            grid-template-columns: 1fr;
          }

          .ep-stage-map-header,
          .ep-selected-state-card {
            align-items: flex-start;
            flex-direction: column;
          }

          .ep-map-shell,
          .ep-map-loading {
            min-height: 440px;
          }
        }
      `}</style>

      <div className="ep-topbar">
        <h2 style={{ color: '#d5007f', margin: 0 }}>📊 Análisis de Promedios por Entidad y Clustering</h2>
        <div className="ep-actions">
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
        <>
          <div className="ep-file-indicator" style={{ marginBottom: '12px', maxWidth: '350px' }}>
            <div className="ep-file-label">Archivo de Promedios Estatal</div>
            <span>{filename}</span>
          </div>

          <p className="ep-general-description">
            La herramienta permite agrupar los estados en 2, 3, 4 y 5 grupos, con base en la velocidad que se alcanzan las metas en una etapa de capacitación determinada.
          </p>
        </>
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
              {entidadesData.map((row, idx) => {
                const isSelected = [selectedStates[1], selectedStates[2]].some(
                  state => normalizeText(state) === normalizeText(row.Entidad)
                );

                return (
                  <tr key={idx} className={isSelected ? 'highlight-row' : ''}>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {renderStageSection({
        stage: 1,
        title: '1ª Etapa de Capacitación',
        activeK: clusterK1,
        setActiveK: setClusterK1,
        clusters: clustersStage1,
      })}

      {renderStageSection({
        stage: 2,
        title: '2ª Etapa de Capacitación',
        activeK: clusterK2,
        setActiveK: setClusterK2,
        clusters: clustersStage2,
      })}
    </div>
  );
};

export default EntidadPromedio;
