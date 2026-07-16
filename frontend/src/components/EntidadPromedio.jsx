import React, { useState, useEffect } from 'react';
import {
  getEntidadesData,
  uploadEntidadesFile,
  getEntidadesClustering,
} from '../services/api';
import PlotlyComponent from 'react-plotly.js';
import { Upload, Table, Map, Layers, X, Thermometer, Download } from 'lucide-react';
import ExcelJS from 'exceljs';

// Bundled datasets: importing them (instead of fetching them at runtime from
// /public) makes them part of the compiled JS bundle. This avoids depending on
// the production server correctly serving static files from /public, on
// import.meta.env.BASE_URL resolving to the right path, or on any SPA
// fallback route accidentally returning index.html instead of the JSON file.
//
// IMPORTANT: move both files into `src/data/` (create the folder if it
// doesn't exist yet), next to this component, i.e.:
//   src/data/mexico_geo.json
//   src/data/distritos_analisis.json
// If your project structure differs, just adjust the two import paths below.
import mexicoGeoData from '../data/mexico_geo.json';
import distritosAnalisisData from '../data/distritos_analisis_3.json';

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
  stage === 1 ? '1ª Etapa de Capacitación  - PEC 2023-2024' : '2ª Etapa de Capacitación  - PEC 2023-2024'
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

// --- District-level dataset (drill-down card) ---
// Variable definitions per stage, matched to the keys expected in
// `distritos_analisis.json`. `weight` = ponderación de importancia de cada
// variable para calcular qué tan rápido/lento es un distrito (ver
// METODOLOGIA_PONDERACION.md para el detalle).
// Variables ordenadas de MAYOR a MENOR ponderación.
// Este orden es el que determina la prioridad en la comparación jerárquica:
// se compara primero por la variable de mayor peso; si hay empate, se pasa
// a la siguiente, y así sucesivamente.
const STAGE1_VARIABLES = [
  { key: 'ccrl_estabilizacion', label: 'Punto de estabilización de CCRL', weight: 0.40 },
  { key: 'numero_optimo', label: 'Número óptimo', weight: 0.30 },
  { key: 'ciudadania_estabilizacion', label: 'Punto de estabilización de ciudadanía visitada', weight: 0.20 },
  { key: 'ciudadania_95', label: '95% de ciudadanía visitada', weight: 0.10 },
];

const STAGE2_VARIABLES = [
  { key: 'simulacros_estabilizacion', label: 'Punto de estabilización de asistencia a simulacros', weight: 0.30 },
  { key: 'capacitaciones_estabilizacion', label: 'Punto de estabilización de capacitaciones', weight: 0.25 },
  { key: 'capacitaciones_95', label: '95% de capacitaciones', weight: 0.20 },
  { key: 'nombramientos_estabilizacion', label: 'Punto de estabilización de nombramientos', weight: 0.15 },
  { key: 'nombramientos_95', label: '95% de nombramientos', weight: 0.10 },
];

const getStageVariables = (stage) => (stage === 1 ? STAGE1_VARIABLES : STAGE2_VARIABLES);

// Orden de las columnas en las tarjetas (independiente del peso).
// La lógica de comparación jerárquica sigue usando STAGE*_VARIABLES (ordenadas
// por peso); estos arrays sólo determinan el orden visual de las columnas.
const STAGE1_DISPLAY_ORDER = [
  'ciudadania_estabilizacion',
  'ciudadania_95',
  'ccrl_estabilizacion',
  'numero_optimo',
];

const STAGE2_DISPLAY_ORDER = [
  'nombramientos_95',
  'nombramientos_estabilizacion',
  'capacitaciones_95',
  'capacitaciones_estabilizacion',
  'simulacros_estabilizacion',
];

const getStageDisplayVariables = (stage) => {
  const all = getStageVariables(stage);
  const order = stage === 1 ? STAGE1_DISPLAY_ORDER : STAGE2_DISPLAY_ORDER;
  return order.map(key => all.find(v => v.key === key)).filter(Boolean);
};

