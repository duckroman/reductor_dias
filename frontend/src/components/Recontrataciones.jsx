import React, { useState, useEffect, useMemo } from 'react';
import PlotlyComponent from 'react-plotly.js';
import {
  User,
  Edit3,
  Check,
  X,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Building2,
  Layers,
  FileSpreadsheet,
  ChevronDown,
  Download
} from 'lucide-react';
import mexicoGeoData from '../data/mexico_geo.json';
import {
  exportRecontratacionesAvance,
  getEstadosRecontrataciones,
  getRecontratacionesEstado
} from '../services/api';

const Plot = PlotlyComponent.default || PlotlyComponent;

// ===========================================================================
// Paleta Oficial (Gris Oxford, Beige, Grises Institucionales - Sin Rosa)
// ===========================================================================
const COLORS = {
  grisOxford: '#454248',
  gris: '#B2B2B2',
  beige: '#C5A989',
  grisMedio: '#828A91',
  grisClaro: '#C5C9CC',
  grisCalido: '#DDD4CE',
  negro: '#000000',
  blanco: '#FFFFFF',
  fondoClaro: '#F5F6F8',
  bordeSuave: '#E2E5E8'
};

const STORAGE_KEY = 'ine_recontrataciones_vocalias_v4';
const GLOBAL_PROCESS_ID = 'global';
const NATIONAL_VIEW = 'nacional';

const PROCESOS_ELECTORALES = [
  {
    id: 'pec_2023_2024',
    label: 'Proceso Electoral Concurrente 2023-2024',
    badge: 'PEC 2023-2024',
  },
  {
    id: 'pe_judicial_2024_2025',
    label: 'Proceso Electoral Extraordinario para la elección de diversos cargos del Poder Judicial de la Federación 2024-2025',
    badge: 'Poder Judicial 2024-2025',
  },
  {
    id: 'pel_2024_2026',
    label: 'Proceso Electoral Local 2024-2025 Durango y Veracruz / Proceso Electoral Local 2025-2026 Coahuila',
    badge: 'Procesos Locales',
  },
];

const CAMPOS_RECONTRATACIONES = [
  { key: 'personas_contactadas', label: 'Número de personas contactadas', color: '#C5A989' },
  { key: 'personas_interesadas', label: 'Número de personas interesadas', color: '#89c5a8' },
  { key: 'personas_no_interesadas', label: 'Número de personas no interesadas', color: '#828A91' },
  { key: 'personas_sin_respuesta', label: 'Número de personas sin respuesta', color: '#C5C9CC' },
  { key: 'personas_entrevistadas', label: 'Número de personas entrevistadas', color: '#6F8F72' },
];

// 32 Entidades federativas
const ENTIDADES_CATALOGO = [
  { id: 1, name: 'Aguascalientes', key: 'aguascalientes', distritos: 3 },
  { id: 2, name: 'Baja California', key: 'baja california', distritos: 9 },
  { id: 3, name: 'Baja California Sur', key: 'baja california sur', distritos: 2 },
  { id: 4, name: 'Campeche', key: 'campeche', distritos: 2 },
  { id: 5, name: 'Coahuila', key: 'coahuila', distritos: 8 },
  { id: 6, name: 'Colima', key: 'colima', distritos: 2 },
  { id: 7, name: 'Chiapas', key: 'chiapas', distritos: 13 },
  { id: 8, name: 'Chihuahua', key: 'chihuahua', distritos: 9 },
  { id: 9, name: 'Ciudad de México', key: 'distrito federal', distritos: 22 },
  { id: 10, name: 'Durango', key: 'durango', distritos: 4 },
  { id: 11, name: 'Guanajuato', key: 'guanajuato', distritos: 15 },
  { id: 12, name: 'Guerrero', key: 'guerrero', distritos: 8 },
  { id: 13, name: 'Hidalgo', key: 'hidalgo', distritos: 7 },
  { id: 14, name: 'Jalisco', key: 'jalisco', distritos: 20 },
  { id: 15, name: 'México', key: 'méxico', distritos: 40 },
  { id: 16, name: 'Michoacán', key: 'michoacán', distritos: 11 },
  { id: 17, name: 'Morelos', key: 'morelos', distritos: 5 },
  { id: 18, name: 'Nayarit', key: 'nayarit', distritos: 3 },
  { id: 19, name: 'Nuevo León', key: 'nuevo león', distritos: 14 },
  { id: 20, name: 'Oaxaca', key: 'oaxaca', distritos: 10 },
  { id: 21, name: 'Puebla', key: 'puebla', distritos: 16 },
  { id: 22, name: 'Querétaro', key: 'querétaro', distritos: 6 },
  { id: 23, name: 'Quintana Roo', key: 'quintana roo', distritos: 4 },
  { id: 24, name: 'San Luis Potosí', key: 'san luis potosí', distritos: 7 },
  { id: 25, name: 'Sinaloa', key: 'sinaloa', distritos: 7 },
  { id: 26, name: 'Sonora', key: 'sonora', distritos: 7 },
  { id: 27, name: 'Tabasco', key: 'tabasco', distritos: 6 },
  { id: 28, name: 'Tamaulipas', key: 'tamaulipas', distritos: 8 },
  { id: 29, name: 'Tlaxcala', key: 'tlaxcala', distritos: 3 },
  { id: 30, name: 'Veracruz', key: 'veracruz', distritos: 19 },
  { id: 31, name: 'Yucatán', key: 'yucatán', distritos: 6 },
  { id: 32, name: 'Zacatecas', key: 'zacatecas', distritos: 4 },
];

const generateInitialVocales = () => {
  const store = {};
  ENTIDADES_CATALOGO.forEach(ent => {
    store[ent.name] = {
      vocalEjecutivo: {
        nombre: `Lic. Vocal Ejecutivo(a) - ${ent.name}`,
        antiguedadCargo: '3 años',
        antiguedadIne: '10 años',
        folio: `VE-${ent.id.toString().padStart(2, '0')}-2026`,
        estatus: 'Titular Activo'
      },
      vocalCapacitacion: {
        nombre: `Mtro(a). Vocal de Capacitación - ${ent.name}`,
        antiguedadCargo: '2 años',
        antiguedadIne: '7 años',
        folio: `VCE-${ent.id.toString().padStart(2, '0')}-2026`,
        estatus: 'Titular Activo'
      }
    };
  });
  return store;
};

const aggregateMetrics = (items, selector) => Object.fromEntries(
  CAMPOS_RECONTRATACIONES.map(({ key }) => [
    key,
    items.reduce((sum, item) => {
      const value = selector(item)?.[key];
      return sum + (typeof value === 'number' && Number.isFinite(value) ? value : 0);
    }, 0),
  ])
);

