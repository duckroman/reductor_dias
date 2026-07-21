import React, { useState, useEffect, useRef } from 'react';
import {
    getEntidadesData,
    uploadEntidadesFile,
    getEntidadesClustering,
} from '../services/api';
import PlotlyComponent from 'react-plotly.js';
import { Upload, Table, Map as MapIcon, Layers, X, Thermometer, Download } from 'lucide-react';
import ExcelJS from 'exceljs';

// Bundled datasets: el dataset PEC 2023-2024 se importa estáticamente porque ya
// existe. Los datasets PEC 2020-2021 y PEC 2017-2018 se cargan dinámicamente en
// un useEffect para que el componente compile aunque los archivos aún no existan.
import mexicoGeoData from '../data/mexico_geo.json';
import distritosAnalisisData from '../data/distritos_analisis_3.json';
import distritosAnalisisPromedio from '../data/distritos_analisis_PECPromedio.json';
import distritosGeometriaMexico from '../data/distritos_geometria_mexico.json';

const Plot = PlotlyComponent.default || PlotlyComponent;

// ---------------------------------------------------------------------------
// Constantes de color
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Normalización de texto
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Helpers de etapa
// ---------------------------------------------------------------------------
const getStageAverage = (row, stage) => {
    if (!row) return 0;
    const field = stage === 1 ? 'E1_Promedio' : 'E2_Promedio';
    return toNumber(row[field] ?? row.promedio ?? row.value, 0);
};

const getStageLabel = (stage) => (
    stage === 1 ? '1ª Etapa de Capacitación' : '2ª Etapa de Capacitación'
);

const getStageShortLabel = (stage) => (
    stage === 1 ? 'Etapa 1' : 'Etapa 2'
);

// ---------------------------------------------------------------------------
// Definición de variables por etapa
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Puntaje de velocidad (suma ponderada)
// ---------------------------------------------------------------------------
// puntaje = Σ (valor_i × peso_i)  — solo variables con valor válido.
// Mayor puntaje = distrito más lento.
const getDistritoScore = (distrito, variables) => {
    let score = 0;
    for (const v of variables) {
        const val = toNumber(distrito[v.key], NaN);
        if (Number.isFinite(val)) {
            score += val * v.weight;
        }
    }
    return score;
};

// Comparador ascendente: menor puntaje primero (más rápido primero).
const compareDistritosByScore = (a, b, variables) =>
    getDistritoScore(a, variables) - getDistritoScore(b, variables);


const sortClustersByAverage = (clusters = []) => (
    [...clusters].sort((a, b) => toNumber(a.min_val) - toNumber(b.min_val))
);

const buildGradientColorscale = (colors) => {
    const maxIndex = Math.max(colors.length - 1, 1);
    return colors.map((color, index) => [index / maxIndex, color]);
};

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------
const HEAT_LOW_RGB = [79, 227, 173];
const HEAT_HIGH_RGB = [255, 32, 20];

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

// ---------------------------------------------------------------------------
// Exportar a Excel
// ---------------------------------------------------------------------------
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

const sanitizeFileName = (value) => (
    normalizeText(value).replace(/\s+/g, '_') || 'archivo'
);

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

const exportRowsToXlsx = async ({ fileName, sheetName, columns, rows }) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName.slice(0, 31));

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

// ---------------------------------------------------------------------------
// Mini-mapa SVG
// ---------------------------------------------------------------------------
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
        const y = size - ((lat - minLat) * scale + offsetY);
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

// ---------------------------------------------------------------------------
// Configuración de las pestañas PEC
// ---------------------------------------------------------------------------
const PEC_TABS = [
    { id: 'pec24', label: 'PEC 2023-2024' },
    { id: 'pec21', label: 'PEC 2020-2021' },
    { id: 'pec18', label: 'PEC 2017-2018' },
    { id: 'promedio', label: 'Promedio' },
];

const PEC_FILE_NAMES = {
    pec21: 'distritos_analisis_3_PEC21.json',
    pec18: 'distritos_analisis_3_PEC18.json',
    promedio: 'distritos_analisis_PECPromedio.json',
};