// Comparación jerárquica entre dos distritos, variable por variable,
// empezando por la de MAYOR ponderación (las variables deben estar ordenadas
// de mayor a menor peso, como en STAGE1_VARIABLES / STAGE2_VARIABLES).
//
// Regla: un distrito con un valor MÁS BAJO en una variable es MÁS RÁPIDO.
// Si dos distritos tienen el mismo valor en la variable de mayor peso, se
// desempata con la siguiente variable, y así sucesivamente.
//
// Retorna:
//   < 0  →  'a' es más rápido que 'b'
//   > 0  →  'b' es más rápido que 'a'
//     0  →  ambos son igual de rápidos en todas las variables
const compareDistritosByPriority = (a, b, variables) => {
  for (const v of variables) {
    const aVal = toNumber(a[v.key], NaN);
    const bVal = toNumber(b[v.key], NaN);
    const aFinite = Number.isFinite(aVal);
    const bFinite = Number.isFinite(bVal);
    // Si sólo uno tiene dato, el que tiene dato gana (se considera más rápido)
    if (aFinite && !bFinite) return -1;
    if (!aFinite && bFinite) return 1;
    if (!aFinite && !bFinite) continue; // Ambos sin dato → pasar a la siguiente variable
    if (aVal !== bVal) return aVal - bVal; // Menor valor = más rápido
  }
  return 0; // Empate en todas las variables
};

// Heatmap gradient: green (rápido) -> red (lento / foco rojo)
const HEAT_LOW_RGB = [79, 227, 173]; // #4fe3ad
const HEAT_HIGH_RGB = [255, 32, 20]; // #FF2014

const interpolateHeatColor = (t) => {
  const clamped = Math.min(Math.max(t, 0), 1);
  const rgb = HEAT_LOW_RGB.map((c, i) => Math.round(c + (HEAT_HIGH_RGB[i] - c) * clamped));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
};

const getHeatColor = (value, min, max) => {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max === min) {
    return NO_DATA_COLOR;
  }
  const t = (value - min) / (max - min);
  return interpolateHeatColor(t);
};

// --- Exportar a Excel (.xlsx), conservando el color de cada celda ---

