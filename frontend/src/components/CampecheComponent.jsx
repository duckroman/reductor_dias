import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PlotlyComponent from 'react-plotly.js';
import ExcelJS from 'exceljs';
import {
  Map as MapIcon,
  Table as TableIcon,
  X,
  ChevronRight,
  ArrowUpDown,
  FileSpreadsheet,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';

import mexicoGeoData from '../data/mexico_geo.json';
import seccionesCampecheWGS84 from '../data/Secciones_Campeche_WGS84.json';
import localCampecheData from '../data/campeche_desempeno.json';
import { getCampecheData } from '../services/api';

const Plot = PlotlyComponent.default || PlotlyComponent;

// ---------------------------------------------------------------------------
// Paleta de Colores Oficial
// ---------------------------------------------------------------------------
const COLORS = {
  grisOxford: '#454248',
  gris: '#B2B2B2',
  beige: '#C5A989',
  grisMedio: '#828A91',
  grisClaro: '#C5C9CC',
  grisCalido: '#DDD4CE',
  negro: '#000000',
  blanco: '#FFFFFF',
  rosaFuerte: '#E60073',
};

// Pestañas de Proceso Electoral
const PEC_TABS = [
  { id: 'PEC2023-2024', label: 'PEC 2023-2024' },
  { id: 'PEEPJF 2024-2025', label: 'PEEPJF 2024-2025' }
];

// Variables disponibles
const VARIABLES = [
  { key: '%Propietarios presentes', label: '% Propietarios Presentes', shortLabel: '% Prop. Pres.' },
  { key: '%Fila', label: '% Fila', shortLabel: '% Fila' },
  { key: '%Ausentes', label: '% Ausentes', shortLabel: '% Ausentes' }
];

// Información de Distritos de Campeche
const DISTRITOS_INFO = {
  1: { id: 1, nombre: 'Distrito 1 - San Francisco de Campeche', cabecera: 'San Francisco de Campeche' },
  2: { id: 2, nombre: 'Distrito 2 - Carmen', cabecera: 'Ciudad del Carmen' }
};

// ---------------------------------------------------------------------------
// Helpers de Color e Interpolación
// ---------------------------------------------------------------------------
const interpolatePinkToWhite = (pct) => {
  const t = Math.min(Math.max(pct / 100, 0), 1);
  // 0% -> Blanco (rgb(255,255,255)), 100% -> Rosa (#E60073: rgb(230,0,115))
  const r = Math.round(255 + (230 - 255) * t);
  const g = Math.round(255 + (0 - 255) * t);
  const b = Math.round(255 + (115 - 255) * t);
  return `rgb(${r}, ${g}, ${b})`;
};

// Convierte rgb(r,g,b) a ARGB hex para ExcelJS
const rgbToArgbHex = (rgbStr) => {
  const m = rgbStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return 'FFFFFFFF';
  const toHex = (n) => Number(n).toString(16).padStart(2, '0').toUpperCase();
  return `FF${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
};

const formatPct = (val) => {
  if (val === null || val === undefined || isNaN(val)) return 'N/D';
  const num = Number(val);
  const pct = num <= 1.0 ? num * 100 : num;
  return `${pct.toFixed(1)}%`;
};

const getNumericPct = (val) => {
  if (val === null || val === undefined || isNaN(val)) return 0;
  const num = Number(val);
  return num <= 1.0 ? num * 100 : num;
};

const CampecheComponent = () => {
  // Estado de Datos
  const [data, setData] = useState(localCampecheData);

  // Selecciones
  const [selectedProcess, setSelectedProcess] = useState('PEC2023-2024');
  const [selectedVariable, setSelectedVariable] = useState('%Propietarios presentes');
  // Bug #1: usar un key para forzar re-mount del panel de tarjeta
  const [showCampecheCard, setShowCampecheCard] = useState(true);
  const [selectedDistrictModal, setSelectedDistrictModal] = useState(null);

  // Modal state (Vista: 'map' | 'table')
  const [modalView, setModalView] = useState('map');
  const [sortConfig, setSortConfig] = useState({ key: 'SECCION', direction: 'asc' });
  const [zoomScale, setZoomScale] = useState(1);
  const [sectionFontSize, setSectionFontSize] = useState(2);

  // Responsive
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cargar datos con fallback a local
  useEffect(() => {
    let isMounted = true;
    getCampecheData()
      .then(result => {
        if (isMounted && result && Object.keys(result).length > 0) {
          setData(result);
        }
      })
      .catch(err => console.error('Error al cargar datos de Campeche:', err));
    return () => { isMounted = false; };
  }, []);

  // Registros de la hoja activa
  const currentSheetRecords = useMemo(
    () => data[selectedProcess] || [],
    [data, selectedProcess]
  );

  // Mapa de sección -> registro
  const sectionDataMap = useMemo(() => {
    const map = {};
    currentSheetRecords.forEach(r => {
      if (r.SECCION !== undefined && r.SECCION !== null) {
        map[Number(r.SECCION)] = r;
      }
    });
    return map;
  }, [currentSheetRecords]);

  // Promedios por Distrito
  const districtAverages = useMemo(() => {
    const dist1 = [], dist2 = [];
    currentSheetRecords.forEach(r => {
      const distId = Number(r.ID_DISTRITO_FEDERAL);
      const val = getNumericPct(r[selectedVariable]);
      if (distId === 1) dist1.push(val);
      if (distId === 2) dist2.push(val);
    });
    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return { 1: avg(dist1), 2: avg(dist2) };
  }, [currentSheetRecords, selectedVariable]);

  // Fix #1: toggle handler con estabilidad de referencia
  const toggleCampecheCard = useCallback(() => {
    setShowCampecheCard(prev => !prev);
  }, []);

  // GeoJSON de secciones por distrito (WGS84, con id de top-level)
  const modalDistrictSectionsGeo = useMemo(() => {
    if (!selectedDistrictModal) return null;
    const filteredFeatures = seccionesCampecheWGS84.features.filter(
      f => Number(f.properties.distrito_f) === Number(selectedDistrictModal)
    );
    return { type: 'FeatureCollection', features: filteredFeatures };
  }, [selectedDistrictModal]);

  // Datos para el mapa de calor Plotly: usa `id` de top-level del feature
  const modalHeatmapPlotData = useMemo(() => {
    if (!modalDistrictSectionsGeo) return { locations: [], z: [], hoverTexts: [], textLons: [], textLats: [], textLabels: [] };

    const locations = [];
    const z = [];
    const hoverTexts = [];
    const textLons = [];
    const textLats = [];
    const textLabels = [];

    const getCentroid = (geometry) => {
      if (!geometry || !geometry.coordinates) return null;
      const pts = [];
      const extract = (c) => {
        if (Array.isArray(c) && c.length >= 2 && typeof c[0] === 'number') {
          pts.push(c);
        } else if (Array.isArray(c)) {
          c.forEach(extract);
        }
      };
      extract(geometry.coordinates);
      if (pts.length === 0) return null;
      let sumLon = 0, sumLat = 0;
      pts.forEach(p => { sumLon += p[0]; sumLat += p[1]; });
      return [sumLon / pts.length, sumLat / pts.length];
    };

    modalDistrictSectionsGeo.features.forEach(feat => {
      const secNum = Number(feat.id); // id de top-level = seccion
      const record = sectionDataMap[secNum];
      const valPct = record ? getNumericPct(record[selectedVariable]) : 0;

      locations.push(secNum);
      z.push(valPct);

      const propPres = record ? formatPct(record['%Propietarios presentes']) : 'N/D';
      const fila = record ? formatPct(record['%Fila']) : 'N/D';
      const aus = record ? formatPct(record['%Ausentes']) : 'N/D';
      const req = record ? (record['Requeridos'] || record['Requeridos '] || 'N/D') : 'N/D';

      hoverTexts.push(
        `<b>Sección ${secNum}</b><br>` +
        `Distrito: ${selectedDistrictModal}<br>` +
        `Requeridos: ${req}<br>` +
        `<b>% Prop. Presentes:</b> ${propPres}<br>` +
        `<b>% Fila:</b> ${fila}<br>` +
        `<b>% Ausentes:</b> ${aus}`
      );

      const center = getCentroid(feat.geometry);
      if (center) {
        textLons.push(center[0]);
        textLats.push(center[1]);
        textLabels.push(String(secNum));
      }
    });

    return { locations, z, hoverTexts, textLons, textLats, textLabels };
  }, [modalDistrictSectionsGeo, sectionDataMap, selectedVariable, selectedDistrictModal]);

  // Filas de tabla por distrito
  const modalTableRows = useMemo(() => {
    if (!selectedDistrictModal) return [];
    return currentSheetRecords.filter(
      r => Number(r.ID_DISTRITO_FEDERAL) === Number(selectedDistrictModal)
    );
  }, [currentSheetRecords, selectedDistrictModal]);

  // Tabla ordenada
  const sortedTableRows = useMemo(() => {
    if (!sortConfig.key) return modalTableRows;
    return [...modalTableRows].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      const pctKeys = ['%Propietarios presentes', '%Fila', '%Ausentes'];
      if (pctKeys.includes(sortConfig.key)) {
        aVal = getNumericPct(aVal);
        bVal = getNumericPct(bVal);
      } else if (!isNaN(Number(aVal))) {
        aVal = Number(aVal || 0);
        bVal = Number(bVal || 0);
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [modalTableRows, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Bug #2: Exportar con colores de mapa de calor en celdas de porcentaje
  const exportToExcel = async () => {
    if (!selectedDistrictModal || sortedTableRows.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const sheetLabel = `D${selectedDistrictModal} ${selectedProcess}`.substring(0, 31);
    const worksheet = workbook.addWorksheet(sheetLabel);

    const COLS = [
      { header: 'Sección', key: 'SECCION', width: 12 },
      { header: 'Cabecera Distrital', key: 'CABECERA_DISTRITAL_FEDERAL', width: 30 },
      { header: 'Requeridos', key: 'Requeridos', width: 14 },
      { header: 'Prop. Presentes', key: 'Propietarios presentes', width: 18 },
      { header: 'Fila', key: 'Fila', width: 12 },
      { header: 'Ausentes', key: 'Ausentes', width: 12 },
      { header: '% Prop. Presentes', key: 'pct_prop', width: 22 },
      { header: '% Fila', key: 'pct_fila', width: 14 },
      { header: '% Ausentes', key: 'pct_aus', width: 14 },
    ];
    worksheet.columns = COLS;

    // Estilos de encabezado
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF454248' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 30;

    // Agregar filas
    sortedTableRows.forEach((row, idx) => {
      const req = row['Requeridos'] || row['Requeridos '] || 0;
      const propPres = row['Propietarios presentes'] || 0;
      const fila = row['Fila'] || 0;
      const aus = row['Ausentes'] || 0;

      const pctPropNum = getNumericPct(row['%Propietarios presentes']);
      const pctFilaNum = getNumericPct(row['%Fila']);
      const pctAusNum = getNumericPct(row['%Ausentes']);

      const addedRow = worksheet.addRow({
        SECCION: Number(row.SECCION),
        CABECERA_DISTRITAL_FEDERAL: row.CABECERA_DISTRITAL_FEDERAL || '',
        Requeridos: req,
        'Propietarios presentes': propPres,
        Fila: fila,
        Ausentes: aus,
        pct_prop: pctPropNum / 100,
        pct_fila: pctFilaNum / 100,
        pct_aus: pctAusNum / 100,
      });

      // Formato de porcentaje en las columnas de %
      ['pct_prop', 'pct_fila', 'pct_aus'].forEach(k => {
        const cell = addedRow.getCell(k);
        cell.numFmt = '0.0%';
      });

      // Bug #2 — Aplicar color de mapa de calor a las celdas de porcentaje
      const colColors = {
        pct_prop: rgbToArgbHex(interpolatePinkToWhite(pctPropNum)),
        pct_fila: rgbToArgbHex(interpolatePinkToWhite(pctFilaNum)),
        pct_aus: rgbToArgbHex(interpolatePinkToWhite(pctAusNum)),
      };
      ['pct_prop', 'pct_fila', 'pct_aus'].forEach(k => {
        addedRow.getCell(k).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colColors[k] },
        };
        addedRow.getCell(k).font = { bold: true, color: { argb: 'FF000000' } };
      });

      // Fila alternada para las demás columnas
      const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFDDD4CE';
      COLS.slice(0, 6).forEach(c => {
        const cell = addedRow.getCell(c.key);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.alignment = { vertical: 'middle', horizontal: c.key === 'CABECERA_DISTRITAL_FEDERAL' ? 'left' : 'center' };
      });

      addedRow.height = 20;
    });

    // Borde en todo el rango
    const lastRow = worksheet.rowCount;
    for (let r = 1; r <= lastRow; r++) {
      COLS.forEach((c, ci) => {
        const cell = worksheet.getRow(r).getCell(c.key);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFB2B2B2' } },
          left: { style: 'thin', color: { argb: 'FFB2B2B2' } },
          bottom: { style: 'thin', color: { argb: 'FFB2B2B2' } },
          right: { style: 'thin', color: { argb: 'FFB2B2B2' } },
        };
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Campeche_D${selectedDistrictModal}_${selectedProcess}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Mapa de México: locations y z fijos
  const mexicoLocations = useMemo(
    () => mexicoGeoData.features.map(f => f.properties.name),
    []
  );
  const mexicoZValues = useMemo(
    () => mexicoLocations.map(n => (n.toLowerCase() === 'campeche' ? 1 : 0)),
    [mexicoLocations]
  );
  const mexicoHoverTexts = useMemo(
    () => mexicoLocations.map(n =>
      n.toLowerCase() === 'campeche'
        ? '<b>Campeche</b>'
        : `<b>${n}</b>`
    ),
    [mexicoLocations]
  );

  const isMobile = windowWidth < 960;

  // ----- Estilos reutilizables -----
  const cardStyle = {
    backgroundColor: COLORS.blanco,
    borderRadius: '16px',
    padding: isMobile ? '14px' : '20px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    border: `1px solid ${COLORS.grisClaro}`,
  };

  const chipBtn = (active) => ({
    flex: 1,
    minWidth: '100px',
    padding: '9px 12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: active ? COLORS.grisOxford : COLORS.blanco,
    color: active ? COLORS.blanco : COLORS.grisOxford,
    fontWeight: active ? 700 : 500,
    fontSize: '0.82rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: active ? '0 2px 8px rgba(69,66,72,0.3)' : 'none',
  });

  return (
    <div style={{
      fontFamily: "'Outfit', 'Segoe UI', system-ui, sans-serif",
      backgroundColor: COLORS.grisCalido,
      minHeight: '100vh',
      color: COLORS.grisOxford,
      padding: isMobile ? '10px' : '24px',
      boxSizing: 'border-box',
    }}>
      {/* ── Header ── */}
      <header style={{
        backgroundColor: COLORS.grisOxford,
        color: COLORS.blanco,
        borderRadius: '14px',
        padding: isMobile ? '14px 18px' : '18px 28px',
        marginBottom: isMobile ? '14px' : '20px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      }}>
        <div style={{
          color: COLORS.beige,
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
          marginBottom: '4px',
        }}>
          Sistema de Evaluación de Desempeño
        </div>
        <h1 style={{ margin: 0, fontSize: isMobile ? '1.25rem' : '1.7rem', fontWeight: 700 }}>
          🏛️ Análisis de Desempeño por Sección — Campeche
        </h1>
      </header>

      {/* ── Grid principal ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: !isMobile ? '1fr 1.05fr' : '1fr',
        gap: isMobile ? '14px' : '20px',
        alignItems: 'start',
      }}>

        {/* ── Mapa de México ── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: isMobile ? '0.95rem' : '1.1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapIcon size={18} color={COLORS.beige} /> República Mexicana
            </h3>
            <span style={{ fontSize: '0.72rem', backgroundColor: COLORS.grisCalido, padding: '3px 10px', borderRadius: '10px', fontWeight: 600 }}>
              Gris: Otros &nbsp;|&nbsp; Beige: Campeche
            </span>
          </div>

          <div style={{ width: '100%', height: isMobile ? '360px' : '500px', borderRadius: '10px', overflow: 'hidden', border: `1px solid ${COLORS.gris}` }}>
            <Plot
              data={[{
                type: 'choropleth',
                geojson: mexicoGeoData,
                locations: mexicoLocations,
                z: mexicoZValues,
                featureidkey: 'properties.name',
                colorscale: [[0, COLORS.grisClaro], [1, COLORS.beige]],
                showscale: false,
                marker: { line: { color: COLORS.grisOxford, width: 0.8 } },
                hoverinfo: 'text',
                text: mexicoHoverTexts,
                hoverlabel: {
                  bgcolor: COLORS.grisOxford,
                  bordercolor: COLORS.beige,
                  font: { family: 'Outfit, sans-serif', size: 13, color: COLORS.blanco },
                },
              }]}
              layout={{
                geo: { fitbounds: 'locations', visible: false, fixedrange: true },
                dragmode: false,
                margin: { t: 6, b: 6, l: 6, r: 6 },
                autosize: true,
                paper_bgcolor: COLORS.blanco,
                plot_bgcolor: COLORS.blanco,
              }}
              config={{
                scrollZoom: false,
                displayModeBar: false,
                doubleClick: false,
                dragMode: false,
              }}
              onClick={(data) => {
                if (data && data.points && data.points.length > 0) {
                  const clickedLocation = data.points[0].location;
                  if (clickedLocation === 'Campeche') {
                    setShowCampecheCard(true);
                  }
                }
              }}
              useResizeHandler
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>

        {/* ── Tarjeta Distrital de Campeche ── */}
        <div style={{
          ...cardStyle,
          border: `2px solid ${COLORS.beige}`,
          boxShadow: '0 6px 24px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}>
          {/* Encabezado tarjeta */}
          <div style={{ borderBottom: `1px solid ${COLORS.grisClaro}`, paddingBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: COLORS.beige, textTransform: 'uppercase', letterSpacing: '1.2px' }}>
                Mapa Distrital Interactivo
              </span>
              <h2 style={{ margin: '4px 0 0 0', fontSize: '1.35rem', fontWeight: 700, color: COLORS.grisOxford }}>
                CAMPECHE
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: COLORS.grisMedio }}>
                Desempeño acumulado por distrito federal
              </p>
            </div>
          </div>

          {/* Controles */}
          <div style={{ backgroundColor: COLORS.grisCalido, padding: '14px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: COLORS.grisOxford, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                PROCESO ELECTORAL
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {PEC_TABS.map(tab => (
                  <button key={tab.id} type="button" onClick={() => setSelectedProcess(tab.id)} style={chipBtn(selectedProcess === tab.id)}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: COLORS.grisOxford, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                VARIABLE
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '8px' }}>
                {VARIABLES.map(v => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setSelectedVariable(v.key)}
                    style={{
                      padding: '8px 6px',
                      borderRadius: '8px',
                      border: selectedVariable === v.key ? `2px solid ${COLORS.beige}` : `1px solid ${COLORS.gris}`,
                      backgroundColor: selectedVariable === v.key ? COLORS.beige : COLORS.blanco,
                      color: selectedVariable === v.key ? COLORS.blanco : COLORS.grisOxford,
                      fontWeight: selectedVariable === v.key ? 700 : 500,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    {v.shortLabel}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tarjetas de Distrito */}
          <div>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: COLORS.grisOxford, display: 'block', marginBottom: '10px' }}>
              Selecciona un Distrito para ver el mapa de secciones:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
              {[1, 2].map(distId => {
                const info = DISTRITOS_INFO[distId];
                const avgVal = districtAverages[distId];
                const active = selectedDistrictModal === distId;
                return (
                  <div
                    key={distId}
                    onClick={() => { setSelectedDistrictModal(distId); setModalView('map'); setZoomScale(1); }}
                    style={{
                      backgroundColor: active ? COLORS.grisCalido : COLORS.blanco,
                      borderRadius: '12px',
                      border: `2px solid ${active ? COLORS.beige : COLORS.grisClaro}`,
                      padding: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                      minHeight: '120px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ backgroundColor: COLORS.grisOxford, color: COLORS.blanco, padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                        Distrito {distId}
                      </span>
                      <ChevronRight size={18} color={COLORS.beige} />
                    </div>
                    <h4 style={{ margin: '8px 0 4px', fontSize: '0.9rem', color: COLORS.grisOxford, fontWeight: 700 }}>
                      {info.cabecera}
                    </h4>
                    <div style={{ borderTop: `1px solid ${COLORS.grisClaro}`, paddingTop: '8px', marginTop: '4px' }}>
                      <div style={{ fontSize: '0.72rem', color: COLORS.grisMedio }}>Promedio {selectedVariable}:</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: COLORS.grisOxford }}>{avgVal.toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL DE DISTRITO CON MAPA DE CALOR / TABLA                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {selectedDistrictModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 9999,
            padding: isMobile ? '8px' : '20px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedDistrictModal(null); }}
        >
          <div style={{
            backgroundColor: COLORS.blanco,
            borderRadius: '18px',
            width: '97%',
            maxWidth: '1200px',
            maxHeight: '93vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
            overflow: 'hidden',
            border: `2px solid ${COLORS.beige}`,
          }}>
            {/* Header modal */}
            <div style={{
              backgroundColor: COLORS.grisOxford,
              color: COLORS.blanco,
              padding: isMobile ? '12px 16px' : '18px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}>
              <div>
                <span style={{ color: COLORS.beige, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  {selectedProcess} — {VARIABLES.find(v => v.key === selectedVariable)?.label}
                </span>
                <h2 style={{ margin: '4px 0 0', fontSize: isMobile ? '1rem' : '1.35rem', fontWeight: 700 }}>
                  📍 {DISTRITOS_INFO[selectedDistrictModal].nombre}
                </h2>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Switcher Mapa / Tabla */}
                <div style={{
                  display: 'flex',
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  padding: '3px',
                  borderRadius: '28px',
                  border: `1px solid ${COLORS.grisMedio}`,
                }}>
                  {[
                    { key: 'map', label: 'Mapa de Calor', icon: <MapIcon size={15} /> },
                    { key: 'table', label: 'Tabla', icon: <TableIcon size={15} /> },
                  ].map(v => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setModalView(v.key)}
                      style={{
                        padding: '5px 14px',
                        borderRadius: '22px',
                        border: 'none',
                        backgroundColor: modalView === v.key ? COLORS.beige : 'transparent',
                        color: COLORS.blanco,
                        fontWeight: 600,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      {v.icon} {v.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDistrictModal(null)}
                  style={{ backgroundColor: 'rgba(255,255,255,0.18)', border: 'none', color: COLORS.blanco, borderRadius: '50%', width: '32px', height: '32px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}
                  title="Cerrar"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Contenido modal */}
            <div style={{ padding: isMobile ? '12px' : '20px', overflowY: 'auto', flex: 1, backgroundColor: COLORS.grisCalido }}>

              {/* ── MAPA DE CALOR ── */}
              {modalView === 'map' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Leyenda */}
                  <div style={{ backgroundColor: COLORS.blanco, padding: '12px 16px', borderRadius: '10px', border: `1px solid ${COLORS.grisClaro}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <strong style={{ fontSize: '0.88rem', color: COLORS.grisOxford }}>Escala del Mapa de Calor — Secciones del Distrito {selectedDistrictModal}</strong>

                  </div>

                  {/* Mapa de Calor y Regla Métrica en marcos independientes */}
                  <div style={{ display: 'flex', gap: '14px', height: isMobile ? '380px' : '520px', alignItems: 'stretch' }}>

                    {/* Marco del Mapa (con Zoom exclusivo) */}
                    <div style={{
                      flex: 1,
                      backgroundColor: COLORS.blanco,
                      borderRadius: '14px',
                      padding: '12px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}>
                      {/* Botones de Zoom flotantes para el mapa */}
                      <div style={{
                        position: 'absolute',
                        top: '20px',
                        left: '20px',
                        zIndex: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.92)',
                        padding: '6px',
                        borderRadius: '10px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        border: `1px solid ${COLORS.grisClaro}`,
                        backdropFilter: 'blur(4px)',
                      }}>
                        <button
                          type="button"
                          onClick={() => setZoomScale(prev => Math.min(prev + 0.25, 3))}
                          style={{
                            backgroundColor: COLORS.blanco,
                            border: `1px solid ${COLORS.gris}`,
                            borderRadius: '6px',
                            padding: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: COLORS.grisOxford,
                          }}
                          title="Acercar mapa (+)"
                        >
                          <ZoomIn size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setZoomScale(prev => Math.max(prev - 0.25, 0.75))}
                          style={{
                            backgroundColor: COLORS.blanco,
                            border: `1px solid ${COLORS.gris}`,
                            borderRadius: '6px',
                            padding: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: COLORS.grisOxford,
                          }}
                          title="Alejar mapa (-)"
                        >
                          <ZoomOut size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setZoomScale(1)}
                          style={{
                            backgroundColor: COLORS.blanco,
                            border: `1px solid ${COLORS.gris}`,
                            borderRadius: '6px',
                            padding: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: COLORS.grisOxford,
                          }}
                          title="Restablecer zoom (100%)"
                        >
                          <RotateCcw size={16} />
                        </button>
                      </div>

                      {modalDistrictSectionsGeo && (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          transform: `scale(${zoomScale})`,
                          transformOrigin: 'center center',
                          transition: 'transform 0.2s ease-out',
                        }}>
                          <Plot
                            data={[
                              {
                                type: 'choropleth',
                                geojson: modalDistrictSectionsGeo,
                                locations: modalHeatmapPlotData.locations,
                                z: modalHeatmapPlotData.z,
                                featureidkey: 'id',
                                colorscale: [[0, COLORS.blanco], [1, COLORS.rosaFuerte]],
                                zmin: 0,
                                zmax: 100,
                                showscale: false,
                                marker: { line: { color: COLORS.grisMedio, width: 0.4 } },
                                hoverinfo: 'text',
                                text: modalHeatmapPlotData.hoverTexts,
                                hoverlabel: {
                                  bgcolor: COLORS.grisOxford,
                                  bordercolor: COLORS.beige,
                                  font: { family: 'Outfit, sans-serif', size: 12, color: COLORS.blanco },
                                },
                              },
                              {
                                type: 'scattergeo',
                                lon: modalHeatmapPlotData.textLons,
                                lat: modalHeatmapPlotData.textLats,
                                text: modalHeatmapPlotData.textLabels,
                                mode: 'text',
                                textfont: {
                                  family: 'Outfit, sans-serif',
                                  size: sectionFontSize,
                                  color: COLORS.grisOxford,
                                },
                                hoverinfo: 'skip',
                                showlegend: false,
                              }
                            ]}
                            layout={{
                              geo: { fitbounds: 'locations', visible: false },
                              margin: { t: 8, b: 8, l: 8, r: 8 },
                              autosize: true,
                              paper_bgcolor: COLORS.blanco,
                              plot_bgcolor: COLORS.blanco,
                            }}
                            config={{ scrollZoom: false, displayModeBar: false }}
                            useResizeHandler
                            style={{ width: '100%', height: '100%' }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Marco independiente para la Regla Métrica (Colorbar Rectangular) */}
                    <div style={{
                      width: '110px',
                      backgroundColor: COLORS.blanco,
                      borderRadius: '14px',
                      padding: '16px 10px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${COLORS.grisClaro}`,
                    }}>
                      <div style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: COLORS.grisOxford,
                        marginBottom: '12px',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        Escala (%)
                      </div>

                      {/* Regla métrica rectangular con hitos 100%, 80%, 60%, 40%, 20%, 0% */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        height: '320px',
                        position: 'relative',
                      }}>
                        {/* Barra de gradiente rectangular estricta */}
                        <div style={{
                          width: '20px',
                          height: '100%',
                          borderRadius: '0px',
                          background: `linear-gradient(to top, ${COLORS.blanco}, ${COLORS.rosaFuerte})`,
                          border: `1px solid ${COLORS.grisOxford}`,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                        }} />

                        {/* Hitos graduales y etiquetas */}
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          height: '100%',
                          fontSize: '0.73rem',
                          fontWeight: 600,
                          color: COLORS.grisOxford,
                          lineHeight: 1,
                        }}>
                          {[100, 80, 60, 40, 20, 0].map(val => (
                            <div key={val} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '0.65rem', color: COLORS.grisMedio }}>—</span>
                              <span style={{ color: val === 100 ? COLORS.rosaFuerte : COLORS.grisOxford, fontWeight: val === 100 || val === 0 ? 700 : 600 }}>
                                {val}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* ── TABLA ── */}
              {modalView === 'table' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ backgroundColor: COLORS.blanco, padding: '12px 18px', borderRadius: '10px', border: `1px solid ${COLORS.grisClaro}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', color: COLORS.grisOxford }}>
                        Total de Secciones del Distrito {selectedDistrictModal}: <b>{sortedTableRows.length}</b>
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: COLORS.grisMedio }}>
                        Haz clic en el encabezado de cualquier columna para ordenar
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={exportToExcel}
                      style={{
                        backgroundColor: '#16a34a',
                        color: COLORS.blanco,
                        border: 'none',
                        padding: '9px 16px',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        boxShadow: '0 4px 10px rgba(22,163,74,0.3)',
                      }}
                    >
                      <FileSpreadsheet size={17} /> Exportar a Excel (con colores)
                    </button>
                  </div>

                  <div style={{ backgroundColor: COLORS.blanco, borderRadius: '12px', overflow: 'hidden', border: `1px solid ${COLORS.grisClaro}`, boxShadow: '0 4px 14px rgba(0,0,0,0.05)' }}>
                    <div style={{ overflowX: 'auto', maxHeight: '460px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: COLORS.grisOxford, color: COLORS.blanco, position: 'sticky', top: 0, zIndex: 10 }}>
                            {[
                              { key: 'SECCION', label: 'Sección' },
                              { key: 'CABECERA_DISTRITAL_FEDERAL', label: 'Cabecera' },
                              { key: 'Requeridos', label: 'Requeridos' },
                              { key: 'Propietarios presentes', label: 'Prop. Pres.' },
                              { key: 'Fila', label: 'Fila' },
                              { key: 'Ausentes', label: 'Ausentes' },
                              { key: '%Propietarios presentes', label: '% Prop. Pres.' },
                              { key: '%Fila', label: '% Fila' },
                              { key: '%Ausentes', label: '% Ausentes' },
                            ].map(col => (
                              <th
                                key={col.key}
                                onClick={() => handleSort(col.key)}
                                style={{ padding: '11px 13px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', borderRight: `1px solid ${COLORS.grisMedio}` }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  {col.label}
                                  <ArrowUpDown size={13} color={sortConfig.key === col.key ? COLORS.beige : 'rgba(255,255,255,0.4)'} />
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedTableRows.map((row, idx) => {
                            const pctPropNum = getNumericPct(row['%Propietarios presentes']);
                            const pctFilaNum = getNumericPct(row['%Fila']);
                            const pctAusNum = getNumericPct(row['%Ausentes']);
                            const reqVal = row['Requeridos'] || row['Requeridos '] || 0;
                            const rowBg = idx % 2 === 0 ? COLORS.blanco : COLORS.grisCalido;

                            return (
                              <tr key={idx} style={{ backgroundColor: rowBg, borderBottom: `1px solid ${COLORS.grisClaro}` }}>
                                <td style={{ padding: '9px 13px', fontWeight: 700, color: COLORS.grisOxford }}>{row.SECCION}</td>
                                <td style={{ padding: '9px 13px', color: COLORS.grisOxford, whiteSpace: 'nowrap' }}>{row.CABECERA_DISTRITAL_FEDERAL}</td>
                                <td style={{ padding: '9px 13px', textAlign: 'center', color: COLORS.grisOxford }}>{reqVal}</td>
                                <td style={{ padding: '9px 13px', textAlign: 'center', color: COLORS.grisOxford }}>{row['Propietarios presentes'] || 0}</td>
                                <td style={{ padding: '9px 13px', textAlign: 'center', color: COLORS.grisOxford }}>{row['Fila'] || 0}</td>
                                <td style={{ padding: '9px 13px', textAlign: 'center', color: COLORS.grisOxford }}>{row['Ausentes'] || 0}</td>

                                <td style={{ padding: '9px 13px', backgroundColor: interpolatePinkToWhite(pctPropNum), color: COLORS.negro, fontWeight: 700, textAlign: 'right' }}>
                                  {formatPct(row['%Propietarios presentes'])}
                                </td>
                                <td style={{ padding: '9px 13px', backgroundColor: interpolatePinkToWhite(pctFilaNum), color: COLORS.negro, fontWeight: 700, textAlign: 'right' }}>
                                  {formatPct(row['%Fila'])}
                                </td>
                                <td style={{ padding: '9px 13px', backgroundColor: interpolatePinkToWhite(pctAusNum), color: COLORS.negro, fontWeight: 700, textAlign: 'right' }}>
                                  {formatPct(row['%Ausentes'])}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampecheComponent;