// ---------------------------------------------------------------------------
// Geometría distrital nacional
// Extraída de mapaNacionalColores.html y almacenada por entidad normalizada.
// Las coordenadas se ajustan automáticamente al viewBox del SVG.
// ---------------------------------------------------------------------------
const DISTRICT_GEOMETRY_BY_ENTITY = distritosGeometriaMexico;

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
const SeccionesGHMap = () => {
    // Averages dataset state
    const [entidadesData, setEntidadesData] = useState([]);
    const [filename, setFilename] = useState('');
    const [loadingData, setLoadingData] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showTable, setShowTable] = useState(false);

    // Map state
    const [geoJson] = useState(mexicoGeoData);
    const [selectedStates, setSelectedStates] = useState({ 1: null, 2: null });
    const [districtMapSelection, setDistrictMapSelection] = useState({
        1: { tab: 'pec24', variable: STAGE1_DISPLAY_ORDER[0] },
        2: { tab: 'pec24', variable: STAGE2_DISPLAY_ORDER[0] },
    });
    const [hoveredDistrict, setHoveredDistrict] = useState({ 1: null, 2: null });
    const [selectedDistrict, setSelectedDistrict] = useState({ 1: null, 2: null });
    const districtSummaryRefs = useRef({ 1: null, 2: null });
    const districtRowRefs = useRef({ 1: {}, 2: {} });

    const centerDistrictInSummary = (stage, districtId, behavior = 'smooth') => {
        if (districtId === null || districtId === undefined) return;

        const container = districtSummaryRefs.current[stage];
        const row = districtRowRefs.current[stage]?.[districtId];
        if (!container || !row) return;

        // Se calcula la posición con rectángulos relativos al viewport y el
        // scroll actual del panel. offsetTop podía quedar referido a otro
        // contenedor y enviar el listado hasta el final.
        const containerRect = container.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const rowTopInsideContainer = container.scrollTop + (rowRect.top - containerRect.top);
        const targetTop = rowTopInsideContainer
            - (container.clientHeight / 2)
            + (rowRect.height / 2);
        const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
        const clampedTop = Math.min(maxTop, Math.max(0, targetTop));

        // Durante hover se usa desplazamiento inmediato para que cada nuevo
        // distrito interrumpa al anterior y el panel pueda avanzar o regresar.
        if (behavior === 'auto') {
            container.scrollTop = clampedTop;
            return;
        }

        container.scrollTo({ top: clampedTop, behavior });
    };

    useEffect(() => {
        [1, 2].forEach(stage => {
            centerDistrictInSummary(stage, selectedDistrict[stage]);
        });
    }, [selectedDistrict]);

    // Clustering state
    const [clusterK1, setClusterK1] = useState(3);
    const [clusterK2, setClusterK2] = useState(3);
    const [clustersStage1, setClustersStage1] = useState([]);
    const [clustersStage2, setClustersStage2] = useState([]);

    // ---------------------------------------------------------------------------
    // Datasets históricos
    // PEC 2023-2024: importado estáticamente (siempre disponible).
    // PEC 2020-2021 y PEC 2017-2018: cargados dinámicamente; son null si el
    // archivo aún no existe en src/data/.
    // ---------------------------------------------------------------------------
    const [distritosDataPec24] = useState({
        etapa1: distritosAnalisisData.etapa1 || [],
        etapa2: distritosAnalisisData.etapa2 || [],
    });
    const [distritosDataPromedio] = useState({
        etapa1: distritosAnalisisPromedio.etapa1 || [],
        etapa2: distritosAnalisisPromedio.etapa2 || [],
    });
    const [distritosDataPec21, setDistritosDataPec21] = useState(null);
    const [distritosDataPec18, setDistritosDataPec18] = useState(null);

    useEffect(() => {
        import('../data/distritos_analisis_3_PEC21.json')
            .then(mod => {
                const data = mod.default || mod;
                setDistritosDataPec21({
                    etapa1: data.etapa1 || [],
                    etapa2: data.etapa2 || [],
                });
            })
            .catch(() => setDistritosDataPec21(null));

        import('../data/distritos_analisis_3_PEC18.json')
            .then(mod => {
                const data = mod.default || mod;
                setDistritosDataPec18({
                    etapa1: data.etapa1 || [],
                    etapa2: data.etapa2 || [],
                });
            })
            .catch(() => setDistritosDataPec18(null));
    }, []);

    const loadingDistritos = false;

    // Modal de distritos por entidad (pestaña independiente del ranking)
    const [modalEntidad, setModalEntidad] = useState(null);
    const [modalSortMode, setModalSortMode] = useState('original');
    const [exportingDistritos, setExportingDistritos] = useState(false);
    const [distritosTab, setDistritosTab] = useState('pec24');

    // Modal de ranking nacional (pestaña independiente del modal de distritos)
    const [rankingModalStage, setRankingModalStage] = useState(null);
    const [rankingSortMode, setRankingSortMode] = useState('rapido');
    const [exportingRanking, setExportingRanking] = useState(false);
    const [rankingTab, setRankingTab] = useState('pec24');

    // ---------------------------------------------------------------------------
    // Carga de datos de promedios (API)
    // ---------------------------------------------------------------------------
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

    // ---------------------------------------------------------------------------
    // Helpers de mapa y clustering
    // ---------------------------------------------------------------------------
    const buildEntityMap = () => {
        const stateMap = {};
        entidadesData.forEach(s => {
            if (s.Entidad) stateMap[normalizeText(s.Entidad)] = s;
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

        return {
            promedio: getStageAverage(stateMap[key], stage),
            grupo: clusterLookup[key]?.group || null,
            color: clusterLookup[key]?.color || NO_DATA_COLOR,
            hasData: Boolean(stateMap[key]),
        };
    };

    // ---------------------------------------------------------------------------
    // Helpers de distritos con soporte de pestaña activa
    // ---------------------------------------------------------------------------
    const getActiveDataset = (tab) => {
        if (tab === 'pec21') return distritosDataPec21;
        if (tab === 'pec18') return distritosDataPec18;
        if (tab === 'promedio') return distritosDataPromedio;
        return distritosDataPec24;
    };

    const getStageDistritos = (stage, tab) => {
        const dataset = getActiveDataset(tab);
        if (!dataset) return [];
        return stage === 1 ? dataset.etapa1 : dataset.etapa2;
    };

    const getDistritosPorEntidad = (stage, entidad, tab) => {
        const key = normalizeText(entidad);
        return getStageDistritos(stage, tab).filter(d => normalizeText(d.Entidad) === key);
    };

    const getEntidadGeoFeature = (entidad) => {
        if (!geoJson?.features) return null;
        const key = normalizeText(entidad);
        return geoJson.features.find(f => normalizeText(f.properties?.name) === key) || null;
    };

    const getStageColorRange = (stage, tab) => {
        const variables = getStageVariables(stage);
        const values = [];

        getStageDistritos(stage, tab).forEach(d => {
            variables.forEach(v => {
                const value = toNumber(d[v.key], NaN);
                if (Number.isFinite(value)) values.push(value);
            });
        });

        if (values.length === 0) return { min: 0, max: 1 };
        return { min: Math.min(...values), max: Math.max(...values) };
    };

    const getStageRanking = (stage, tab) => {
        const variables = getStageVariables(stage);
        const sorted = [...getStageDistritos(stage, tab)].sort((a, b) =>
            compareDistritosByScore(a, b, variables)
        );
        return sorted.map((d, idx) => ({ ...d, __posicion: idx + 1 }));
    };

    // ---------------------------------------------------------------------------
    // Helpers del mapa distrital piloto
    // ---------------------------------------------------------------------------
    const buildDistrictSvgGeometry = (districts, width = 760, height = 500, padding = 58) => {
        const points = districts.flatMap(d =>
            (d.c || []).flatMap(polygon => polygon)
        );

        if (points.length === 0) return [];

        const useExternalLabels = districts.length > 6;
        const labelMinGap = 31;
        const labelTop = 28;
        const labelBottom = height - 28;
        const usableLabelHeight = labelBottom - labelTop;
        const maxRowsPerColumn = Math.max(1, Math.floor(usableLabelHeight / labelMinGap) + 1);
        const sideCount = Math.ceil(districts.length / 2);
        const columnsPerSide = useExternalLabels
            ? Math.max(1, Math.ceil(sideCount / maxRowsPerColumn))
            : 0;
        const labelColumnWidth = 60;
        const horizontalLabelSpace = useExternalLabels
            ? 30 + columnsPerSide * labelColumnWidth
            : 28;

        const xs = points.map(p => p[0]);
        const ys = points.map(p => p[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const spanX = maxX - minX || 1;
        const spanY = maxY - minY || 1;
        const mapPaddingX = Math.max(padding, horizontalLabelSpace);
        const mapPaddingY = useExternalLabels ? 34 : 28;
        const scale = Math.min(
            (width - mapPaddingX * 2) / spanX,
            (height - mapPaddingY * 2) / spanY
        );
        const drawWidth = spanX * scale;
        const drawHeight = spanY * scale;
        const offsetX = (width - drawWidth) / 2;
        const offsetY = (height - drawHeight) / 2;

        const project = ([x, y]) => [
            offsetX + (x - minX) * scale,
            height - (offsetY + (y - minY) * scale),
        ];

        const projectedDistricts = districts.map(district => {
            const polygons = (district.c || []).map(polygon => {
                const projected = polygon.map(project);
                const path = projected
                    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
                    .join(' ') + ' Z';

                const centroid = projected.reduce(
                    (acc, [x, y]) => ({ x: acc.x + x, y: acc.y + y }),
                    { x: 0, y: 0 }
                );

                return {
                    path,
                    centroid: {
                        x: centroid.x / Math.max(projected.length, 1),
                        y: centroid.y / Math.max(projected.length, 1),
                    },
                    pointCount: projected.length,
                };
            });

            const labelPolygon = [...polygons].sort((a, b) => b.pointCount - a.pointCount)[0];
            return {
                id: district.d,
                path: polygons.map(p => p.path).join(' '),
                centerX: labelPolygon?.centroid.x ?? width / 2,
                centerY: labelPolygon?.centroid.y ?? height / 2,
            };
        });

        if (!useExternalLabels) {
            return projectedDistricts.map(district => ({
                ...district,
                labelX: district.centerX,
                labelY: district.centerY,
                textAnchor: 'middle',
                externalLabel: false,
            }));
        }

        // Se divide el conjunto por posición horizontal para mantener las líneas
        // guía cortas y, al mismo tiempo, equilibrar la cantidad de etiquetas.
        const orderedByX = [...projectedDistricts].sort((a, b) => a.centerX - b.centerX);
        const splitAt = Math.ceil(orderedByX.length / 2);
        const sideGroups = {
            left: orderedByX.slice(0, splitAt),
            right: orderedByX.slice(splitAt),
        };

        const layoutSide = (items, side) => {
            const ordered = [...items].sort((a, b) => a.centerY - b.centerY);
            const columnCount = Math.max(1, Math.ceil(ordered.length / maxRowsPerColumn));
            const columns = Array.from({ length: columnCount }, () => []);

            // Reparto serpenteante: conserva el orden vertical y evita que una
            // columna quede saturada mientras otra tiene espacios vacíos.
            ordered.forEach((district, index) => {
                const columnIndex = index % columnCount;
                columns[columnIndex].push(district);
            });

            const positions = new Map();
            columns.forEach((columnItems, columnIndex) => {
                const count = columnItems.length;
                const gap = count > 1
                    ? Math.max(labelMinGap, usableLabelHeight / (count - 1))
                    : 0;
                const usedHeight = gap * Math.max(count - 1, 0);
                const startY = labelTop + (usableLabelHeight - usedHeight) / 2;
                const innerToOuter = columnCount - 1 - columnIndex;

                columnItems.forEach((district, rowIndex) => {
                    const labelY = startY + rowIndex * gap;
                    const labelX = side === 'left'
                        ? 10 + innerToOuter * labelColumnWidth
                        : width - 10 - innerToOuter * labelColumnWidth;
                    const lineEndX = side === 'left' ? labelX + 43 : labelX - 43;

                    positions.set(district.id, {
                        labelX,
                        labelY,
                        lineEndX,
                        lineEndY: labelY,
                        textAnchor: side === 'left' ? 'start' : 'end',
                        externalLabel: true,
                    });
                });
            });
            return positions;
        };

        const leftPositions = layoutSide(sideGroups.left, 'left');
        const rightPositions = layoutSide(sideGroups.right, 'right');

        return projectedDistricts.map(district => ({
            ...district,
            ...(leftPositions.get(district.id) || rightPositions.get(district.id)),
        }));
    };

    const getDistrictMapValue = (districtRow, variableKey) =>
        toNumber(districtRow?.[variableKey], NaN);

    const getDistrictMapRow = (stage, entity, tab, districtId) =>
        getDistritosPorEntidad(stage, entity, tab).find(
            row => toNumber(row.ID_Distrito, NaN) === toNumber(districtId, NaN)
        );

    const updateDistrictMapSelection = (stage, patch) => {
        setDistrictMapSelection(prev => {
            const nextSelection = { ...prev[stage], ...patch };

            // PEC 2017-2018 no utiliza Número óptimo. Si estaba seleccionada,
            // cambiamos automáticamente a la primera variable disponible.
            if (nextSelection.tab === 'pec18' && nextSelection.variable === 'numero_optimo') {
                nextSelection.variable = getStageDisplayVariables(stage)
                    .find(variable => variable.key !== 'numero_optimo')?.key;
            }

            return {
                ...prev,
                [stage]: nextSelection,
            };
        });
    };

    // ---------------------------------------------------------------------------
    // Handlers de modales
    // ---------------------------------------------------------------------------
    const openDistritosModal = (stage, entidad) => {
        setModalSortMode('original');
        setDistritosTab('pec24');
        setModalEntidad({ stage, entidad });
    };
    const closeDistritosModal = () => setModalEntidad(null);

    const openRankingModal = (stage) => {
        setRankingSortMode('rapido');
        setRankingTab('pec24');
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

    // ---------------------------------------------------------------------------
    // Mapa Plotly
    // ---------------------------------------------------------------------------
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
                        marker: { line: { color: 'rgba(0,0,0,0)', width: 0 } },
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
                            tickfont: { color: '#0b5d47', size: 10, family: 'Outfit, sans-serif' },
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
                            colorscale: [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']],
                            showscale: false,
                            hoverinfo: 'skip',
                            marker: { line: { color: '#111827', width: 2 } },
                        },
                    ] : []),
                ]}
                layout={{
                    geo: {
                        visible: false,
                        projection: { type: 'mercator', scale: 1.02 },
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
                        if (clickedState) handleStateClick(stage, clickedState);
                    }
                }}
                config={{ displayModeBar: false, scrollZoom: false, responsive: true }}
            />
        );
    };

    // ---------------------------------------------------------------------------
    // Render: tarjetas de clusters
    // ---------------------------------------------------------------------------
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

    // ---------------------------------------------------------------------------
    // Render: mapa distrital por entidad
    // ---------------------------------------------------------------------------
    const renderDistrictMapCard = ({ stage, entidad }) => {
        const entityKey = normalizeText(entidad);
        const districtGeometry = DISTRICT_GEOMETRY_BY_ENTITY[entityKey] || [];
        const selection = districtMapSelection[stage];
        const activeDataset = getActiveDataset(selection.tab);
        const variables = getStageDisplayVariables(stage).filter(
            variable => !(selection.tab === 'pec18' && variable.key === 'numero_optimo')
        );
        const activeVariable = variables.find(v => v.key === selection.variable) || variables[0];
        const datasetUnavailable = activeDataset === null;
        const districtRows = getDistritosPorEntidad(stage, entidad, selection.tab);
        const range = getStageColorRange(stage, selection.tab);
        const svgDistricts = buildDistrictSvgGeometry(districtGeometry);
        const pecLabel = PEC_TABS.find(tab => tab.id === selection.tab)?.label || '';
        const activeDistrictId = hoveredDistrict[stage] ?? selectedDistrict[stage];
        const setDistrictHover = districtId => setHoveredDistrict(prev => ({ ...prev, [stage]: districtId }));
        const clearDistrictHover = () => setHoveredDistrict(prev => ({ ...prev, [stage]: null }));
        const toggleDistrictSelection = districtId => setSelectedDistrict(prev => ({
            ...prev,
            [stage]: prev[stage] === districtId ? null : districtId,
        }));

        return (
            <div className="ep-district-map-card">
                <div className="ep-district-map-heading">
                    <div>
                        <span className="ep-district-map-kicker">Mapa distrital interactivo</span>
                        <h4>{entidad}</h4>
                        <p>{getStageLabel(stage)}</p>
                    </div>
                    <span className="ep-district-map-count">{svgDistricts.length} distritos</span>
                </div>

                <div className="ep-district-map-controls">
                    <div className="ep-district-control-group">
                        <span>Proceso electoral</span>
                        <div className="ep-district-chip-row">
                            {PEC_TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    className={selection.tab === tab.id ? 'active' : ''}
                                    onClick={() => updateDistrictMapSelection(stage, { tab: tab.id })}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="ep-district-control-group">
                        <span>Variable</span>
                        <div className="ep-district-chip-row ep-district-variable-row">
                            {variables.map(variable => (
                                <button
                                    key={variable.key}
                                    type="button"
                                    className={activeVariable?.key === variable.key ? 'active' : ''}
                                    onClick={() => updateDistrictMapSelection(stage, { variable: variable.key })}
                                >
                                    {variable.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {districtGeometry.length === 0 ? (
                    <div className="ep-empty-state" style={{ minHeight: 180 }}>
                        No se encontró geometría distrital para {entidad}.
                    </div>
                ) : datasetUnavailable ? (
                    renderDatasetUnavailable(selection.tab)
                ) : districtRows.length === 0 ? (
                    <div className="ep-empty-state" style={{ minHeight: 180 }}>
                        No hay datos distritales de {entidad} para {pecLabel}.
                    </div>
                ) : (
                    <div className="ep-district-map-layout">
                        <div className="ep-district-map-svg-wrap">
                            <svg
                                viewBox="0 0 760 500"
                                className="ep-district-map-svg"
                                role="img"
                                aria-label={`Distritos de ${entidad}, ${pecLabel}, ${activeVariable?.label}`}
                            >
                                {svgDistricts.map(district => {
                                    const row = getDistrictMapRow(stage, entidad, selection.tab, district.id);
                                    const value = getDistrictMapValue(row, activeVariable?.key);
                                    const fill = getHeatColor(value, range.min, range.max);
                                    const districtName = row?.Distrito || `Distrito ${district.id}`;

                                    const isSelected = toNumber(selectedDistrict[stage], NaN) === toNumber(district.id, NaN);
                                    const isHovered = toNumber(hoveredDistrict[stage], NaN) === toNumber(district.id, NaN);
                                    const groupClassName = [
                                        'ep-district-group',
                                        (isSelected || isHovered) ? 'active' : '',
                                        isSelected ? 'selected' : '',
                                        isHovered ? 'hovered' : '',
                                    ].filter(Boolean).join(' ');

                                    return (
                                        <g
                                            key={district.id}
                                            className={groupClassName}
                                            onMouseEnter={() => {
                                                setDistrictHover(district.id);
                                                centerDistrictInSummary(stage, district.id, 'auto');
                                            }}
                                            onMouseLeave={clearDistrictHover}
                                            onClick={() => toggleDistrictSelection(district.id)}
                                        >
                                            <path
                                                d={district.path}
                                                fill={fill}
                                                className="ep-district-shape"
                                            >
                                                <title>
                                                    {`${districtName}: ${Number.isFinite(value) ? `${value.toFixed(2)} días` : 'Sin dato'}`}
                                                </title>
                                            </path>
                                            {district.externalLabel && (
                                                <line
                                                    x1={district.centerX}
                                                    y1={district.centerY}
                                                    x2={district.lineEndX}
                                                    y2={district.lineEndY}
                                                    className="ep-district-leader"
                                                />
                                            )}
                                            <text
                                                x={district.labelX}
                                                y={district.externalLabel ? district.labelY - 3 : district.labelY - 4}
                                                textAnchor={district.textAnchor}
                                                className="ep-district-label"
                                            >
                                                D{String(district.id).padStart(2, '0')}
                                            </text>
                                            <text
                                                x={district.labelX}
                                                y={district.externalLabel ? district.labelY + 11 : district.labelY + 14}
                                                textAnchor={district.textAnchor}
                                                className="ep-district-value"
                                            >
                                                {Number.isFinite(value) ? value.toFixed(2) : '—'}
                                            </text>
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>

                        <div
                            className="ep-district-map-summary"
                            ref={element => { districtSummaryRefs.current[stage] = element; }}
                        >
                            <div className="ep-district-summary-title">
                                <strong>{activeVariable?.label}</strong>
                                <span>{pecLabel}</span>
                            </div>
                            {svgDistricts.map(district => {
                                const row = getDistrictMapRow(stage, entidad, selection.tab, district.id);
                                const value = getDistrictMapValue(row, activeVariable?.key);
                                const fill = getHeatColor(value, range.min, range.max);
                                return (
                                    <button
                                        type="button"
                                        className={`ep-district-summary-row${toNumber(activeDistrictId, NaN) === toNumber(district.id, NaN) ? ' active' : ''}`}
                                        key={district.id}
                                        ref={element => {
                                            if (element) districtRowRefs.current[stage][district.id] = element;
                                            else delete districtRowRefs.current[stage][district.id];
                                        }}
                                        onMouseEnter={() => {
                                            setDistrictHover(district.id);
                                            centerDistrictInSummary(stage, district.id, 'auto');
                                        }}
                                        onMouseLeave={clearDistrictHover}
                                        onClick={() => toggleDistrictSelection(district.id)}
                                    >
                                        <span className="ep-district-summary-swatch" style={{ background: fill }} />
                                        <span className="ep-district-summary-name">
                                            D{String(district.id).padStart(2, '0')} · {row?.Distrito || `Distrito ${district.id}`}
                                        </span>
                                        <strong>{Number.isFinite(value) ? value.toFixed(2) : '—'}</strong>
                                    </button>
                                );
                            })}
                            <div className="ep-heatmap-legend ep-district-map-legend">
                                <Thermometer size={14} />
                                <span>Más rápido</span>
                                <div className="ep-heatmap-gradient" />
                                <span>Más lento</span>
                            </div>
                            <small>
                                Escala nacional de la etapa y proceso seleccionados, igual a la utilizada en la tabla de calor.
                            </small>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ---------------------------------------------------------------------------
    // Render: tarjeta de mapa
    // ---------------------------------------------------------------------------
    const renderMapCard = ({ stage, clusters, activeK }) => {
        const selectedState = selectedStates[stage];
        const selectedStateInfo = getSelectedStateInfo(stage, clusters);
        const stageLabel = getStageLabel(stage);

        return (
            <div className="ep-stage-map-card">
                <div className="ep-stage-map-header">
                    <h4><MapIcon size={17} /> Mapa de Clusters</h4>
                    <span className="ep-stage-pill">{getStageShortLabel(stage)} · K={activeK}</span>
                </div>

                <div className="ep-map-shell">
                    {geoJson && !loadingData && clusters.length > 0
                        ? getMapPlot({ stage, clusters, activeK })
                        : <div className="ep-map-loading">Cargando mapa y grupos...</div>
                    }
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

                {selectedState && renderDistrictMapCard({ stage, entidad: selectedState })}
            </div>
        );
    };

    // ---------------------------------------------------------------------------
    // Render: barra de pestañas PEC (reutilizable)
    // ---------------------------------------------------------------------------
    const renderPecTabBar = ({ activeTab, onTabChange }) => (
        <div className="gh-pec-tabs" role="tablist" aria-label="Seleccionar PEC">
            {PEC_TABS.map(tab => (
                <button
                    key={tab.id}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    className={`gh-pec-tab${activeTab === tab.id ? ' gh-pec-tab-active' : ''}`}
                    onClick={() => onTabChange(tab.id)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );

    // ---------------------------------------------------------------------------
    // Render: mensaje dataset no disponible
    // ---------------------------------------------------------------------------
    const renderDatasetUnavailable = (tab) => (
        <div className="ep-empty-state gh-dataset-unavailable" style={{ minHeight: 160 }}>
            <div>
                <div className="gh-unavailable-icon">📂</div>
                <div className="gh-unavailable-title">Dataset no disponible</div>
                <div className="gh-unavailable-desc">
                    El archivo <code>{PEC_FILE_NAMES[tab]}</code> aún no ha sido cargado en{' '}
                    <code>src/data/</code>. Agréguelo y reconstruya la aplicación para habilitar esta pestaña.
                </div>
            </div>
        </div>
    );

    // ---------------------------------------------------------------------------
    // Render: modal de distritos por entidad
    // ---------------------------------------------------------------------------
    const renderDistritosModal = () => {
        if (!modalEntidad) return null;

        const { stage, entidad } = modalEntidad;
        const variables = getStageVariables(stage);
        const displayVariables = getStageDisplayVariables(stage);

        const activeDataset = getActiveDataset(distritosTab);
        const datasetUnavailable = activeDataset === null;

        const stageColorRange = getStageColorRange(stage, distritosTab);
        const ranges = displayVariables.map(v => ({ ...v, ...stageColorRange }));
        const datasetIsEmpty = getStageDistritos(stage, distritosTab).length === 0;

        const baseDistritos = getDistritosPorEntidad(stage, entidad, distritosTab)
            .slice()
            .sort((a, b) => toNumber(a.ID_Distrito) - toNumber(b.ID_Distrito));

        const distritos = modalSortMode === 'lento'
            ? [...baseDistritos].sort((a, b) => compareDistritosByScore(b, a, variables))
            : baseDistritos;

        const distritoColWidthPct = 26;
        const variableColWidthPct = (100 - distritoColWidthPct) / (displayVariables.length || 1);

        const geoFeature = getEntidadGeoFeature(entidad);
        const miniMap = geoFeature ? buildEntidadMiniMapPath(geoFeature.geometry) : null;

        const pecLabel = PEC_TABS.find(t => t.id === distritosTab)?.label || '';

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
                    fileName: `distritos_${sanitizeFileName(entidad)}_${getStageShortLabel(stage)}_${sanitizeFileName(pecLabel)}.xlsx`,
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
                    {/* ── Barra de pestañas PEC (reemplaza getStageLabel) ── */}
                    {renderPecTabBar({
                        activeTab: distritosTab,
                        onTabChange: (id) => { setDistritosTab(id); setModalSortMode('original'); },
                    })}

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
                        <div className="ep-empty-state" style={{ minHeight: 140 }}>Cargando dataset de distritos...</div>
                    ) : datasetUnavailable ? (
                        renderDatasetUnavailable(distritosTab)
                    ) : datasetIsEmpty ? (
                        <div className="ep-empty-state" style={{ minHeight: 140 }}>Aún no se ha cargado el dataset de distritos.</div>
                    ) : distritos.length === 0 ? (
                        <div className="ep-empty-state" style={{ minHeight: 140 }}>No se encontraron distritos para {entidad}.</div>
                    ) : (
                        <>
                            <div className="ep-modal-toolbar">
                                <div className="ep-modal-toolbar-spacer" style={{ width: `${distritoColWidthPct}%` }} />
                                <span className="ep-modal-legend-label">Día en el que alcanza:</span>
                                <button
                                    className="ep-sort-btn"
                                    onClick={() => setModalSortMode(prev => (prev === 'lento' ? 'original' : 'lento'))}
                                >
                                    {modalSortMode === 'lento' ? '↺ Restablecer orden original' : 'Ordenar: más lento → más rápido'}
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
                                {distritosTab === 'promedio' && (
                                    <a
                                        href="/PEC_General_AD.xlsx"
                                        download="PEC_General_AD.xlsx"
                                        className="ep-export-btn"
                                        style={{ background: '#f59e0b', color: '#fff', border: 'none', marginLeft: '6px', textDecoration: 'none' }}
                                        title="Descargar DataSet Completo"
                                    >
                                        <Download size={14} />
                                        <span>Descargar DataSet</span>
                                    </a>
                                )}
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

    // ---------------------------------------------------------------------------
    // Render: modal de ranking nacional
    // ---------------------------------------------------------------------------
    const renderRankingModal = () => {
        if (!rankingModalStage) return null;

        const stage = rankingModalStage;
        const displayVariables = getStageDisplayVariables(stage);

        const activeDataset = getActiveDataset(rankingTab);
        const datasetUnavailable = activeDataset === null;

        const stageColorRange = getStageColorRange(stage, rankingTab);
        const ranges = displayVariables.map(v => ({ ...v, ...stageColorRange }));
        const ranking = getStageRanking(stage, rankingTab);

        const distritos = rankingSortMode === 'lento'
            ? [...ranking].sort((a, b) => b.__posicion - a.__posicion)
            : [...ranking].sort((a, b) => a.__posicion - b.__posicion);

        const pecLabel = PEC_TABS.find(t => t.id === rankingTab)?.label || '';

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
                    fileName: `ranking_nacional_${getStageShortLabel(stage)}_${sanitizeFileName(pecLabel)}.xlsx`,
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
                    {/* ── Barra de pestañas PEC (reemplaza getStageLabel) ── */}
                    {renderPecTabBar({
                        activeTab: rankingTab,
                        onTabChange: (id) => { setRankingTab(id); setRankingSortMode('rapido'); },
                    })}

                    <div className="ep-modal-header">
                        <div>
                            <span className="ep-modal-stage-label">{getStageLabel(stage)}</span>
                            <h3>📋 Ranking nacional de los 300 distritos</h3>
                        </div>
                        <button className="ep-modal-close" onClick={closeRankingModal} aria-label="Cerrar">
                            <X size={18} />
                        </button>
                    </div>

                    {datasetUnavailable ? (
                        renderDatasetUnavailable(rankingTab)
                    ) : (
                        <>
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
                                <button
                                    className="ep-export-btn"
                                    onClick={handleExportRanking}
                                    disabled={exportingRanking}
                                    title="Exportar esta tabla a Excel"
                                >
                                    <Download size={14} />
                                    {exportingRanking ? 'Exportando...' : 'Exportar a Excel'}
                                </button>
                                {rankingTab === 'promedio' && (
                                    <a
                                        href="/PEC_General_AD.xlsx"
                                        download="PEC_General_AD.xlsx"
                                        className="ep-export-btn"
                                        style={{ background: '#f59e0b', color: '#fff', border: 'none', marginLeft: '6px', textDecoration: 'none' }}
                                        title="Descargar DataSet Completo"
                                    >
                                        <Download size={14} />
                                        <span>Descargar DataSet</span>
                                    </a>
                                )}
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
                        </>
                    )}
                </div>
            </div>
        );
    };

    // ---------------------------------------------------------------------------
    // Render: sección de etapa (mapa + clusters)
    // ---------------------------------------------------------------------------
    const renderStageSection = ({ stage, title, activeK, setActiveK, clusters }) => (
        <div className="ep-panel ep-stage-card">
            <div className="ep-stage-titlebar">
                <div>
                    <h3><Layers size={18} /> {title}</h3>
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

    // ---------------------------------------------------------------------------
    // Render principal
    // ---------------------------------------------------------------------------
    return (
        <div className="dashboard-container ep-light" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            <style>{`
        /* ================================================================
           Estilos heredados de EntidadPromedio
           ================================================================ */
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
        .ep-stage-card { padding: 20px; margin-bottom: 24px; }
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
        .ep-stage-titlebar p { margin: 0; }
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
        .ep-stage-clusters-panel, .ep-stage-map-card { min-width: 0; }
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
        .ep-ranking-btn:hover { background: rgba(213, 0, 127, 0.08); }
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
        .ep-map-loading, .ep-empty-state {
          min-height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9b5982;
          border-radius: 12px;
          background: rgba(213, 0, 127, 0.04);
          border: 1px dashed rgba(213, 0, 127, 0.18);
        }
        .ep-map-loading { min-height: 420px; }
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
        .ep-selected-state-card > div { display: flex; flex-direction: column; gap: 3px; }
        .ep-selected-state-title { color: #8b004f; font-weight: 800; font-size: 0.92rem; }
        .ep-selected-state-detail { color: #8b004f; font-size: 0.84rem; }
        .ep-selected-state-card button {
          border: none;
          background: transparent;
          color: #d5007f;
          cursor: pointer;
          font-weight: 700;
          white-space: nowrap;
        }
        .ep-cluster-item-clickable {
          cursor: pointer;
          border-radius: 8px;
          padding: 4px 6px;
          margin: -4px -6px;
          transition: background 0.15s ease, transform 0.1s ease;
        }
        .ep-cluster-item-clickable:hover { background: rgba(213, 0, 127, 0.08); }
        .ep-cluster-item-clickable:active { transform: scale(0.98); }
        .ep-district-map-card {
          margin-top: 16px;
          padding: 18px;
          height: 790px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgba(213, 0, 127, 0.18);
          border-radius: 18px;
          background: linear-gradient(145deg, #fff 0%, #fff8fc 100%);
          box-shadow: 0 14px 34px rgba(107, 0, 64, 0.08);
        }
        .ep-district-map-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 16px;
        }
        .ep-district-map-kicker {
          display: block;
          margin-bottom: 4px;
          color: #d5007f;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .ep-district-map-heading h4 {
          margin: 0;
          color: #6b0040;
          font-size: 1.3rem;
        }
        .ep-district-map-heading p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 0.86rem;
        }
        .ep-district-map-count {
          padding: 7px 11px;
          border-radius: 999px;
          background: #fce4f3;
          color: #8b004f;
          font-size: 0.76rem;
          font-weight: 800;
          white-space: nowrap;
        }
        .ep-district-map-controls {
          display: grid;
          gap: 13px;
          margin-bottom: 16px;
          flex: 0 0 auto;
        }
        .ep-district-control-group > span {
          display: block;
          margin-bottom: 7px;
          color: #475569;
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .ep-district-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }
        .ep-district-chip-row button {
          border: 1px solid #f1bad7;
          border-radius: 999px;
          padding: 7px 11px;
          background: #fff;
          color: #7a1f54;
          font-size: 0.76rem;
          font-weight: 700;
          cursor: pointer;
          transition: 0.16s ease;
        }
        .ep-district-chip-row button:hover {
          border-color: #d5007f;
          transform: translateY(-1px);
        }
        .ep-district-chip-row button.active {
          border-color: #d5007f;
          background: #d5007f;
          color: #fff;
          box-shadow: 0 6px 14px rgba(213, 0, 127, 0.22);
        }
        .ep-district-variable-row button {
          border-radius: 10px;
        }
        .ep-district-map-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(240px, 0.65fr);
          gap: 18px;
          align-items: stretch;
          flex: 1 1 auto;
          min-height: 0;
          overflow: hidden;
        }
        .ep-district-map-svg-wrap {
          min-height: 0;
          height: 100%;
          border: 1px solid #f3d2e4;
          border-radius: 16px;
          background: #fff;
          overflow: hidden;
        }
        .ep-district-map-svg {
          display: block;
          width: 100%;
          height: 100%;
          min-height: 0;
        }
        .ep-district-shape {
          stroke: #fff;
          stroke-width: 2.2;
          vector-effect: non-scaling-stroke;
          transition: filter 0.15s ease, opacity 0.15s ease;
        }
        .ep-district-group { cursor: pointer; }
        .ep-district-group:hover .ep-district-shape,
        .ep-district-group.active .ep-district-shape {
          filter: drop-shadow(0 0 8px rgba(79, 227, 173, 0.72));
          opacity: 0.92;
          stroke: #d5007f;
;
          stroke-width: 3.6;
        }
        .ep-district-leader {
          stroke: #6b0040;
          stroke-width: 1.1;
          opacity: 0.56;
          pointer-events: none;
          vector-effect: non-scaling-stroke;
        }
        .ep-district-group.active .ep-district-leader {
          stroke: #d5007f;
;
          stroke-width: 2.2;
          opacity: 1;
        }
        .ep-district-group.selected .ep-district-shape {
          stroke: #d5007f;
;
          stroke-width: 3.6;
          filter: drop-shadow(0 0 8px rgba(79, 227, 173, 0.72));
        }
        .ep-district-group.selected .ep-district-leader {
          stroke: #d5007f;
;
          stroke-width: 2.2;
          opacity: 1;
        }
        .ep-district-label,
        .ep-district-value {
          pointer-events: none;
          paint-order: stroke;
          stroke: rgba(255,255,255,0.92);
          stroke-width: 4px;
          stroke-linejoin: round;
          fill: #3f0a29;
          font-family: Outfit, sans-serif;
          font-weight: 900;
        }
        .ep-district-label { font-size: 15.2px; }
        .ep-district-value { font-size: 13.3px; }
        .ep-district-group.active .ep-district-label,
        .ep-district-group.active .ep-district-value {
          fill: #d5007f;
;
          stroke: rgba(20, 60, 49, 0.96);
          stroke-width: 4.5px;
        }
        .ep-district-group.selected .ep-district-label,
        .ep-district-group.selected .ep-district-value {
          fill: #d5007f;
;
          stroke: rgba(20, 60, 49, 0.96);
          stroke-width: 4.5px;
        }
        .ep-district-map-summary {
          padding: 16px;
          border: 1px solid #f3d2e4;
          border-radius: 16px;
          background: #fff;
          min-height: 0;
          overflow-y: auto;
          scrollbar-gutter: stable;
          scroll-behavior: smooth;
          overscroll-behavior: contain;
        }
        .ep-district-summary-title {
          display: grid;
          gap: 4px;
          margin-bottom: 14px;
        }
        .ep-district-summary-title strong {
          color: #6b0040;
          font-size: 0.92rem;
        }
        .ep-district-summary-title span {
          color: #d5007f;
          font-size: 0.78rem;
          font-weight: 700;
        }
        .ep-district-summary-row {
          display: grid;
          width: 100%;
          border: 0;
          background: transparent;
          text-align: left;
          font-family: inherit;
          cursor: pointer;
          grid-template-columns: 16px minmax(0, 1fr) auto;
          align-items: center;
          gap: 9px;
          padding: 10px 0;
          border-bottom: 1px solid #f8e5ef;
          color: #475569;
          font-size: 0.741rem;
          transition: background 0.14s ease, transform 0.14s ease;
        }
        .ep-district-summary-row:hover,
        .ep-district-summary-row.active {
          background: #fff0f8;
          transform: translateX(2px);
        }
        .ep-district-summary-row.active {
          box-shadow: inset 3px 0 0 #d5007f;
        }
        .ep-district-summary-swatch {
          width: 14px;
          height: 14px;
          border-radius: 4px;
          border: 1px solid rgba(0,0,0,0.08);
        }
        .ep-district-summary-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ep-district-summary-row strong {
          color: #6b0040;
        }
        .ep-district-map-legend {
          margin-top: 16px;
        }
        .ep-district-map-summary small {
          display: block;
          margin-top: 10px;
          color: #94a3b8;
          line-height: 1.45;
        }
        .ep-district-map-pilot-note {
          margin-top: 14px;
          padding: 11px 13px;
          border-radius: 12px;
          background: #fff7ed;
          color: #9a3412;
          font-size: 0.8rem;
          font-weight: 650;
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
        .ep-modal-header h3 { margin: 0; color: #8b004f; font-size: 1.15rem; }
        .ep-modal-entidad-title {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 6px;
          text-align: left;
        }
        .ep-modal-entidad-icon { font-size: 1.15rem; line-height: 1; }
        .ep-entidad-mini-map { width: 1.15rem; height: 1.15rem; flex-shrink: 0; }
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
        .ep-modal-close:hover { background: rgba(213, 0, 127, 0.16); }
        .ep-modal-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .ep-modal-toolbar-spacer { flex-shrink: 0; }
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
        .ep-sort-btn:hover { background: rgba(213, 0, 127, 0.14); }
        .ep-sort-btn-active { background: #8b004f; border-color: #8b004f; color: #fff; }
        .ep-sort-btn-active:hover { background: #6b0040; }
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
        .ep-export-btn:hover { background: rgba(34, 139, 87, 0.16); }
        .ep-export-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .ep-ranking-card { max-width: 1100px; }
        .ep-ranking-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
        .ep-ranking-table-wrap { max-height: 60vh; overflow-y: auto; }
        .ep-ranking-table { min-width: 720px; }
        .ep-ranking-col-pos { width: 70px; text-align: center; }
        .ep-ranking-pos-cell { font-weight: 800; color: #8b004f; }
        .ep-ranking-col-entidad { text-align: left; white-space: nowrap; }
        .ep-ranking-col-id { width: 90px; text-align: center; }
        .ep-ranking-col-distrito { text-align: left; }
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

        /* ================================================================
           Nuevos estilos: barra de pestañas PEC
           ================================================================ */
        .gh-pec-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 14px;
          padding: 4px;
          background: rgba(213, 0, 127, 0.05);
          border: 1px solid rgba(213, 0, 127, 0.14);
          border-radius: 12px;
          width: fit-content;
        }
        .gh-pec-tab {
          border: none;
          background: transparent;
          color: #8b004f;
          font-size: 0.8rem;
          font-weight: 600;
          padding: 7px 16px;
          border-radius: 9px;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
          white-space: nowrap;
          letter-spacing: 0.01em;
        }
        .gh-pec-tab:hover:not(.gh-pec-tab-active) { background: rgba(213, 0, 127, 0.09); }
        .gh-pec-tab-active {
          background: #8b004f;
          color: #fff;
          box-shadow: 0 2px 8px rgba(139, 0, 79, 0.35);
        }

        /* ================================================================
           Nuevos estilos: estado "Dataset no disponible"
           ================================================================ */
        .gh-dataset-unavailable {
          flex-direction: column;
          gap: 10px;
          text-align: center;
          padding: 24px;
        }
        .gh-unavailable-icon { font-size: 2rem; margin-bottom: 8px; }
        .gh-unavailable-title {
          font-size: 1rem;
          font-weight: 700;
          color: #8b004f;
          margin-bottom: 6px;
        }
        .gh-unavailable-desc { font-size: 0.84rem; color: #9b5982; line-height: 1.5; }
        .gh-unavailable-desc code {
          background: rgba(213, 0, 127, 0.08);
          padding: 1px 5px;
          border-radius: 5px;
          font-size: 0.8rem;
          color: #6b0040;
        }

        /* ================================================================
           Responsive
           ================================================================ */
        @media (max-width: 900px) {
          .ep-district-map-layout { grid-template-columns: 1fr; }
          .ep-district-map-svg-wrap,
          .ep-district-map-svg { min-height: 340px; }
        }

        @media (max-width: 760px) {
          .ep-topbar, .ep-stage-titlebar { flex-direction: column; align-items: stretch; }
          .ep-actions, .ep-k-control { width: 100%; justify-content: flex-start; }
          .ep-stage-card { padding: 14px; }
          .ep-stage-cluster-grid { grid-template-columns: 1fr; }
          .ep-stage-map-header, .ep-selected-state-card { align-items: flex-start; flex-direction: column; }
          .ep-map-shell, .ep-map-loading { min-height: 440px; }
          .ep-modal-card { padding: 16px; max-height: 90vh; }
          .gh-pec-tabs { flex-wrap: wrap; width: 100%; }
          .gh-pec-tab { flex: 1; text-align: center; }
        }

        @media (max-width: 900px) {
          .ep-district-map-card { height: 920px; }
          .ep-district-map-layout {
            grid-template-columns: 1fr;
            grid-template-rows: minmax(360px, 1fr) 260px;
          }
        }
      `}</style>

            <div className="ep-topbar">
                <h2 style={{ color: '#d5007f', margin: 0 }}>📊 Análisis Histórico sobre el avance en metas de los Procesos Electorales</h2>
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
                        La herramienta permite agrupar a las entidades en 2, 3, 4 y 5 grupos con base en la velocidad a la que se alcanzan las metas en una etapa de capacitación determinada.
                    </p>
                </>
            )}

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
                title: '1ª Etapa de Capacitación — Histórico PEC 2017-2024',
                activeK: clusterK1,
                setActiveK: setClusterK1,
                clusters: clustersStage1,
            })}

            {renderStageSection({
                stage: 2,
                title: '2ª Etapa de Capacitación — Histórico PEC 2017-2024',
                activeK: clusterK2,
                setActiveK: setClusterK2,
                clusters: clustersStage2,
            })}

            {renderDistritosModal()}
            {renderRankingModal()}
        </div>
    );
};

export default SeccionesGHMap;