import { useEffect, useMemo, useState } from 'react';
import PlotlyComponent from 'react-plotly.js';
import { getAvanceDistritos, getEntidadesData } from '../services/api';
import mexicoGeoData from '../data/mexico_geo.json';
import distritosGeometriaMexico from '../data/distritos_geometria_mexico.json';
import { Map, Table2, Layers, Thermometer } from 'lucide-react';

const Plot = PlotlyComponent.default || PlotlyComponent;

const PEC_META = {
  pec18: { label: 'PEC 2017-2018', days: 56 },
  pec21: { label: 'PEC 2020-2021', days: 48 },
  pec24: { label: 'PEC 2023-2024', days: 52 },
};

const PEC_ORDER = ['pec18', 'pec21', 'pec24'];

const STAGE_VARIABLES = {
  1: [
    { key: 'visitados', label: 'Visitados' },
    { key: 'ccrl', label: 'CCRL' },
  ],
  2: [
    { key: 'nombramientos', label: 'Nombramientos' },
    { key: 'capacitacion', label: 'Capacitación' },
    { key: 'simulacros', label: 'Asistencia a Simulacros' },
  ],
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

const interpolateHeatColor = (t) => {
  const clamped = Math.min(Math.max(t, 0), 1);
  const low = [79, 227, 173];
  const high = [255, 32, 20];
  const rgb = low.map((component, index) => Math.round(component + (high[index] - component) * clamped));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
};

const getHeatColor = (ratio) => {
  if (!Number.isFinite(ratio)) return '#e2e8f0';
  return interpolateHeatColor(ratio);
};

const getTextColor = (ratio) => (ratio > 0.58 ? '#fff' : '#0f172a');

const getStageAverage = (row, stage) => {
  if (!row) return null;
  const field = stage === 1 ? 'E1_Promedio' : 'E2_Promedio';
  return toNumber(row[field], NaN);
};

const buildDistrictSvgGeometry = (districts, width = 760, height = 440, padding = 34) => {
  const preparedDistricts = (districts || []).map(district => ({
    ...district,
    c: district.c || [],
  }));

  const points = preparedDistricts.flatMap(district =>
    (district.c || []).flatMap(polygon => polygon)
  );

  if (points.length === 0) return [];

  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = Math.min(
    (width - padding * 2) / spanX,
    (height - padding * 2) / spanY
  );
  const drawWidth = spanX * scale;
  const drawHeight = spanY * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;

  const project = ([x, y]) => [
    offsetX + (x - minX) * scale,
    height - (offsetY + (y - minY) * scale),
  ];

  return preparedDistricts.map(district => {
    const polygons = (district.c || []).map(polygon => {
      const projected = polygon.map(project);
      const path = projected
        .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
        .join(' ') + ' Z';
      const centroid = projected.reduce(
        (accumulator, [x, y]) => ({ x: accumulator.x + x, y: accumulator.y + y }),
        { x: 0, y: 0 }
      );

      return {
        path,
        centroidX: centroid.x / Math.max(projected.length, 1),
        centroidY: centroid.y / Math.max(projected.length, 1),
      };
    });

    const mainPolygon = polygons[0];
    return {
      id: district.d,
      path: polygons.map(polygon => polygon.path).join(' '),
      centerX: mainPolygon?.centroidX ?? width / 2,
      centerY: mainPolygon?.centroidY ?? height / 2,
    };
  });
};

const getDistrictKey = (row) => toNumber(row?.id_distrito ?? row?.ID_Distrito, NaN);

const AvanceDistxPEC = () => {
  const [activeStage, setActiveStage] = useState(1);
  const [activeVariable, setActiveVariable] = useState(STAGE_VARIABLES[1][0].key);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [hoveredDistrict, setHoveredDistrict] = useState(null);
  const [entidadesData, setEntidadesData] = useState([]);
  const [avanceData, setAvanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [geoJson] = useState(mexicoGeoData);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [entidadesResponse, avanceResponse] = await Promise.all([
          getEntidadesData().catch(() => null),
          getAvanceDistritos().catch(() => null),
        ]);
        if (!isMounted) return;
        setEntidadesData(entidadesResponse?.data || []);
        setAvanceData(avanceResponse || null);
      } catch (loadError) {
        console.error('Error loading avance data', loadError);
        if (isMounted) setError('No fue posible cargar los datos de avance entre PEC.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, []);


  const entityLookup = useMemo(() => {
    const lookup = {};
    entidadesData.forEach(row => {
      if (row?.Entidad) lookup[normalizeText(row.Entidad)] = row;
    });
    return lookup;
  }, [entidadesData]);

  const selectedEntityKey = selectedState ? normalizeText(selectedState) : null;
  const currentStageKey = `etapa${activeStage}`;
  const currentStageVariables = STAGE_VARIABLES[activeStage] || [];
  const selectedVariableMeta = currentStageVariables.find(variable => variable.key === activeVariable) || currentStageVariables[0];
  const selectedStateGeometry = useMemo(() => (
    selectedEntityKey ? (distritosGeometriaMexico[selectedEntityKey] || []) : []
  ), [selectedEntityKey]);

  const districtSummary = useMemo(() => {
    if (!selectedEntityKey || !avanceData) return [];
    const rowsByDistrict = new Map();
    PEC_ORDER.forEach(pecKey => {
      const pecRows = avanceData?.[pecKey]?.[currentStageKey]?.[activeVariable] || [];
      pecRows.filter(row => normalizeText(row.entidad) === selectedEntityKey).forEach(row => {
        const districtId = getDistrictKey(row);
        if (!Number.isFinite(districtId)) return;
        if (!rowsByDistrict.has(districtId)) {
          rowsByDistrict.set(districtId, { id_distrito: districtId, cabecera: row.cabecera || `Distrito ${districtId}` });
        }
        rowsByDistrict.get(districtId)[pecKey] = row;
      });
    });
    const order = selectedStateGeometry.length > 0
      ? selectedStateGeometry.map(district => toNumber(district.d, NaN)).filter(Number.isFinite)
      : [...rowsByDistrict.keys()].sort((a, b) => a - b);
    return order.map(districtId => {
      const entry = rowsByDistrict.get(districtId) || { id_distrito: districtId, cabecera: `Distrito ${districtId}` };
      const ratios = PEC_ORDER.map(pecKey => {
        const row = entry[pecKey];
        if (!row) return null;
        const day = toNumber(row.dia, PEC_META[pecKey].days);
        return {
          pecKey,
          day,
          completed: row.completo !== false,
          ratio: PEC_META[pecKey].days > 1 ? (day - 1) / (PEC_META[pecKey].days - 1) : 0,
        };
      });
      const validRatios = ratios.filter(Boolean).map(item => item.ratio);
      return {
        ...entry,
        ratios,
        averageRatio: validRatios.length ? validRatios.reduce((sum, value) => sum + value, 0) / validRatios.length : NaN,
      };
    });
  }, [avanceData, activeVariable, currentStageKey, selectedEntityKey, selectedStateGeometry]);

  const nationalMapData = useMemo(() => {
    const locations = geoJson.features.map(feature => feature.properties.name);
    const zValues = locations.map(location => {
      const row = entityLookup[normalizeText(location)];
      const average = getStageAverage(row, activeStage);
      return Number.isFinite(average) ? average : 0;
    });
    const validValues = zValues.filter(Number.isFinite);
    return {
      locations,
      zValues,
      minValue: validValues.length ? Math.min(...validValues) : 0,
      maxValue: validValues.length ? Math.max(...validValues) : 1,
    };
  }, [activeStage, entityLookup, geoJson]);

  const nationalHoverTexts = useMemo(() => (
    nationalMapData.locations.map(location => {
      const row = entityLookup[normalizeText(location)];
      const average = getStageAverage(row, activeStage);
      return Number.isFinite(average) ? `<b>${location}</b><br>Promedio: ${average.toFixed(2)} d�as` : `${location}: Sin datos`;
    })
  ), [activeStage, entityLookup, nationalMapData.locations]);

  const districtVisuals = useMemo(() => {
    if (!selectedStateGeometry.length) return [];
    return buildDistrictSvgGeometry(selectedStateGeometry).map(district => {
      const summaryRow = districtSummary.find(row => toNumber(row.id_distrito, NaN) === toNumber(district.id, NaN));
      const ratio = Number.isFinite(summaryRow?.averageRatio) ? summaryRow.averageRatio : NaN;
      const isSelected = toNumber(selectedDistrict, NaN) === toNumber(district.id, NaN);
      const isHovered = toNumber(hoveredDistrict, NaN) === toNumber(district.id, NaN);
      return {
        ...district,
        fill: isSelected ? '#2563eb' : isHovered ? '#60a5fa' : getHeatColor(ratio),
        stroke: isSelected ? '#1d4ed8' : isHovered ? '#2563eb' : '#cbd5e1',
      };
    });
  }, [districtSummary, hoveredDistrict, selectedDistrict, selectedStateGeometry]);

  const handleStateClick = (stateName) => {
    setSelectedState(prev => (prev && normalizeText(prev) === normalizeText(stateName) ? null : stateName));
  };

  const renderHeatCell = (row, pecKey) => {
    const meta = PEC_META[pecKey];
    const pecRow = row?.[pecKey] || null;
    const dayValue = pecRow ? toNumber(pecRow.dia, meta.days) : null;
    const completed = pecRow ? pecRow.completo !== false : false;
    const ratio = Number.isFinite(dayValue) && meta.days > 1 ? (dayValue - 1) / (meta.days - 1) : NaN;
    const displayValue = pecRow ? (completed ? `${dayValue}` : `${meta.days}*`) : '�';
    return (
      <td key={pecKey} style={{ padding: '0 8px' }}>
        <span title={pecRow ? `${meta.label}: ${completed ? `d�a ${dayValue}` : `no alcanz� 100% (se muestra ${meta.days})`}` : `${meta.label}: sin dato`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 74, padding: '8px 10px', borderRadius: 10, fontWeight: 700, color: getTextColor(ratio), background: getHeatColor(ratio), border: completed ? '1px solid rgba(15, 23, 42, 0.08)' : '1px dashed rgba(15, 23, 42, 0.28)' }}>{displayValue}</span>
      </td>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff5fb', padding: '24px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1420, margin: '0 auto', background: '#fff', borderRadius: 24, overflow: 'hidden', border: '1px solid #f3d4e6', boxShadow: '0 20px 60px rgba(138, 43, 91, 0.10)' }}>
        <div style={{ padding: '24px 24px 16px', background: 'linear-gradient(135deg, #8b5cf6, #d946ef)', color: '#fff' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.1 }}>Avance distrital entre PEC</h1>
              <p style={{ margin: '6px 0 0', opacity: 0.92 }}>Compara el d�a en que cada distrito alcanz� el 100% en las tres PEC.</p>
            </div>
          </div>
        </div>

        <div style={{ padding: 24, display: 'grid', gap: 22 }}>
          {loading ? (
            <div style={{ padding: '24px', color: '#6b7280' }}>Cargando informaci�n de avance...</div>
          ) : error ? (
            <div style={{ padding: '18px 20px', borderRadius: 16, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>{error}</div>
          ) : (
            <>
              <section style={{ border: '1px solid #f3d4e6', borderRadius: 20, padding: 18, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: '#7c3aed' }}><Map size={18} /> Mapa nacional</h2>
                    <p style={{ margin: '6px 0 0', color: '#6b7280' }}>Haz clic sobre una entidad para abrir su mapa distrital.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[1, 2].map(stage => (
                      <button key={stage} type="button" onClick={() => { setActiveStage(stage); setActiveVariable(STAGE_VARIABLES[stage][0].key); setSelectedDistrict(null); setHoveredDistrict(null); }} style={{ border: 'none', borderRadius: 999, padding: '10px 16px', fontWeight: 700, cursor: 'pointer', background: activeStage === stage ? 'linear-gradient(135deg, #7c3aed, #db2777)' : '#f3f4f6', color: activeStage === stage ? '#fff' : '#374151' }}>
                        {stage === 1 ? '1� Etapa' : '2� Etapa'}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ borderRadius: 18, overflow: 'hidden', marginTop: 16, background: '#020617' }}>
                  <Plot
                    data={[{
                      type: 'choropleth',
                      geojson: geoJson,
                      locations: nationalMapData.locations,
                      z: nationalMapData.zValues,
                      featureidkey: 'properties.name',
                      colorscale: [[0, '#4fe3ad'], [0.5, '#fbbf24'], [1, '#ef4444']],
                      zmin: nationalMapData.minValue,
                      zmax: nationalMapData.maxValue,
                      marker: {
                        line: {
                          color: selectedState ? nationalMapData.locations.map(location => (normalizeText(location) === normalizeText(selectedState) ? '#ffffff' : 'rgba(255,255,255,0.18)')) : 'rgba(255,255,255,0.18)',
                          width: selectedState ? nationalMapData.locations.map(location => (normalizeText(location) === normalizeText(selectedState) ? 2 : 0.5)) : 0.5,
                        },
                      },
                      hoverinfo: 'text',
                      text: nationalHoverTexts,
                      selectedpoints: selectedState ? [nationalMapData.locations.findIndex(location => normalizeText(location) === normalizeText(selectedState))] : undefined,
                      hoverlabel: { bgcolor: '#0f172a', bordercolor: '#c084fc', font: { family: 'Inter, sans-serif', size: 13, color: '#f8fafc' } },
                      colorbar: { title: { text: 'd�as', font: { color: '#cbd5e1', size: 12 } }, tickfont: { color: '#cbd5e1' }, len: 0.8 },
                    }]}
                    layout={{ geo: { scope: 'world', showframe: false, showcoastlines: false, showland: true, landcolor: '#0f172a', showocean: true, oceancolor: '#020617', showlakes: false, projection: { type: 'mercator' }, center: { lat: 23.6345, lon: -102.5528 }, lonaxis: { range: [-118, -86] }, lataxis: { range: [14, 33] }, bgcolor: '#020617' }, margin: { t: 0, r: 0, b: 0, l: 0 }, paper_bgcolor: '#020617', plot_bgcolor: '#020617', font: { color: '#94a3b8' }, dragmode: false, height: 360 }}
                    useResizeHandler
                    style={{ width: '100%' }}
                    onClick={(event) => {
                      const clickedState = event?.points?.[0]?.location;
                      if (clickedState) handleStateClick(clickedState);
                    }}
                    config={{ displayModeBar: false, scrollZoom: false }}
                  />
                </div>
              </section>

              {!selectedState ? (
                <section style={{ border: '1px dashed #cbd5e1', borderRadius: 18, padding: 20, background: '#f8fafc', color: '#64748b', textAlign: 'center' }}>Selecciona una entidad en el mapa nacional para desplegar la comparativa.</section>
              ) : (
                <>
                  <section style={{ border: '1px solid #f3d4e6', borderRadius: 20, padding: 18, background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: '#7c3aed' }}><Table2 size={18} /> Comparativa distrital</h2>
                        <p style={{ margin: '6px 0 0', color: '#6b7280' }}>{selectedState} � {selectedVariableMeta?.label || 'variable seleccionada'}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {currentStageVariables.map(variable => (
                          <button key={variable.key} type="button" onClick={() => { setActiveVariable(variable.key); setSelectedDistrict(null); setHoveredDistrict(null); }} style={{ border: 'none', borderRadius: 999, padding: '10px 14px', fontWeight: 700, cursor: 'pointer', background: activeVariable === variable.key ? 'linear-gradient(135deg, #06b6d4, #22c55e)' : '#f3f4f6', color: activeVariable === variable.key ? '#fff' : '#374151' }}>{variable.label}</button>
                        ))}
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto', marginTop: 16 }}>
                      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 10px' }}>
                        <thead>
                          <tr style={{ color: '#475569', fontSize: 14 }}>
                            <th style={{ textAlign: 'left', padding: '0 12px 0 0' }}>Distrito</th>
                            {PEC_ORDER.map(pecKey => (
                              <th key={pecKey} style={{ textAlign: 'center', padding: '0 8px' }}>
                                {PEC_META[pecKey].label}
                                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{PEC_META[pecKey].days} d�as</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {districtSummary.map(row => (
                            <tr key={row.id_distrito} onClick={() => setSelectedDistrict(row.id_distrito)} style={{ cursor: 'pointer', background: selectedDistrict === row.id_distrito ? '#f5f3ff' : '#fff', boxShadow: selectedDistrict === row.id_distrito ? '0 8px 18px rgba(124, 58, 237, 0.10)' : '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                              <td style={{ padding: '12px 14px', borderTopLeftRadius: 14, borderBottomLeftRadius: 14, fontWeight: 700, color: '#0f172a' }}>D{String(row.id_distrito).padStart(2, '0')} � {row.cabecera}</td>
                              {PEC_ORDER.map(pecKey => renderHeatCell(row, pecKey))}
                              <td style={{ width: 12, borderTopRightRadius: 14, borderBottomRightRadius: 14 }} />
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, color: '#64748b', flexWrap: 'wrap' }}>
                      <Thermometer size={16} />
                      <span>Verde = m�s temprano � Rojo = m�s tard�o</span>
                      <span style={{ color: '#94a3b8' }}>�</span>
                      <span>Los valores con * no alcanzaron 100% y muestran el �ltimo d�a del PEC.</span>
                    </div>
                  </section>

                  <section style={{ border: '1px solid #f3d4e6', borderRadius: 20, padding: 18, background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: '#7c3aed' }}><Map size={18} /> Mapa distrital interactivo</h2>
                        <p style={{ margin: '6px 0 0', color: '#6b7280' }}>{selectedState} � {selectedVariableMeta?.label || 'variable seleccionada'}</p>
                      </div>
                    </div>

                    {selectedStateGeometry.length === 0 ? (
                      <div style={{ marginTop: 16, minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 16, border: '1px dashed #cbd5e1', textAlign: 'center', padding: 20 }}>No se encontr� geometr�a distrital para {selectedState}.</div>
                    ) : (
                      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 0.8fr)', gap: 16, alignItems: 'start' }}>
                        <div style={{ background: '#020617', borderRadius: 18, padding: 10, overflow: 'hidden' }}>
                          <svg viewBox="0 0 760 440" role="img" aria-label={`Distritos de ${selectedState}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                            {districtVisuals.map(district => (
                              <path key={`district-${district.id}`} d={district.path} fill={district.fill} stroke={district.stroke} strokeWidth={toNumber(selectedDistrict, NaN) === toNumber(district.id, NaN) || toNumber(hoveredDistrict, NaN) === toNumber(district.id, NaN) ? 2.5 : 1.1} opacity={0.96} style={{ cursor: 'pointer', transition: 'all 120ms ease' }} onMouseEnter={() => setHoveredDistrict(district.id)} onMouseLeave={() => setHoveredDistrict(null)} onClick={() => setSelectedDistrict(prev => (prev === district.id ? null : district.id))}>
                                <title>{`D${String(district.id).padStart(2, '0')}: ${districtSummary.find(row => toNumber(row.id_distrito, NaN) === toNumber(district.id, NaN))?.cabecera || ''}`}</title>
                              </path>
                            ))}
                            {districtVisuals.filter(district => toNumber(selectedDistrict, NaN) === toNumber(district.id, NaN) || toNumber(hoveredDistrict, NaN) === toNumber(district.id, NaN)).map(district => (
                              <g key={`label-${district.id}`}>
                                <circle cx={district.centerX} cy={district.centerY} r={15} fill="rgba(255,255,255,0.78)" />
                                <text x={district.centerX} y={district.centerY + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#0f172a">D{String(district.id).padStart(2, '0')}</text>
                              </g>
                            ))}
                          </svg>
                        </div>
                        <div style={{ background: '#f8fafc', borderRadius: 18, border: '1px solid #e2e8f0', padding: 16 }}>
                          <strong style={{ color: '#111827' }}>Leyenda</strong>
                          <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
                            <div style={{ height: 14, borderRadius: 999, background: 'linear-gradient(90deg, #4fe3ad 0%, #fbbf24 50%, #ef4444 100%)' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                              <span>D�a 1</span>
                              <span>D�a final del PEC</span>
                            </div>
                          </div>
                          <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
                            {districtSummary.map(row => (
                              <button key={row.id_distrito} type="button" onClick={() => setSelectedDistrict(row.id_distrito)} style={{ border: '1px solid #e2e8f0', borderRadius: 14, background: selectedDistrict === row.id_distrito ? '#ede9fe' : '#fff', padding: '10px 12px', textAlign: 'left', cursor: 'pointer' }}>
                                <div style={{ fontWeight: 800, color: '#111827' }}>D{String(row.id_distrito).padStart(2, '0')} � {row.cabecera}</div>
                                <div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>Promedio normalizado: {Number.isFinite(row.averageRatio) ? `${(row.averageRatio * 100).toFixed(1)}%` : '�'}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvanceDistxPEC;