const aggregateNationalDatasets = (states, datasets) => {
  const processTotals = Object.fromEntries(
    PROCESOS_ELECTORALES.map(({ id }) => [
      id,
      aggregateMetrics(datasets, (dataset) => dataset.totales?.procesos?.[id]),
    ])
  );
  const globalTotals = aggregateMetrics(datasets, (dataset) => dataset.totales?.global);
  const districts = datasets.flatMap((dataset, index) => {
    return (dataset.distritos ?? []).map((district) => ({
      ...district,
      entidadNombre: ENTIDADES_CATALOGO.find(({ id }) => (
        String(id).padStart(2, '0') === String(district.entidad).padStart(2, '0')
      ))?.name ?? states[index],
    }));
  });
  districts.sort((a, b) => (
    Number(a.entidad) - Number(b.entidad)
    || Number(a.distrito) - Number(b.distrito)
  ));
  const projectionValues = districts
    .map(({ proyeccion_personas_contactar }) => proyeccion_personas_contactar)
    .filter((value) => typeof value === 'number' && Number.isFinite(value));

  return {
    procesos: datasets[0]?.procesos ?? {},
    totales: {
      procesos: processTotals,
      global: globalTotals,
      total_personas_contactadas: globalTotals.personas_contactadas,
      proyeccion_personas_contactar: projectionValues.length
        ? projectionValues.reduce((sum, value) => sum + value, 0)
        : null,
      observaciones: datasets
        .map((dataset, index) => (
          dataset.totales?.observaciones
            ? `${states[index]}: ${dataset.totales.observaciones}`
            : ''
        ))
        .filter(Boolean)
        .join(' '),
    },
    distritos: districts,
    proyeccion_disponible: projectionValues.length > 0,
    archivo: `${datasets.length} datasets estatales`,
  };
};