// Convierte "rgb(r, g, b)" o un hex "#rrggbb" a un ARGB hex "FFRRGGBB" que
// ExcelJS necesita para el relleno (fill) de una celda.
const colorToArgbHex = (color) => {
  if (!color) return 'FFFFFFFF';

  const rgbMatch = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    const toHex = (n) => Number(n).toString(16).padStart(2, '0').toUpperCase();
    return `FF${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  const hexMatch = color.replace('#', '');
  if (hexMatch.length === 6) return `FF${hexMatch.toUpperCase()}`;

  return 'FFFFFFFF';
};

// Nombre de archivo seguro: sin acentos, espacios ni caracteres especiales.
const sanitizeFileName = (value) => (
  normalizeText(value).replace(/\s+/g, '_') || 'archivo'
);

// Dispara la descarga de un workbook de ExcelJS ya construido.
const downloadWorkbook = async (workbook, fileName) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Exporta una tabla de distritos a .xlsx, respetando el orden en el que se
// muestra en pantalla (el arreglo `rows` ya debe venir ordenado como se ve en
// la tarjeta) y coloreando las celdas de variables igual que el mapa de calor
// en pantalla (usando el mismo `getHeatColor` con el mismo rango min/max).
//
// `columns`: [{ header, key, width?, isVariable?, min?, max? }]
//   - isVariable: true → la celda se colorea con getHeatColor(valor, min, max)
const exportRowsToXlsx = async ({ fileName, sheetName, columns, rows }) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31)); // límite de Excel

  worksheet.columns = columns.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width || 20,
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FF6B0040' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4F3' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  rows.forEach(row => {
    const rowData = {};
    columns.forEach(c => { rowData[c.key] = row[c.key]; });
    const excelRow = worksheet.addRow(rowData);

    columns.forEach((c, colIdx) => {
      const cell = excelRow.getCell(colIdx + 1);
      if (c.isVariable) {
        const value = Number.isFinite(row[c.key]) ? row[c.key] : NaN;
        cell.alignment = { horizontal: 'center' };
        if (Number.isFinite(value)) {
          cell.value = value;
          cell.numFmt = '0.00';
          const color = getHeatColor(value, c.min, c.max);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorToArgbHex(color) } };
        } else {
          cell.value = '—';
        }
      }
    });
  });

  await downloadWorkbook(workbook, fileName);
};

// --- Mini-mapa (icono) de una entidad a partir de su geometría GeoJSON ---
//
// Convierte la geometría (Polygon o MultiPolygon, en grados lon/lat) de un
// estado en un <path> de SVG ya escalado y centrado dentro de un viewBox
// cuadrado de `size` unidades, del mismo tamaño que se use el ícono/emoji que
// acompaña el nombre de la entidad.
const buildEntidadMiniMapPath = (geometry, size = 100) => {
  if (!geometry) return null;

  let polygons = [];
  if (geometry.type === 'Polygon') {
    polygons = [geometry.coordinates];
  } else if (geometry.type === 'MultiPolygon') {
    polygons = geometry.coordinates;
  } else {
    return null;
  }

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  polygons.forEach(rings => {
    rings.forEach(ring => {
      ring.forEach(([lon, lat]) => {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });
    });
  });

  if (!Number.isFinite(minLon) || !Number.isFinite(maxLon)) return null;

  const lonSpan = maxLon - minLon || 1;
  const latSpan = maxLat - minLat || 1;
  const scale = size / Math.max(lonSpan, latSpan);
  const offsetX = (size - lonSpan * scale) / 2;
  const offsetY = (size - latSpan * scale) / 2;

  const project = ([lon, lat]) => {
    const x = (lon - minLon) * scale + offsetX;
    const y = size - ((lat - minLat) * scale + offsetY); // invertir Y (SVG crece hacia abajo)
    return [x, y];
  };

  const pathParts = [];
  polygons.forEach(rings => {
    rings.forEach(ring => {
      if (ring.length === 0) return;
      const points = ring.map(project);
      const d = points
        .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
        .join(' ');
      pathParts.push(`${d} Z`);
    });
  });

  if (pathParts.length === 0) return null;
  return { size, path: pathParts.join(' ') };
};

const EntidadPromedio = () => {
  // Averages dataset state
  const [entidadesData, setEntidadesData] = useState([]);
  const [filename, setFilename] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showTable, setShowTable] = useState(false);

  // Map state
  const [geoJson] = useState(mexicoGeoData);
  const [selectedStates, setSelectedStates] = useState({ 1: null, 2: null });

  // Clustering state
  const [clusterK1, setClusterK1] = useState(3);
  const [clusterK2, setClusterK2] = useState(3);
  const [clustersStage1, setClustersStage1] = useState([]);
  const [clustersStage2, setClustersStage2] = useState([]);

  // District-level dataset state (drill-down card per entidad)
  // Bundled at build time via the import above — no runtime loading needed.
  const [distritosData] = useState({
    etapa1: distritosAnalisisData.etapa1 || [],
    etapa2: distritosAnalisisData.etapa2 || [],
  });
  const loadingDistritos = false;
  const [modalEntidad, setModalEntidad] = useState(null); // { stage, entidad } | null
  const [modalSortMode, setModalSortMode] = useState('original'); // 'original' | 'veloz'
  const [exportingDistritos, setExportingDistritos] = useState(false);

  // Ranking nacional (300 distritos) modal state
  const [rankingModalStage, setRankingModalStage] = useState(null); // 1 | 2 | null
  const [rankingSortMode, setRankingSortMode] = useState('rapido'); // 'rapido' | 'lento' | 'entidad'
  const [exportingRanking, setExportingRanking] = useState(false);

  // Load averages dataset (this one still comes from the backend API, unrelated
  // to the bundled GeoJSON / district datasets above).
  useEffect(() => {
    loadData();
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

  // --- District-level drill-down helpers ---

  const getStageDistritos = (stage) => (stage === 1 ? distritosData.etapa1 : distritosData.etapa2);

  const getDistritosPorEntidad = (stage, entidad) => {
    const key = normalizeText(entidad);
    return getStageDistritos(stage).filter(d => normalizeText(d.Entidad) === key);
  };

  // Feature de GeoJSON de una entidad (para el ícono de mini-mapa junto a su
  // nombre en la tarjeta de distritos).
  const getEntidadGeoFeature = (entidad) => {
    if (!geoJson?.features) return null;
    const key = normalizeText(entidad);
    return geoJson.features.find(f => normalizeText(f.properties?.name) === key) || null;
  };

  // Rango único de color por etapa: se calcula sobre TODOS los valores de
  // TODAS las variables de esa etapa, en TODOS los distritos del país. Así,
  // el mismo número de días siempre se pinta del mismo color sin importar en
  // qué columna, qué distrito o qué tarjeta aparezca (antes cada columna
  // tenía su propio min/max, por lo que un mismo valor podía verse con
  // colores distintos según la variable).
  const getStageColorRange = (stage) => {
    const variables = getStageVariables(stage);
    const values = [];

    getStageDistritos(stage).forEach(d => {
      variables.forEach(v => {
        const value = toNumber(d[v.key], NaN);
        if (Number.isFinite(value)) values.push(value);
      });
    });

    if (values.length === 0) return { min: 0, max: 1 };
    return { min: Math.min(...values), max: Math.max(...values) };
  };

  // Ranking nacional de un distrito dentro de su etapa: usa la comparación
  // jerárquica (compareDistritosByPriority) para asignar una Posición fija
  // (1 = más rápido a nivel nacional). La posición no cambia aunque la tabla
  // se muestre en otro orden (por entidad, por ejemplo) o alfabéticamente.
  const getStageRanking = (stage) => {
    const variables = getStageVariables(stage); // ya ordenadas de mayor a menor peso

    const sorted = [...getStageDistritos(stage)].sort((a, b) =>
      compareDistritosByPriority(a, b, variables)
    );

    return sorted.map((d, idx) => ({ ...d, __posicion: idx + 1 }));
  };

  const openDistritosModal = (stage, entidad) => {
    setModalSortMode('original');
    setModalEntidad({ stage, entidad });
  };
  const closeDistritosModal = () => setModalEntidad(null);

  const openRankingModal = (stage) => {
    setRankingSortMode('rapido');
    setRankingModalStage(stage);
  };
  const closeRankingModal = () => setRankingModalStage(null);

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
                if (idx === 0) return `G${idx + 1} · Rápido`;
                if (idx === activeK - 1) return `G${idx + 1} · Lento`;
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
                  <li
                    key={est.Entidad}
                    className="ep-cluster-item ep-cluster-item-clickable"
                    onClick={() => openDistritosModal(stage, est.Entidad)}
                    title={`Ver distritos de ${est.Entidad}`}
                  >
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

  const renderDistritosModal = () => {
    if (!modalEntidad) return null;

    const { stage, entidad } = modalEntidad;
    const variables = getStageVariables(stage);           // orden por peso → comparación jerárquica
    const displayVariables = getStageDisplayVariables(stage); // orden visual → columnas de la tabla
    const stageColorRange = getStageColorRange(stage);
    const ranges = displayVariables.map(v => ({ ...v, ...stageColorRange }));
    const datasetIsEmpty = getStageDistritos(stage).length === 0;

    // Original order: by ID_Distrito ascending.
    const baseDistritos = getDistritosPorEntidad(stage, entidad)
      .slice()
      .sort((a, b) => toNumber(a.ID_Distrito) - toNumber(b.ID_Distrito));

    // Ordenamiento mediante comparación jerárquica:
    // - 'lento': más lento primero (invertimos la comparación → b vs a)
    // - 'original': orden original por ID_Distrito ascendente
    const distritos = modalSortMode === 'lento'
      ? [...baseDistritos].sort((a, b) => compareDistritosByPriority(b, a, variables))
      : baseDistritos;

    const distritoColWidthPct = 26;
    const variableColWidthPct = (100 - distritoColWidthPct) / variables.length;

    const geoFeature = getEntidadGeoFeature(entidad);
    const miniMap = geoFeature ? buildEntidadMiniMapPath(geoFeature.geometry) : null;

    const handleExportDistritos = async () => {
      setExportingDistritos(true);
      try {
        const columns = [
          { header: 'ID Distrito', key: 'id_distrito', width: 14 },
          { header: 'Distrito', key: 'distrito', width: 32 },
          ...ranges.map(r => ({
            header: r.label, key: r.key, width: 22, isVariable: true, min: r.min, max: r.max,
          })),
        ];

        const rows = distritos.map(d => ({
          id_distrito: String(toNumber(d.ID_Distrito, 0)).padStart(2, '0'),
          distrito: d.Distrito,
          ...ranges.reduce((acc, r) => {
            acc[r.key] = toNumber(d[r.key], NaN);
            return acc;
          }, {}),
        }));

        await exportRowsToXlsx({
          fileName: `distritos_${sanitizeFileName(entidad)}_${getStageShortLabel(stage)}.xlsx`,
          sheetName: `${entidad} ${getStageShortLabel(stage)}`,
          columns,
          rows,
        });
      } catch (e) {
        console.error('Error exportando distritos a Excel', e);
        alert('Ocurrió un error al exportar a Excel.');
      } finally {
        setExportingDistritos(false);
      }
    };

    return (
      <div className="ep-modal-overlay" onClick={closeDistritosModal}>
        <div
          className="ep-modal-card"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="ep-modal-header">
            <div className="ep-modal-header-titles">
              <span className="ep-modal-stage-label">{getStageLabel(stage)}</span>
              <h3 className="ep-modal-entidad-title">
                <span className="ep-modal-entidad-icon" aria-hidden="true"></span>
                {miniMap && (
                  <svg
                    viewBox={`0 0 ${miniMap.size} ${miniMap.size}`}
                    className="ep-entidad-mini-map"
                    aria-hidden="true"
                  >
                    <path d={miniMap.path} fill="#d5007f" fillRule="evenodd" />
                  </svg>
                )}
                <span>{entidad}</span>
              </h3>
            </div>
            <button className="ep-modal-close" onClick={closeDistritosModal} aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>

          {loadingDistritos ? (
            <div className="ep-empty-state" style={{ minHeight: 140 }}>
              Cargando dataset de distritos...
            </div>
          ) : datasetIsEmpty ? (
            <div className="ep-empty-state" style={{ minHeight: 140 }}>
              Aún no se ha cargado el dataset de distritos (distritos_analisis.json).
            </div>
          ) : distritos.length === 0 ? (
            <div className="ep-empty-state" style={{ minHeight: 140 }}>
              No se encontraron distritos para {entidad}.
            </div>
          ) : (
            <>
              <div className="ep-modal-toolbar">
                <div className="ep-modal-toolbar-spacer" style={{ width: `${distritoColWidthPct}%` }} />
                <span className="ep-modal-legend-label">Día en el que alcanza:</span>
                <button
                  className="ep-sort-btn"
                  onClick={() => setModalSortMode(prev => (prev === 'lento' ? 'original' : 'lento'))}
                >
                  {modalSortMode === 'lento'
                    ? '↺ Restablecer orden original'
                    : 'Ordenar: más lento → más rápido'}
                </button>
                <button
                  className="ep-export-btn"
                  onClick={handleExportDistritos}
                  disabled={exportingDistritos}
                  title="Exportar esta tabla a Excel"
                >
                  <Download size={14} />
                  {exportingDistritos ? 'Exportando...' : 'Exportar a Excel'}
                </button>
              </div>

              <div className="ep-modal-table-wrap">
                <table className="ep-heatmap-table">
                  <colgroup>
                    <col style={{ width: `${distritoColWidthPct}%` }} />
                    {displayVariables.map(v => (
                      <col key={v.key} style={{ width: `${variableColWidthPct}%` }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Distrito</th>
                      {displayVariables.map(v => <th key={v.key}>{v.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {distritos.map((d, idx) => (
                      <tr key={`${d.ID_Distrito}-${idx}`}>
                        <td className="ep-heatmap-distrito">
                          <span className="ep-distrito-id">
                            {String(toNumber(d.ID_Distrito, 0)).padStart(2, '0')}
                          </span>
                          <span className="ep-distrito-name">{d.Distrito}</span>
                        </td>
                        {ranges.map(r => {
                          const value = toNumber(d[r.key], NaN);
                          const color = getHeatColor(value, r.min, r.max);
                          return (
                            <td key={r.key} className="ep-heatmap-cell" style={{ background: color }}>
                              {Number.isFinite(value) ? value.toFixed(2) : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="ep-heatmap-legend">
                <Thermometer size={14} />
                <span>Más rápido</span>
                <div className="ep-heatmap-gradient" />
                <span>Más lento (foco rojo)</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderRankingModal = () => {
    if (!rankingModalStage) return null;

    const stage = rankingModalStage;
    const displayVariables = getStageDisplayVariables(stage); // orden visual → columnas de la tabla
    const stageColorRange = getStageColorRange(stage);
    const ranges = displayVariables.map(v => ({ ...v, ...stageColorRange }));
    const ranking = getStageRanking(stage); // posición fija, 1 = más rápido (usa orden por peso internamente)

    let distritos = ranking;
    if (rankingSortMode === 'lento') {
      distritos = [...ranking].sort((a, b) => b.__posicion - a.__posicion);
    } else if (rankingSortMode === 'entidad') {
      distritos = [...ranking].sort((a, b) => {
        const byEntidad = normalizeText(a.Entidad).localeCompare(normalizeText(b.Entidad));
        if (byEntidad !== 0) return byEntidad;
        return toNumber(a.ID_Distrito) - toNumber(b.ID_Distrito);
      });
    } else {
      distritos = [...ranking].sort((a, b) => a.__posicion - b.__posicion);
    }

    const handleExportRanking = async () => {
      setExportingRanking(true);
      try {
        const columns = [
          { header: 'Posición', key: 'posicion', width: 12 },
          { header: 'Entidad', key: 'entidad', width: 24 },
          { header: 'ID Distrito', key: 'id_distrito', width: 14 },
          { header: 'Distrito', key: 'distrito', width: 32 },
          ...ranges.map(r => ({
            header: r.label, key: r.key, width: 22, isVariable: true, min: r.min, max: r.max,
          })),
        ];

        const rows = distritos.map(d => ({
          posicion: d.__posicion,
          entidad: d.Entidad,
          id_distrito: String(toNumber(d.ID_Distrito, 0)).padStart(2, '0'),
          distrito: d.Distrito,
          ...ranges.reduce((acc, r) => {
            acc[r.key] = toNumber(d[r.key], NaN);
            return acc;
          }, {}),
        }));

        await exportRowsToXlsx({
          fileName: `ranking_nacional_${getStageShortLabel(stage)}.xlsx`,
          sheetName: `Ranking ${getStageShortLabel(stage)}`,
          columns,
          rows,
        });
      } catch (e) {
        console.error('Error exportando el ranking a Excel', e);
        alert('Ocurrió un error al exportar a Excel.');
      } finally {
        setExportingRanking(false);
      }
    };

    return (
      <div className="ep-modal-overlay" onClick={closeRankingModal}>
        <div
          className="ep-modal-card ep-ranking-card"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="ep-modal-header">
            <div>
              <span className="ep-modal-stage-label">{getStageLabel(stage)}</span>
              <h3>📋 Ranking nacional de los 300 distritos</h3>
            </div>
            <button className="ep-modal-close" onClick={closeRankingModal} aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>

          <div className="ep-ranking-toolbar">
            <button
              className={`ep-sort-btn ${rankingSortMode === 'rapido' ? 'ep-sort-btn-active' : ''}`}
              onClick={() => setRankingSortMode('rapido')}
            >
              Más rápido primero
            </button>
            <button
              className={`ep-sort-btn ${rankingSortMode === 'lento' ? 'ep-sort-btn-active' : ''}`}
              onClick={() => setRankingSortMode('lento')}
            >
              Más lento primero
            </button>
            {/*             <button
              className={`ep-sort-btn ${rankingSortMode === 'entidad' ? 'ep-sort-btn-active' : ''}`}
              onClick={() => setRankingSortMode('entidad')}
            >
              🔤 Por entidad
            </button> */}
            <button
              className="ep-export-btn"
              onClick={handleExportRanking}
              disabled={exportingRanking}
              title="Exportar esta tabla a Excel"
            >
              <Download size={14} />
              {exportingRanking ? 'Exportando...' : 'Exportar a Excel'}
            </button>
          </div>

          <div className="ep-modal-table-wrap ep-ranking-table-wrap">
            <table className="ep-heatmap-table ep-ranking-table">
              <thead>
                <tr>
                  <th className="ep-ranking-col-pos">Posición</th>
                  <th className="ep-ranking-col-entidad">Entidad</th>
                  <th className="ep-ranking-col-id">ID Distrito</th>
                  <th className="ep-ranking-col-distrito">Distrito</th>
                  {displayVariables.map(v => <th key={v.key}>{v.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {distritos.map((d, idx) => (
                  <tr key={`${d.ID_Entidad}-${d.ID_Distrito}-${idx}`}>
                    <td className="ep-ranking-col-pos ep-ranking-pos-cell">{d.__posicion}</td>
                    <td className="ep-ranking-col-entidad">{d.Entidad}</td>
                    <td className="ep-ranking-col-id">{String(toNumber(d.ID_Distrito, 0)).padStart(2, '0')}</td>
                    <td className="ep-ranking-col-distrito">{d.Distrito}</td>
                    {ranges.map(r => {
                      const value = toNumber(d[r.key], NaN);
                      const color = getHeatColor(value, r.min, r.max);
                      return (
                        <td key={r.key} className="ep-heatmap-cell" style={{ background: color }}>
                          {Number.isFinite(value) ? value.toFixed(2) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ep-heatmap-legend">
            <Thermometer size={14} />
            <span>Más rápido</span>
            <div className="ep-heatmap-gradient" />
            <span>Más lento (foco rojo)</span>
          </div>
        </div>
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
          <div className="ep-side-label-row">
            <div className="ep-side-label">Agrupamiento</div>
            <button
              className="ep-ranking-btn"
              onClick={() => openRankingModal(stage)}
              title="Ver ranking nacional de los 300 distritos"
            >
              📋 Ranking de los 300 distritos
            </button>
          </div>
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

        .ep-side-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }

        .ep-ranking-btn {
          border: 1px solid rgba(213, 0, 127, 0.28);
          background: #fff;
          color: #8b004f;
          font-weight: 700;
          font-size: 0.76rem;
          padding: 6px 12px;
          border-radius: 999px;
          cursor: pointer;
          white-space: nowrap;
          margin-bottom: 10px;
          transition: background 0.15s ease;
        }

        .ep-ranking-btn:hover {
          background: rgba(213, 0, 127, 0.08);
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

        .ep-cluster-item-clickable {
          cursor: pointer;
          border-radius: 8px;
          padding: 4px 6px;
          margin: -4px -6px;
          transition: background 0.15s ease, transform 0.1s ease;
        }

        .ep-cluster-item-clickable:hover {
          background: rgba(213, 0, 127, 0.08);
        }

        .ep-cluster-item-clickable:active {
          transform: scale(0.98);
        }

        .ep-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(20, 0, 12, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .ep-modal-card {
          width: 100%;
          max-width: 900px;
          max-height: 85vh;
          overflow-y: auto;
          background: #fffdfe;
          border-radius: 18px;
          border: 1px solid rgba(213, 0, 127, 0.18);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
          padding: 22px;
        }

        .ep-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }

        .ep-modal-header-titles {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
        }

        .ep-modal-header h3 {
          margin: 0;
          color: #8b004f;
          font-size: 1.15rem;
        }

        .ep-modal-entidad-title {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 6px;
          text-align: left;
        }

        .ep-modal-entidad-icon {
          font-size: 1.15rem;
          line-height: 1;
        }

        .ep-entidad-mini-map {
          width: 1.15rem;
          height: 1.15rem;
          flex-shrink: 0;
        }

        .ep-modal-stage-label {
          display: block;
          color: #8b004f;
          font-size: 0.74rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .ep-modal-close {
          border: none;
          background: rgba(213, 0, 127, 0.08);
          color: #8b004f;
          width: 32px;
          height: 32px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }

        .ep-modal-close:hover {
          background: rgba(213, 0, 127, 0.16);
        }

        .ep-modal-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .ep-modal-toolbar-spacer {
          flex-shrink: 0;
        }

        .ep-modal-legend-label {
          flex: 1;
          text-align: left;
          color: #6b0040;
          font-size: 0.86rem;
          font-weight: 600;
        }

        .ep-sort-btn {
          border: 1px solid rgba(213, 0, 127, 0.28);
          background: rgba(213, 0, 127, 0.06);
          color: #8b004f;
          font-weight: 700;
          font-size: 0.78rem;
          padding: 7px 12px;
          border-radius: 999px;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background 0.15s ease;
        }

        .ep-sort-btn:hover {
          background: rgba(213, 0, 127, 0.14);
        }

        .ep-sort-btn-active {
          background: #8b004f;
          border-color: #8b004f;
          color: #fff;
        }

        .ep-sort-btn-active:hover {
          background: #6b0040;
        }

        .ep-export-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid rgba(34, 139, 87, 0.35);
          background: rgba(34, 139, 87, 0.08);
          color: #1a7a4c;
          font-weight: 700;
          font-size: 0.78rem;
          padding: 7px 12px;
          border-radius: 999px;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background 0.15s ease;
        }

        .ep-export-btn:hover {
          background: rgba(34, 139, 87, 0.16);
        }

        .ep-export-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ep-ranking-card {
          max-width: 1100px;
        }

        .ep-ranking-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 10px;
        }

        .ep-ranking-table-wrap {
          max-height: 60vh;
          overflow-y: auto;
        }

        .ep-ranking-table {
          min-width: 720px;
        }

        .ep-ranking-col-pos {
          width: 70px;
          text-align: center;
        }

        .ep-ranking-pos-cell {
          font-weight: 800;
          color: #8b004f;
        }

        .ep-ranking-col-entidad {
          text-align: left;
          white-space: nowrap;
        }

        .ep-ranking-col-id {
          width: 90px;
          text-align: center;
        }

        .ep-ranking-col-distrito {
          text-align: left;
        }

        .ep-modal-table-wrap {
          overflow-x: auto;
          border-radius: 12px;
          border: 1px solid rgba(213, 0, 127, 0.12);
        }

        .ep-heatmap-table {
          width: 100%;
          min-width: 560px;
          table-layout: fixed;
          border-collapse: collapse;
          font-size: 0.78rem;
        }

        .ep-heatmap-table th {
          background: #fce4f3;
          color: #6b0040;
          padding: 8px 8px;
          text-align: center;
          vertical-align: middle;
          font-size: 0.72rem;
          line-height: 1.25;
          white-space: normal;
          word-break: break-word;
          position: sticky;
          top: 0;
        }

        .ep-heatmap-distrito {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          font-weight: 600;
          color: #1e0010;
          background: #fffdfe;
          position: sticky;
          left: 0;
        }

        .ep-distrito-id {
          flex-shrink: 0;
          color: #8b004f;
          font-weight: 800;
          font-size: 0.74rem;
          background: rgba(213, 0, 127, 0.1);
          border-radius: 6px;
          padding: 1px 5px;
          line-height: 1.4;
        }

        .ep-distrito-name {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-align: left;
          line-height: 1.2;
          font-size: 0.76rem;
          white-space: normal;
          word-break: break-word;
        }

        .ep-heatmap-table td {
          padding: 7px 10px;
          border-bottom: 1px solid rgba(213, 0, 127, 0.08);
        }

        .ep-heatmap-cell {
          text-align: center;
          font-weight: 700;
          color: #1e0010;
          text-shadow: 0 1px 1px rgba(255,255,255,0.35);
        }

        .ep-heatmap-legend {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 14px;
          color: #6b0040;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .ep-heatmap-gradient {
          flex: 1;
          max-width: 160px;
          height: 10px;
          border-radius: 999px;
          background: linear-gradient(90deg, #4fe3ad 0%, #FFD140 50%, #FF2014 100%);
        }

        @media (max-width: 760px) {
          .ep-modal-card {
            padding: 16px;
            max-height: 90vh;
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
        title: '1ª Etapa de Capacitación - PEC 2023-2024',
        activeK: clusterK1,
        setActiveK: setClusterK1,
        clusters: clustersStage1,
      })}

      {renderStageSection({
        stage: 2,
        title: '2ª Etapa de Capacitación  - PEC 2023-2024',
        activeK: clusterK2,
        setActiveK: setClusterK2,
        clusters: clustersStage2,
      })}

      {renderDistritosModal()}
      {renderRankingModal()}
    </div>
  );
};

export default EntidadPromedio;