export default function Recontrataciones() {
  const [vocalesStore, setVocalesStore] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Error reading localStorage', e);
    }
    return generateInitialVocales();
  });

  const [selectedState, setSelectedState] = useState(null);
  const [stateDataset, setStateDataset] = useState(null);
  const [datasetLoadError, setDatasetLoadError] = useState(null);
  const [loadingDataset, setLoadingDataset] = useState(false);
  const [availableDatasetStates, setAvailableDatasetStates] = useState([]);
  const [loadingAvailableDatasetStates, setLoadingAvailableDatasetStates] = useState(true);
  const [datasetStatesError, setDatasetStatesError] = useState(null);
  const [isDatasetAvailabilityOpen, setIsDatasetAvailabilityOpen] = useState(false);
  const [isExportingAdvance, setIsExportingAdvance] = useState(false);
  const [selectedProcessId, setSelectedProcessId] = useState(GLOBAL_PROCESS_ID);
  const [mapTopInset, setMapTopInset] = useState(40);
  const mapFrameRef = React.useRef(null);
  const mapLegendRef = React.useRef(null);
  const mapPlotRef = React.useRef(null);
  const mapCardRef = React.useRef(null);

  // Pestañas de la tarjeta: 'resumen_jle' | 'distritos' | 'vocales'
  const [cardTab, setCardTab] = useState('resumen_jle');

  // Distrito seleccionado dentro de la pestaña distritos
  const [selectedDistritoItem, setSelectedDistritoItem] = useState(null);

  // Edición in-situ de vocales
  const [editingCard, setEditingCard] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [toastMessage, setToastMessage] = useState(null);

  // Persistencia local
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vocalesStore));
    } catch (e) {
      console.error('Error saving localStorage', e);
    }
  }, [vocalesStore]);

  useEffect(() => {
    const frame = mapFrameRef.current;
    const legend = mapLegendRef.current;
    if (!frame || !legend) return undefined;

    let animationFrameId;
    const positionLegend = () => {
      const mapRect = frame.querySelector('.geo .bg rect');
      if (!mapRect) return;

      const frameBounds = frame.getBoundingClientRect();
      const mapBounds = mapRect.getBoundingClientRect();
      const cardBounds = mapCardRef.current?.getBoundingClientRect();
      const mapRight = cardBounds
        ? Math.min(mapBounds.right, cardBounds.left)
        : mapBounds.right;
      const availableMapWidth = Math.max(0, mapRight - mapBounds.left);
      const requiredTopInset = Math.max(32, Math.ceil(legend.offsetHeight) + 4);
      setMapTopInset((currentInset) => (
        currentInset === requiredTopInset ? currentInset : requiredTopInset
      ));
      const top = Math.max(0, mapBounds.top - frameBounds.top - legend.offsetHeight);
      legend.style.left = `${mapBounds.left - frameBounds.left}px`;
      legend.style.top = `${top}px`;
      legend.style.width = `${availableMapWidth}px`;
      legend.style.visibility = 'visible';
    };
    const schedulePosition = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(positionLegend);
    };

    const resizeObserver = new ResizeObserver(schedulePosition);
    resizeObserver.observe(frame);
    if (mapPlotRef.current) resizeObserver.observe(mapPlotRef.current);
    const mutationObserver = new MutationObserver(schedulePosition);
    mutationObserver.observe(frame, { childList: true, subtree: true });
    schedulePosition();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [selectedState]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleExportAdvance = async () => {
    setIsExportingAdvance(true);
    try {
      const response = await exportRecontratacionesAvance();
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const now = new Date();
      const exportDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const filename = `${exportDate}_recontrataciones_concentrado.xlsx`;
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('El avance de recontrataciones se exportó correctamente.');
    } catch (error) {
      console.error('Error exporting recontrataciones advance:', error);
      let message = error.response?.status
        ? `No fue posible exportar el avance (HTTP ${error.response.status}).`
        : 'No fue posible exportar el avance de recontrataciones.';
      if (error.response?.data instanceof Blob) {
        try {
          const payload = JSON.parse(await error.response.data.text());
          if (payload.error) message = payload.error;
        } catch {
          message = `No fue posible exportar el avance (HTTP ${error.response.status}).`;
        }
      } else if (error.response?.data?.error) {
        message = error.response.data.error;
      }
      showToast(message);
    } finally {
      setIsExportingAdvance(false);
    }
  };

  const normalize = (str) => {
    if (!str) return '';
    const normalized = str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
    return ['ciudaddemexico', 'distritofederal'].includes(normalized)
      ? 'ciudaddemexico'
      : normalized;
  };

  useEffect(() => {
    getEstadosRecontrataciones()
      .then(({ estados }) => {
        setAvailableDatasetStates(estados);
        setDatasetStatesError(null);
      })
      .catch((error) => {
        console.error('Error fetching available recontrataciones states:', error);
        setDatasetStatesError('No fue posible consultar la disponibilidad de los datasets.');
      })
      .finally(() => {
        setLoadingAvailableDatasetStates(false);
      });
  }, []);

  // Cargar dataset del estado
  useEffect(() => {
    if (!selectedState) {
      setStateDataset(null);
      setDatasetLoadError(null);
      setLoadingDataset(false);
      return;
    }

    if (selectedState === NATIONAL_VIEW && loadingAvailableDatasetStates) {
      setLoadingDataset(true);
      return;
    }

    let cancelled = false;
    setLoadingDataset(true);
    setDatasetLoadError(null);
    const loadDataset = selectedState === NATIONAL_VIEW
      ? Promise.all(availableDatasetStates.map((state) => getRecontratacionesEstado(state)))
        .then((datasets) => {
          if (datasets.length === 0) {
            throw new Error('No hay datasets estatales disponibles para calcular el avance nacional.');
          }
          return aggregateNationalDatasets(availableDatasetStates, datasets);
        })
      : getRecontratacionesEstado(selectedState);

    loadDataset
      .then((dataset) => {
        if (!cancelled) setStateDataset(dataset);
      })
      .catch((error) => {
        console.error(`Error fetching recontrataciones data for ${selectedState}:`, error);
        if (!cancelled) {
          setStateDataset(null);
          setDatasetLoadError(
            error.response?.data?.error
            || error.message
            || `No fue posible leer el dataset de ${selectedState}.`
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDataset(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedState, availableDatasetStates, loadingAvailableDatasetStates]);

  // Selección al hacer clic en el mapa
  const handleMapClick = (stateName) => {
    setSelectedState(stateName);
    setSelectedProcessId(GLOBAL_PROCESS_ID);
    setCardTab('resumen_jle');
    setSelectedDistritoItem(null);
    setEditingCard(null);
  };

  const handleEntityChange = (entity) => {
    if (entity === NATIONAL_VIEW) {
      setSelectedState(NATIONAL_VIEW);
      setSelectedProcessId(GLOBAL_PROCESS_ID);
      setCardTab('resumen_jle');
      setSelectedDistritoItem(null);
      setEditingCard(null);
      return;
    }
    if (entity) handleMapClick(entity);
  };

  const currentVocales = useMemo(() => {
    if (!selectedState) return null;
    return vocalesStore[selectedState] || generateInitialVocales()[selectedState] || {
      vocalEjecutivo: { nombre: 'Por asignar', antiguedadCargo: 'N/A', antiguedadIne: 'N/A' },
      vocalCapacitacion: { nombre: 'Por asignar', antiguedadCargo: 'N/A', antiguedadIne: 'N/A' }
    };
  }, [vocalesStore, selectedState]);

  // Manejo de edición in-situ de vocales
  const handleStartEdit = (roleKey) => {
    setEditingCard(roleKey);
    setEditFormData({ ...currentVocales[roleKey] });
  };

  const handleSaveEdit = (roleKey) => {
    const updated = {
      ...vocalesStore,
      [selectedState]: {
        ...currentVocales,
        [roleKey]: {
          ...currentVocales[roleKey],
          ...editFormData
        }
      }
    };
    setVocalesStore(updated);
    setEditingCard(null);
    showToast(`✅ Ficha guardada con éxito.`);
  };

  const handleCancelEdit = () => {
    setEditingCard(null);
    setEditFormData({});
  };

  // Geometría del mapa
  const locations = useMemo(() => {
    if (!mexicoGeoData || !mexicoGeoData.features) return [];
    return mexicoGeoData.features.map(f => f.properties.name);
  }, []);

  const availableStateKeys = useMemo(
    () => new Set(availableDatasetStates.map(normalize)),
    [availableDatasetStates]
  );

  const statesWithDataset = ENTIDADES_CATALOGO
    .filter(({ key }) => availableStateKeys.has(normalize(key)))
    .map(({ name }) => name);
  const statesWithoutDataset = ENTIDADES_CATALOGO
    .filter(({ key }) => !availableStateKeys.has(normalize(key)))
    .map(({ name }) => name);

  const zValues = useMemo(
    () => locations.map(name => availableStateKeys.has(normalize(name)) ? 1 : 0),
    [locations, availableStateKeys]
  );

  // Datos JLE del dataset
  const jleData = stateDataset?.totales;
  const isGlobalProcessSelected = selectedProcessId === GLOBAL_PROCESS_ID;
  const jleProcessData = isGlobalProcessSelected
    ? jleData?.global
    : jleData?.procesos?.[selectedProcessId];
  const selectedDistritoMetrics = selectedDistritoItem
    ? isGlobalProcessSelected
      ? selectedDistritoItem.global
      : selectedDistritoItem.procesos?.[selectedProcessId]
    : null;
  const selectedProcess = isGlobalProcessSelected
    ? {
      id: GLOBAL_PROCESS_ID,
      label: selectedState === NATIONAL_VIEW
        ? 'Avance Nacional'
        : 'Avance global de la entidad',
      badge: selectedState === NATIONAL_VIEW ? 'Avance Nacional' : 'Avance global',
    }
    : PROCESOS_ELECTORALES.find(({ id }) => id === selectedProcessId)
      ?? PROCESOS_ELECTORALES[0];

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: COLORS.fondoClaro,
      fontFamily: "'Outfit', 'Segoe UI', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 32,
          zIndex: 99999,
          background: COLORS.grisOxford,
          color: COLORS.blanco,
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          border: `1px solid ${COLORS.beige}`,
          fontSize: '0.88rem'
        }}>
          <Sparkles size={16} color={COLORS.beige} />
          {toastMessage}
        </div>
      )}

      {/* Header Superior Limpio */}
      <header style={{
        minHeight: '56px',
        background: COLORS.blanco,
        borderBottom: `1px solid ${COLORS.bordeSuave}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px 16px',
        padding: '0 24px',
        flexShrink: 0,
        zIndex: 50,
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: COLORS.grisOxford,
            color: COLORS.blanco,
            fontWeight: 800,
            fontSize: '0.82rem',
            padding: '4px 10px',
            borderRadius: '6px',
            letterSpacing: '1px'
          }}>
            INE
          </div>
          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: COLORS.grisOxford }}>
            Recontrataciones
          </span>
          <span style={{
            background: COLORS.grisCalido,
            color: COLORS.grisOxford,
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '12px'
          }}>
            {selectedProcess.badge}
          </span>
        </div>

        {selectedState && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, marginLeft: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '0.85rem', color: COLORS.grisMedio }}>
                Entidad: <b style={{ color: COLORS.grisOxford }}>
                  {selectedState === NATIONAL_VIEW ? 'Avance Nacional' : selectedState}
                </b>
              </span>
              <button
                onClick={() => {
                  setSelectedState(null);
                  setStateDataset(null);
                  setSelectedDistritoItem(null);
                }}
                style={{
                  background: COLORS.fondoClaro,
                  border: `1px solid ${COLORS.bordeSuave}`,
                  color: COLORS.grisOxford,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cerrar tarjeta
              </button>
            </div>
          </div>
        )}
      </header>

      {/* =====================================================================
          MAPA DE MÉXICO - PANTALLA COMPLETA
         ===================================================================== */}
      <main style={{
        flex: 1,
        position: 'relative',
        width: '100%',
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          flex: '0 0 auto',
          width: 'max-content',
          maxWidth: 'calc(100% - 2 * clamp(8px, 1.5vw, 20px))',
          margin: '2px clamp(8px, 1.5vw, 20px)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) max-content',
          gap: 8,
        }}>
        <div style={{
          minWidth: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, max-content)',
          gap: 8,
        }}>
        <label style={{
          flex: '0 0 auto',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          padding: '9px 12px',
          background: 'rgba(255,255,255,0.96)',
          border: `1px solid ${COLORS.bordeSuave}`,
          borderRadius: '10px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
          color: COLORS.grisOxford,
          fontFamily: "'Outfit', 'Segoe UI', sans-serif",
          fontSize: '0.78rem',
          fontWeight: 700
        }}>
          <Building2 size={18} color={COLORS.beige} />
          <span>Elegir entidad</span>
          <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select
              aria-label="Elegir entidad"
              value={selectedState ?? ''}
              onChange={(event) => {
                handleEntityChange(event.target.value);
              }}
              style={{
                appearance: 'none',
                maxWidth: 'min(42vw, 220px)',
                minWidth: 0,
                padding: '7px 34px 7px 9px',
                border: `1px solid ${COLORS.bordeSuave}`,
                borderRadius: '7px',
                background: COLORS.blanco,
                color: COLORS.grisOxford,
                font: 'inherit',
                cursor: 'pointer'
              }}
            >
              <option value="">Selecciona una entidad...</option>
              <option value={NATIONAL_VIEW}>Avance Nacional</option>
              {ENTIDADES_CATALOGO
                .filter(({ name }) => statesWithDataset.includes(name))
                .sort((a, b) => a.name.localeCompare(b.name, 'es'))
                .map(({ name }) => <option key={name} value={name}>{name}</option>)}
            </select>
            <ChevronDown
              aria-hidden="true"
              size={18}
              strokeWidth={2.5}
              style={{ position: 'absolute', right: 9, pointerEvents: 'none', color: COLORS.grisOxford }}
            />
          </span>
        </label>
        <section style={{
          position: 'relative',
          zIndex: 15,
          marginLeft: 0,
          width: '100%',
          maxWidth: '100%',
        }}>
          <button
            type="button"
            aria-expanded={isDatasetAvailabilityOpen}
            aria-controls="dataset-availability-panel"
            onClick={() => setIsDatasetAvailabilityOpen((isOpen) => !isOpen)}
            style={{
              display: 'flex',
              width: '100%',
              boxSizing: 'border-box',
              alignItems: 'center',
              gap: 8,
              padding: '9px 12px',
              background: 'rgba(255,255,255,0.97)',
              border: `1px solid ${COLORS.bordeSuave}`,
              borderRadius: '9px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
              color: COLORS.grisOxford,
              fontFamily: "'Outfit', 'Segoe UI', sans-serif",
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <FileSpreadsheet size={18} color={COLORS.beige} />
            Disponibilidad de datasets
            {!datasetStatesError && (
              <span style={{ color: COLORS.grisMedio }}>
                {statesWithDataset.length}/{ENTIDADES_CATALOGO.length}
              </span>
            )}
            <ChevronDown
              size={18}
              strokeWidth={2.5}
              style={{
                marginLeft: 'auto',
                marginRight: 9,
                transform: isDatasetAvailabilityOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
              }}
            />
          </button>
          {isDatasetAvailabilityOpen && (
            <div
              id="dataset-availability-panel"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 'auto',
                width: 'min(480px, calc(100vw - 2 * clamp(8px, 1.5vw, 20px)))',
                maxHeight: '42vh',
                overflow: 'auto',
                marginTop: 8,
                padding: '12px',
                background: 'rgba(255,255,255,0.97)',
                border: `1px solid ${COLORS.bordeSuave}`,
                borderRadius: '10px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
              }}
            >
              {datasetStatesError ? (
                <div role="alert" style={{ fontSize: '0.76rem', color: '#A33A35' }}>{datasetStatesError}</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', color: COLORS.grisOxford }}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '50%', padding: '5px', textAlign: 'left', borderBottom: `1px solid ${COLORS.bordeSuave}` }}>
                        Con información ({statesWithDataset.length})
                      </th>
                      <th scope="col" style={{ width: '50%', padding: '5px', textAlign: 'left', borderBottom: `1px solid ${COLORS.bordeSuave}` }}>
                        Sin información ({statesWithoutDataset.length})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.max(statesWithDataset.length, statesWithoutDataset.length) }, (_, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '4px 5px', borderBottom: `1px solid ${COLORS.fondoClaro}` }}>{statesWithDataset[idx] ?? ''}</td>
                        <td style={{ padding: '4px 5px', borderBottom: `1px solid ${COLORS.fondoClaro}` }}>{statesWithoutDataset[idx] ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
        </div>
        <button
          type="button"
          onClick={handleExportAdvance}
          disabled={isExportingAdvance}
          aria-busy={isExportingAdvance}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'stretch',
            gap: 8,
            padding: '9px 14px',
            background: '#89c5a8',
            border: '1px solid #72ad91',
            borderRadius: '10px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
            color: COLORS.grisOxford,
            fontFamily: "'Outfit', 'Segoe UI', sans-serif",
            fontSize: '0.78rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            cursor: isExportingAdvance ? 'wait' : 'pointer',
            opacity: isExportingAdvance ? 0.75 : 1,
          }}
        >
          <Download size={18} aria-hidden="true" />
          {isExportingAdvance ? 'Exportando...' : 'Exportar avance'}
        </button>
        </div>
        <div style={{
          flex: '1 1 auto',
          minHeight: 0,
          width: '100%',
          position: 'relative',
        }} ref={mapFrameRef}>
        <div
  ref={mapLegendRef}
  aria-label="Entidades que remitieron el formato de Avance de Recontratación. Fecha de corte: 20 de Octubre de 2026"
  style={{
    position: 'absolute',
    zIndex: 20,
    display: 'flex',
    boxSizing: 'border-box',
    visibility: 'hidden',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '4px 7px',
    padding: '4px 8px',
    border: `1px solid ${COLORS.bordeSuave}`,
    borderRadius: 6,
    background: 'rgba(255,255,255,0.96)',
    color: COLORS.grisOxford,
    fontSize: '0.76rem',
    fontWeight: 600,
    textAlign: 'center',
    lineHeight: 1.3,
  }}
>
  {/* ✅ Cuadrito + label pegados en un inline-flex, nunca se separan */}
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
    <span
      aria-hidden="true"
      style={{
        width: 12,
        height: 12,
        flex: '0 0 12px',
        background: COLORS.beige,
        borderRadius: 2,
      }}
    />
    <span>Entidades que remitieron el formato de Avance de Recontratación</span>
  </span>

  {/* ✅ Color beige en la fecha */}
  <span style={{ whiteSpace: 'nowrap', color: COLORS.beige }}>
    - Fecha de corte: 20 de Octubre de 2026
  </span>
</div>
        <div
          ref={mapPlotRef}
          style={{
            position: 'absolute',
            inset: `${mapTopInset}px 0 0`,
            minHeight: 0,
            width: '100%',
          }}
        >
        <Plot
          data={[{
            type: 'choropleth',
            geojson: mexicoGeoData,
            locations: locations,
            z: zValues,
            featureidkey: 'properties.name',
            colorscale: [
              [0, '#EAECEF'],
              [0.49, '#EAECEF'],
              [0.5, COLORS.beige],
              [1, COLORS.beige]
            ],
            zmin: 0,
            zmax: 1,
            showscale: false,
            marker: {
              line: {
                color: locations.map(n =>
                  selectedState === NATIONAL_VIEW
                    ? COLORS.grisOxford
                    : normalize(n) === normalize(selectedState)
                    ? COLORS.grisOxford
                    : '#CBD0D5'
                ),
                width: locations.map(n =>
                  selectedState === NATIONAL_VIEW
                    ? 1.8
                    : normalize(n) === normalize(selectedState) ? 2.5 : 0.8
                )
              }
            },
            hoverinfo: 'text',
            text: locations.map(name => {
              return `<b>${name.toUpperCase()}</b><br>👉 Clic para desplegar la información del dataset`;
            }),
            hoverlabel: {
              bgcolor: COLORS.blanco,
              bordercolor: COLORS.grisOxford,
              font: { family: 'Outfit, sans-serif', size: 12, color: COLORS.grisOxford }
            }
          }]}
          layout={{
            geo: {
              scope: 'world',
              showframe: false,
              showcoastlines: false,
              showland: true,
              landcolor: '#F8F9FA',
              showocean: true,
              oceancolor: '#EBF1F6',
              showlakes: false,
              projection: { type: 'mercator' },
              center: { lat: 23.6345, lon: -102.5528 },
              lonaxis: { range: [-118.5, -86] },
              lataxis: { range: [14.2, 33] },
              bgcolor: '#F5F6F8'
            },
            margin: { t: 20, r: 0, b: 0, l: 0 },
            paper_bgcolor: '#F5F6F8',
            plot_bgcolor: '#F5F6F8',
            font: { color: COLORS.grisOxford },
            dragmode: false,
            autosize: true
          }}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
          onClick={(event) => {
            if (event && event.points && event.points[0]) {
              const clickedState = event.points[0].location;
              if (clickedState) {
                handleMapClick(clickedState);
              }
            }
          }}
          config={{
            displayModeBar: false,
            scrollZoom: false,
            responsive: true
          }}
        />
        </div>
        </div>

        {/* =====================================================================
            TARJETA LATERAL DESPLEGABLE DEL ESTADO
           ===================================================================== */}
        {selectedState && (
          <div style={{
            position: 'absolute',
            top: 16,
            right: 20,
            width: '520px',
            maxWidth: 'calc(100vw - 40px)',
            maxHeight: 'calc(100% - 32px)',
            background: COLORS.blanco,
            borderRadius: '18px',
            border: `1px solid ${COLORS.bordeSuave}`,
            boxShadow: '0 12px 35px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100,
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease-out'
          }} ref={mapCardRef}>
            {/* Header de la Tarjeta del Estado */}
            <div style={{
              padding: '18px 22px',
              background: COLORS.fondoClaro,
              borderBottom: `1px solid ${COLORS.bordeSuave}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: COLORS.beige, letterSpacing: '1px' }}>
                  Entidad seleccionada
                </span>
                <h2 style={{ margin: '2px 0 0', fontSize: '1.35rem', fontWeight: 800, color: COLORS.grisOxford }}>
                  {selectedState === NATIONAL_VIEW ? 'Avance Nacional' : selectedState}
                </h2>
              </div>

              <button
                onClick={() => setSelectedState(null)}
                style={{
                  background: COLORS.blanco,
                  border: `1px solid ${COLORS.bordeSuave}`,
                  color: COLORS.grisOxford,
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Selección del proceso electoral */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              borderBottom: `1px solid ${COLORS.bordeSuave}`,
              background: COLORS.blanco,
            }}>
              <label
                htmlFor="recontrataciones-process"
                style={{ flex: '0 0 auto', fontSize: '0.75rem', fontWeight: 700, color: COLORS.grisMedio }}
              >
                Vista
              </label>
              <span style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                <select
                  id="recontrataciones-process"
                  aria-label="Seleccionar proceso electoral"
                  value={selectedProcessId}
                  onChange={(event) => setSelectedProcessId(event.target.value)}
                  style={{
                    appearance: 'none',
                    width: '100%',
                    minWidth: 0,
                    padding: '9px 36px 9px 11px',
                    border: `1px solid ${COLORS.bordeSuave}`,
                    borderRadius: 8,
                    background: COLORS.blanco,
                    color: COLORS.grisOxford,
                    fontFamily: 'inherit',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <option value={GLOBAL_PROCESS_ID}>
                    {selectedState === NATIONAL_VIEW
                      ? 'Avance Nacional'
                      : 'Avance global de la entidad'}
                  </option>
                  {PROCESOS_ELECTORALES.map((proceso) => (
                    <option key={proceso.id} value={proceso.id}>{proceso.label}</option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  size={16}
                  strokeWidth={2.5}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: 12,
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: COLORS.grisOxford,
                  }}
                />
              </span>
            </div>

            {/* Pestañas de la Tarjeta */}
            <div style={{
              display: 'flex',
              background: '#EBEEF2',
              padding: '4px',
              borderBottom: `1px solid ${COLORS.bordeSuave}`
            }}>
              <button
                onClick={() => setCardTab('resumen_jle')}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: cardTab === 'resumen_jle' ? COLORS.blanco : 'transparent',
                  color: cardTab === 'resumen_jle' ? COLORS.grisOxford : COLORS.grisMedio,
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  boxShadow: cardTab === 'resumen_jle' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <FileSpreadsheet size={14} color={cardTab === 'resumen_jle' ? COLORS.beige : COLORS.grisMedio} />
                Datos JLE
              </button>

              <button
                onClick={() => {
                  setCardTab('distritos');
                  setSelectedDistritoItem(null);
                }}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: cardTab === 'distritos' ? COLORS.blanco : 'transparent',
                  color: cardTab === 'distritos' ? COLORS.grisOxford : COLORS.grisMedio,
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  boxShadow: cardTab === 'distritos' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Layers size={14} color={cardTab === 'distritos' ? COLORS.beige : COLORS.grisMedio} />
                Mostrar Distritos {stateDataset?.distritos?.length ? `(${stateDataset.distritos.length})` : ''}
              </button>

              {/* Pestaña temporalmente deshabilitada
              <button
                onClick={() => setCardTab('vocales')}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: cardTab === 'vocales' ? COLORS.blanco : 'transparent',
                  color: cardTab === 'vocales' ? COLORS.grisOxford : COLORS.grisMedio,
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  boxShadow: cardTab === 'vocales' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <User size={14} color={cardTab === 'vocales' ? COLORS.beige : COLORS.grisMedio} />
                Vocales (Editar)
              </button>
              */}
            </div>

            {/* Contenido Dinámico */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {/* PESTAÑA: VOCALES (SIEMPRE DISPONIBLE E INDEPENDIENTE DEL DATASET) */}
              {cardTab === 'vocales' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <span style={{ fontSize: '0.8rem', color: COLORS.grisMedio }}>
                    Figuras de la Junta Local Ejecutiva de <b>{selectedState}</b>. Puedes editar sus datos in-situ.
                  </span>

                  {/* Vocal Ejecutivo */}
                  <EditableVocalCard
                    roleKey="vocalEjecutivo"
                    title="Vocal Ejecutivo(a)"
                    subtitle="Junta Local Ejecutiva"
                    data={editingCard === 'vocalEjecutivo' ? editFormData : currentVocales.vocalEjecutivo}
                    isEditing={editingCard === 'vocalEjecutivo'}
                    badgeColor={COLORS.grisOxford}
                    avatarInitials="VE"
                    onStartEdit={() => handleStartEdit('vocalEjecutivo')}
                    onSaveEdit={() => handleSaveEdit('vocalEjecutivo')}
                    onCancelEdit={handleCancelEdit}
                    onChangeField={(f, v) => setEditFormData(prev => ({ ...prev, [f]: v }))}
                  />

                  {/* Vocal de Capacitación */}
                  <EditableVocalCard
                    roleKey="vocalCapacitacion"
                    title="Vocal de Capacitación Electoral y Educación Cívica"
                    subtitle="Capacitación Electoral y Educación Cívica"
                    data={editingCard === 'vocalCapacitacion' ? editFormData : currentVocales.vocalCapacitacion}
                    isEditing={editingCard === 'vocalCapacitacion'}
                    badgeColor={COLORS.beige}
                    avatarInitials="VCEyEC"
                    onStartEdit={() => handleStartEdit('vocalCapacitacion')}
                    onSaveEdit={() => handleSaveEdit('vocalCapacitacion')}
                    onCancelEdit={handleCancelEdit}
                    onChangeField={(f, v) => setEditFormData(prev => ({ ...prev, [f]: v }))}
                  />
                </div>
              ) : loadingDataset ? (
                <div style={{ textAlign: 'center', padding: '40px', color: COLORS.grisMedio }}>
                  Cargando datos del dataset de {selectedState}...
                </div>
              ) : !stateDataset ? (
                <div style={{
                  padding: '30px 20px',
                  textAlign: 'center',
                  background: COLORS.fondoClaro,
                  borderRadius: '14px',
                  border: `1px dashed ${COLORS.bordeSuave}`
                }}>
                  <FileSpreadsheet size={36} color={COLORS.beige} style={{ margin: '0 auto 10px' }} />
                <h4 style={{ margin: '0 0 6px', color: COLORS.grisOxford }}>
                  {datasetLoadError ? 'No se pudieron cargar los datos' : 'Dataset no disponible'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem', color: COLORS.grisMedio, lineHeight: 1.4 }}>
                  {datasetLoadError
                    ? datasetLoadError
                    : <>Aún no se ha cargado el archivo Excel correspondiente a <b>{selectedState}</b> en la carpeta <code>datasets/</code>.</>}
                </p>
                </div>
              ) : cardTab === 'resumen_jle' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{
                    fontSize: '0.76rem',
                    color: COLORS.grisMedio,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}>
                    <span><b style={{ color: COLORS.grisOxford }}>Datos acumulados de los distritos</b></span>
                    <span>{selectedProcess.label}</span>
                    <span>Archivo: <b>{stateDataset?.archivo ?? '—'}</b></span>
                  </div>

                  <DatasetMetricsGrid
                    metrics={jleProcessData}
                    total={jleProcessData?.personas_contactadas}
                    projection={jleData?.proyeccion_personas_contactar}
                  />

                  {selectedState !== NATIONAL_VIEW && (
                    <div style={{
                      background: COLORS.fondoClaro,
                      borderRadius: '12px',
                      padding: '12px 14px',
                      border: `1px solid ${COLORS.bordeSuave}`
                    }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: COLORS.grisMedio, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                        Observaciones (en su caso)
                      </span>
                      <div style={{ fontSize: '0.85rem', color: COLORS.grisOxford, marginTop: 4 }}>
                        {jleData?.observaciones || 'Sin observaciones registradas.'}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* =============================================================
                   PESTAÑA: DISTRITOS
                   ============================================================= */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {selectedDistritoItem ? (
                    /* Detalle del distrito seleccionado */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <button
                        onClick={() => setSelectedDistritoItem(null)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: COLORS.beige,
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          alignSelf: 'flex-start'
                        }}
                      >
                        <ArrowLeft size={14} /> Volver a lista de distritos
                      </button>

                      <div style={{
                        background: COLORS.fondoClaro,
                        borderRadius: '12px',
                        padding: '14px 16px',
                        border: `1px solid ${COLORS.bordeSuave}`
                      }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: COLORS.beige }}>
                          {selectedState === NATIONAL_VIEW
                            ? `${selectedDistritoItem.entidadNombre} · Distrito ${selectedDistritoItem.distrito}`
                            : `Distrito Federal ${selectedDistritoItem.distrito}`}
                        </span>
                        <h3 style={{ margin: '2px 0 0', fontSize: '1.15rem', color: COLORS.grisOxford }}>
                          Cabecera: {selectedDistritoItem.cabecera}
                        </h3>
                      </div>

                      <span style={{ fontSize: '0.76rem', color: COLORS.grisMedio }}>
                        {selectedProcess.label}
                      </span>
                      <DatasetMetricsGrid
                        metrics={selectedDistritoMetrics}
                        total={selectedDistritoMetrics?.personas_contactadas}
                        projection={selectedDistritoItem.proyeccion_personas_contactar}
                      />

                      {selectedState !== NATIONAL_VIEW && (
                        <div style={{
                          background: COLORS.fondoClaro,
                          borderRadius: '12px',
                          padding: '12px 14px',
                          border: `1px solid ${COLORS.bordeSuave}`
                        }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: COLORS.grisMedio, textTransform: 'uppercase' }}>
                            Observaciones (en su caso)
                          </span>
                          <div style={{ fontSize: '0.85rem', color: COLORS.grisOxford, marginTop: 4 }}>
                            {selectedDistritoItem.observaciones || 'Sin observaciones en este distrito.'}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Lista de distritos */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <span style={{ fontSize: '0.8rem', color: COLORS.grisMedio }}>
                        Selecciona un distrito para consultar sus datos correspondientes:
                      </span>

                      {(stateDataset?.distritos ?? []).map((dist) => {
                        const districtMetrics = isGlobalProcessSelected
                          ? dist.global
                          : dist.procesos?.[selectedProcessId];
                        const coverage = getProjectionCoverage(
                          districtMetrics?.personas_contactadas,
                          dist.proyeccion_personas_contactar
                        );
                        return (
                        <div
                          key={`${dist.entidad}-${dist.distrito}`}
                          onClick={() => setSelectedDistritoItem(dist)}
                          style={{
                            background: COLORS.fondoClaro,
                            border: `1px solid ${COLORS.bordeSuave}`,
                            borderRadius: '12px',
                            padding: '14px 16px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = COLORS.beige;
                            e.currentTarget.style.background = '#FFFFFF';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = COLORS.bordeSuave;
                            e.currentTarget.style.background = COLORS.fondoClaro;
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                background: COLORS.grisOxford,
                                color: COLORS.blanco,
                                fontWeight: 800,
                                fontSize: '0.72rem',
                                padding: '2px 7px',
                                borderRadius: '5px'
                              }}>
                                DTO {dist.distrito}
                              </span>
                              {selectedState === NATIONAL_VIEW && (
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  color: COLORS.grisMedio,
                                  textTransform: 'uppercase',
                                }}>
                                  {dist.entidadNombre}
                                </span>
                              )}
                              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: COLORS.grisOxford }}>
                                {dist.cabecera}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: COLORS.grisMedio, marginTop: 4 }}>
                              Interesadas: <b>{formatCount(districtMetrics?.personas_interesadas)}</b>
                              {' · '}Proyección: <b>{formatCount(dist.proyeccion_personas_contactar)}</b>
                              {' · '}Cobertura: <b>{coverage === null ? 'Sin proyección' : `${coverage.toFixed(1)}%`}</b>
                            </div>
                          </div>
                          <ChevronRight size={18} color={COLORS.grisMedio} />
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function formatCount(value) {
  return typeof value === 'number' ? value.toLocaleString('es-MX') : value ?? 'Sin dato';
}

function getProjectionCoverage(interested, projection) {
  const contactedValue = typeof interested === 'number' ? interested : Number(interested);
  const projectionValue = typeof projection === 'number' ? projection : Number(projection);
  if (!Number.isFinite(contactedValue) || !Number.isFinite(projectionValue) || projectionValue <= 0) {
    return null;
  }
  return (contactedValue / projectionValue) * 100;
}

function DatasetMetricsGrid({ metrics, total, projection }) {
  const chartValues = CAMPOS_RECONTRATACIONES.map(({ key }) => {
    const value = metrics?.[key];
    const numericValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
  });
  const chartTotal = chartValues.reduce((sum, value) => sum + value, 0);
  const projectionCoverage = getProjectionCoverage(metrics?.personas_interesadas, projection);

  return (
    <>
      <section
        aria-label="Gráfica de personas por variable"
        style={{
          background: COLORS.blanco,
          border: `1px solid ${COLORS.bordeSuave}`,
          borderRadius: '12px',
          padding: '14px 12px 10px',
        }}
      >
        <div style={{
          fontSize: '0.72rem',
          fontWeight: 800,
          color: COLORS.grisOxford,
          textTransform: 'uppercase',
          textAlign: 'center',
          marginBottom: 6,
        }}>
          Personas por variable
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 210 }}>
          <div style={{ flex: '0 0 48%', minWidth: 0, height: 210 }}>
            {chartTotal > 0 ? (
              <Plot
                data={[{
                  type: 'pie',
                  labels: CAMPOS_RECONTRATACIONES.map(({ label }) => label),
                  values: chartValues,
                  textinfo: 'none',
                  marker: {
                    colors: CAMPOS_RECONTRATACIONES.map(({ color }) => color),
                    line: { color: COLORS.blanco, width: 2 },
                  },
                  hovertemplate: '%{label}<br>%{value:,} personas (%{percent})<extra></extra>',
                  sort: false,
                }]}
                layout={{
                  height: 210,
                  margin: { t: 4, r: 4, b: 4, l: 4 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  showlegend: false,
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                style={{ width: '100%', height: 210 }}
              />
            ) : (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: COLORS.grisMedio,
                fontSize: '0.78rem',
                textAlign: 'center',
              }}>
                Sin cantidades para mostrar.
              </div>
            )}
          </div>
          <div aria-label="Guía de colores de variables" style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
          }}>
            {CAMPOS_RECONTRATACIONES.map(({ key, label, color }, index) => {
              const percentage = chartTotal > 0 ? (chartValues[index] / chartTotal) * 100 : 0;
              return (
                <div key={key} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 7,
                  fontSize: '0.68rem',
                  lineHeight: 1.3,
                }}>
                  <span aria-hidden="true" style={{
                    width: 10,
                    height: 10,
                    flex: '0 0 10px',
                    marginTop: 2,
                    borderRadius: '50%',
                    background: color,
                  }} />
                  <span style={{ flex: 1, color: COLORS.grisOxford }}>
                    {label}
                    <br />
                    <b>{formatCount(metrics?.[key])}</b>
                    {chartTotal > 0 && (
                      <span style={{ color: COLORS.grisMedio }}> · {percentage.toFixed(1)}%</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{
          marginTop: 8,
          padding: '10px 12px',
          borderRadius: 9,
          background: COLORS.fondoClaro,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 8,
            fontSize: '0.72rem',
          }}>
            <span style={{ color: COLORS.grisOxford, fontWeight: 700 }}>Proyección de cobertura de la plantilla</span>
            <b style={{ color: COLORS.grisOxford }}>
              {projectionCoverage === null ? 'Sin proyección' : `${projectionCoverage.toFixed(1)}%`}
            </b>
          </div>
          <div
            role="progressbar"
            aria-label="Proyección de cobertura de la plantilla"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={projectionCoverage === null ? 0 : Math.min(projectionCoverage, 100)}
            style={{
              height: 7,
              overflow: 'hidden',
              marginTop: 7,
              borderRadius: 999,
              background: COLORS.bordeSuave,
            }}
          >
            <div style={{
              width: `${projectionCoverage === null ? 0 : Math.min(projectionCoverage, 100)}%`,
              height: '100%',
              borderRadius: 'inherit',
              background: '#89c5a8',
              transition: 'width 0.2s ease',
            }} />
          </div>
          <div style={{ marginTop: 5, color: COLORS.grisMedio, fontSize: '0.68rem' }}>
            {formatCount(metrics?.personas_interesadas)} de {formatCount(projection)}  SE y CAE proyectados/as
          </div>
        </div>
      </section>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 10,
      }}>
        {/*         <DatasetFieldCard
          title="Total de personas contactadas"
          value={total}
          highlight
        /> */}
        <DatasetFieldCard
          title="Proyección de SE y CAE a contactar"
          value={projection}
        />
{/*         <DatasetFieldCard
          title="Avance sobre la proyección"
          value={projectionCoverage === null ? 'Sin proyección' : `${projectionCoverage.toFixed(1)}%`}
          highlight
        /> */}
        {CAMPOS_RECONTRATACIONES.map(({ key, label }) => (
          <DatasetFieldCard key={key} title={label} value={metrics?.[key]} />
        ))}
      </div>
    </>
  );
}

// ===========================================================================
// Tarjetas de Campo de Dataset
// ===========================================================================
function DatasetFieldCard({ title, value, highlight = false }) {
  return (
    <div style={{
      background: highlight ? 'linear-gradient(135deg, #FAF8F5, #FFFFFF)' : COLORS.fondoClaro,
      borderRadius: '10px',
      padding: '12px 14px',
      border: `1px solid ${highlight ? COLORS.beige : COLORS.bordeSuave}`,
      borderLeft: `3px solid ${highlight ? COLORS.beige : COLORS.grisMedio}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }}>
      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: COLORS.grisMedio, lineHeight: 1.3 }}>
        {title}
      </span>
      <div style={{
        fontSize: '1.2rem',
        fontWeight: 800,
        color: highlight ? COLORS.beige : COLORS.grisOxford,
        marginTop: 4,
      }}>
        {formatCount(value)}
      </div>
    </div>
  );
}

// ===========================================================================
// Tarjeta Editable de Vocal (In-Situ)
// ===========================================================================
function EditableVocalCard({
  roleKey,
  title,
  subtitle,
  data,
  isEditing,
  badgeColor,
  avatarInitials,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onChangeField
}) {
  return (
    <div style={{
      background: COLORS.blanco,
      borderRadius: '14px',
      border: isEditing ? `2px solid ${COLORS.beige}` : `1px solid ${COLORS.bordeSuave}`,
      boxShadow: isEditing ? '0 6px 20px rgba(197, 169, 137, 0.25)' : '0 2px 8px rgba(0,0,0,0.03)',
      padding: '16px',
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '10px',
            background: COLORS.fondoClaro,
            border: `2px solid ${badgeColor}`,
            color: COLORS.grisOxford,
            fontWeight: 800,
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {avatarInitials}
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: badgeColor, textTransform: 'uppercase' }}>
              {subtitle}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: COLORS.grisOxford }}>
              {title}
            </div>
          </div>
        </div>

        <div>
          {isEditing ? (
            <div style={{ display: 'flex', gap: 5 }}>
              <button
                onClick={onSaveEdit}
                style={{
                  background: COLORS.grisOxford,
                  color: COLORS.blanco,
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Check size={12} /> Guardar
              </button>
              <button
                onClick={onCancelEdit}
                style={{
                  background: COLORS.fondoClaro,
                  color: COLORS.grisOxford,
                  border: `1px solid ${COLORS.bordeSuave}`,
                  padding: '5px 7px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={onStartEdit}
              style={{
                background: COLORS.fondoClaro,
                border: `1px solid ${COLORS.bordeSuave}`,
                color: COLORS.grisOxford,
                padding: '5px 9px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Edit3 size={11} /> Editar
            </button>
          )}
        </div>
      </div>

      {/* Campos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Nombre */}
        <div style={{
          background: COLORS.fondoClaro,
          padding: '8px 10px',
          borderRadius: '8px',
          border: `1px solid ${COLORS.bordeSuave}`
        }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: COLORS.grisMedio, textTransform: 'uppercase' }}>
            Nombre del Funcionario(a):
          </span>
          {isEditing ? (
            <input
              type="text"
              value={data.nombre || ''}
              onChange={(e) => onChangeField('nombre', e.target.value)}
              style={{
                width: '100%',
                background: COLORS.blanco,
                border: `1px solid ${COLORS.beige}`,
                borderRadius: '5px',
                padding: '4px 6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                marginTop: 3,
                boxSizing: 'border-box'
              }}
            />
          ) : (
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: COLORS.grisOxford, marginTop: 2 }}>
              {data.nombre || 'No asignado'}
            </div>
          )}
        </div>

        {/* Antigüedades */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{
            background: COLORS.fondoClaro,
            padding: '8px 10px',
            borderRadius: '8px',
            border: `1px solid ${COLORS.bordeSuave}`
          }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: COLORS.grisMedio, textTransform: 'uppercase' }}>
              Antigüedad Cargo:
            </span>
            {isEditing ? (
              <input
                type="text"
                value={data.antiguedadCargo || ''}
                onChange={(e) => onChangeField('antiguedadCargo', e.target.value)}
                style={{
                  width: '100%',
                  background: COLORS.blanco,
                  border: `1px solid ${COLORS.bordeSuave}`,
                  borderRadius: '5px',
                  padding: '4px 6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  marginTop: 3,
                  boxSizing: 'border-box'
                }}
              />
            ) : (
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: COLORS.beige, marginTop: 2 }}>
                {data.antiguedadCargo || 'Sin registro'}
              </div>
            )}
          </div>

          <div style={{
            background: COLORS.fondoClaro,
            padding: '8px 10px',
            borderRadius: '8px',
            border: `1px solid ${COLORS.bordeSuave}`
          }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: COLORS.grisMedio, textTransform: 'uppercase' }}>
              Antigüedad INE:
            </span>
            {isEditing ? (
              <input
                type="text"
                value={data.antiguedadIne || ''}
                onChange={(e) => onChangeField('antiguedadIne', e.target.value)}
                style={{
                  width: '100%',
                  background: COLORS.blanco,
                  border: `1px solid ${COLORS.bordeSuave}`,
                  borderRadius: '5px',
                  padding: '4px 6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  marginTop: 3,
                  boxSizing: 'border-box'
                }}
              />
            ) : (
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: COLORS.grisOxford, marginTop: 2 }}>
                {data.antiguedadIne || 'Sin registro'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
