import React, { useState, useEffect, useMemo, useRef } from 'react';
import PlotlyComponent from 'react-plotly.js';
import {
  Shield,
  Award,
  Clock,
  User,
  Edit3,
  Check,
  X,
  RotateCcw,
  Download,
  Upload,
  Layers,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Info,
  Maximize2
} from 'lucide-react';
import mexicoGeoData from '../data/mexico_geo.json';
import distritosGeoData from '../data/distritos_geometria_mexico.json';

const Plot = PlotlyComponent.default || PlotlyComponent;

// ===========================================================================
// Paleta de Colores Oficial
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
  rosaFuerte: '#E60073',
};

const STORAGE_KEY = 'ine_recontrataciones_vocalias_v1';

// Mapeo básico de catálogo de 32 entidades con distritos aproximados
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

// Valores por defecto
const DEFAULT_VOCALIA_DATA = {
  vocalEjecutivo: {
    nombre: 'Lic. Roberto Morales Peña',
    antiguedadCargo: '4 años, 2 meses',
    antiguedadIne: '14 años',
    nivel: 'Rango Titular L-3',
    estatus: 'Titular Activo',
    folio: 'SPEN-VE-2024'
  },
  vocalCapacitacion: {
    nombre: 'Mtra. Elena Gómez Valenzuela',
    antiguedadCargo: '2 años, 8 meses',
    antiguedadIne: '9 años',
    nivel: 'Rango Especialista C-2',
    estatus: 'Titular Activo',
    folio: 'SPEN-VCE-2024'
  }
};

// Generador de datos iniciales
const generateInitialStore = () => {
  const store = {};
  ENTIDADES_CATALOGO.forEach(ent => {
    store[ent.name] = {
      vocalEjecutivo: {
        nombre: `Vocal Ejecutivo(a) - ${ent.name}`,
        antiguedadCargo: '3 años',
        antiguedadIne: '10 años',
        nivel: 'Nivel SPEN Tipo A',
        estatus: 'Vigente',
        folio: `VE-${ent.id.toString().padStart(2, '0')}-2024`
      },
      vocalCapacitacion: {
        nombre: `Vocal de Capacitación - ${ent.name}`,
        antiguedadCargo: '2 años',
        antiguedadIne: '7 años',
        nivel: 'Nivel SPEN Tipo B',
        estatus: 'Vigente',
        folio: `VCE-${ent.id.toString().padStart(2, '0')}-2024`
      }
    };
  });
  return store;
};

export default function Recontrataciones() {
  const [vocalesStore, setVocalesStore] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Error reading from localStorage', e);
    }
    return generateInitialStore();
  });

  const [selectedState, setSelectedState] = useState('Campeche');
  const [viewMode, setViewMode] = useState('nacional'); // 'nacional' | 'estatal_distritos'
  const [editingCard, setEditingCard] = useState(null); // 'vocalEjecutivo' | 'vocalCapacitacion' | null
  const [editFormData, setEditFormData] = useState({});
  const [toastMessage, setToastMessage] = useState(null);
  const fileInputRef = useRef(null);

  // Guardar en localStorage ante cualquier cambio
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vocalesStore));
    } catch (e) {
      console.error('Error saving to localStorage', e);
    }
  }, [vocalesStore]);

  // Mostrar mensaje tipo toast
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Normalizador de nombres de estado
  const normalizeStateName = (str) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  // Entidad actual seleccionada
  const currentEntityMeta = useMemo(() => {
    return ENTIDADES_CATALOGO.find(e => normalizeStateName(e.name) === normalizeStateName(selectedState)) || {
      id: 0,
      name: selectedState || 'Entidad no seleccionada',
      distritos: 0
    };
  }, [selectedState]);

  // Datos de los vocales del estado actual
  const currentVocales = useMemo(() => {
    if (!selectedState) return DEFAULT_VOCALIA_DATA;
    return vocalesStore[selectedState] || vocalesStore[currentEntityMeta.name] || DEFAULT_VOCALIA_DATA;
  }, [vocalesStore, selectedState, currentEntityMeta]);

  // Iniciar edición
  const handleStartEdit = (roleKey) => {
    setEditingCard(roleKey);
    setEditFormData({ ...currentVocales[roleKey] });
  };

  // Guardar edición
  const handleSaveEdit = (roleKey) => {
    const updated = {
      ...vocalesStore,
      [currentEntityMeta.name]: {
        ...currentVocales,
        [roleKey]: {
          ...currentVocales[roleKey],
          ...editFormData
        }
      }
    };
    setVocalesStore(updated);
    setEditingCard(null);
    showToast(`✅ Ficha de ${roleKey === 'vocalEjecutivo' ? 'Vocal Ejecutivo' : 'Vocal de Capacitación'} guardada con éxito.`);
  };

  // Cancelar edición
  const handleCancelEdit = () => {
    setEditingCard(null);
    setEditFormData({});
  };

  // Restablecer valores de la entidad
  const handleResetCurrent = () => {
    if (window.confirm(`¿Deseas restablecer los valores originales para ${currentEntityMeta.name}?`)) {
      const initial = generateInitialStore();
      setVocalesStore(prev => ({
        ...prev,
        [currentEntityMeta.name]: initial[currentEntityMeta.name]
      }));
      setEditingCard(null);
      showToast(`🔄 Valores de ${currentEntityMeta.name} restablecidos.`);
    }
  };

  // Exportar respaldo en JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(vocalesStore, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `vocalias_ine_recontrataciones_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchor.click();
    showToast('💾 Respaldo JSON exportado exitosamente.');
  };

  // Importar respaldo JSON
  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (typeof parsed === 'object') {
          setVocalesStore(parsed);
          showToast('📥 Base de datos de vocales cargada correctamente.');
        }
      } catch (err) {
        alert('Archivo JSON no válido.');
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  // ---------------------------------------------------------------------------
  // Geometrías para Plotly
  // ---------------------------------------------------------------------------
  const locations = useMemo(() => {
    if (!mexicoGeoData || !mexicoGeoData.features) return [];
    return mexicoGeoData.features.map(f => f.properties.name);
  }, []);

  const zValues = useMemo(() => {
    return locations.map(name => {
      const isSel = normalizeStateName(name) === normalizeStateName(selectedState);
      return isSel ? 100 : 40;
    });
  }, [locations, selectedState]);

  // Geometría distrital para la entidad seleccionada (Nivel 2)
  const distritosEstaduales = useMemo(() => {
    if (!distritosGeoData) return [];
    const key = normalizeStateName(selectedState);
    // Buscar coincidencia en keys de distritos_geometria_mexico
    for (const [k, dList] of Object.entries(distritosGeoData)) {
      if (normalizeStateName(k) === key || k.toLowerCase().includes(key) || key.includes(k.toLowerCase())) {
        return dList;
      }
    }
    return [];
  }, [selectedState]);

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${COLORS.grisOxford} 0%, #201f22 100%)`,
      color: COLORS.blanco,
      fontFamily: "'Outfit', 'Segoe UI', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 32px',
      boxSizing: 'border-box'
    }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 32,
          zIndex: 9999,
          background: 'rgba(230, 0, 115, 0.95)',
          color: COLORS.blanco,
          padding: '14px 22px',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
          fontWeight: '600',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${COLORS.beige}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          animation: 'slideIn 0.3s ease-out'
        }}>
          <Sparkles size={18} color={COLORS.beige} />
          {toastMessage}
        </div>
      )}

      {/* Header Superior */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(32, 31, 34, 0.75)',
        backdropFilter: 'blur(16px)',
        border: `1px solid rgba(197, 169, 137, 0.25)`,
        padding: '18px 28px',
        borderRadius: '16px',
        marginBottom: '24px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            background: `linear-gradient(135deg, ${COLORS.rosaFuerte}, #8b004f)`,
            width: 48,
            height: 48,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 4px 15px rgba(230, 0, 115, 0.4)`
          }}>
            <Shield size={26} color={COLORS.blanco} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, letterSpacing: '0.5px' }}>
                RECONTRATACIONES INE
              </h1>
              <span style={{
                background: 'rgba(230, 0, 115, 0.15)',
                color: COLORS.rosaFuerte,
                border: `1px solid ${COLORS.rosaFuerte}`,
                padding: '2px 10px',
                borderRadius: '20px',
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                Fichas Ejecutivas SPEN
              </span>
            </div>
            <p style={{ margin: '4px 0 0', color: COLORS.grisClaro, fontSize: '0.85rem' }}>
              Gestión interactiva in-situ de Vocales Ejecutivos y de Capacitación Electoral
            </p>
          </div>
        </div>

        {/* Acciones y Persistencia */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleExportJSON}
            title="Exportar respaldo de datos a archivo JSON"
            style={{
              background: 'rgba(69, 66, 72, 0.8)',
              border: `1px solid ${COLORS.grisMedio}`,
              color: COLORS.blanco,
              padding: '9px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.82rem',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            <Download size={15} color={COLORS.beige} />
            Exportar JSON
          </button>

          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            title="Cargar respaldo desde archivo JSON"
            style={{
              background: 'rgba(69, 66, 72, 0.8)',
              border: `1px solid ${COLORS.grisMedio}`,
              color: COLORS.blanco,
              padding: '9px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.82rem',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            <Upload size={15} color={COLORS.rosaFuerte} />
            Importar JSON
          </button>
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleImportJSON}
          />

          <button
            onClick={handleResetCurrent}
            title="Restablecer esta entidad"
            style={{
              background: 'rgba(230, 0, 115, 0.1)',
              border: `1px solid rgba(230, 0, 115, 0.3)`,
              color: COLORS.rosaFuerte,
              padding: '9px 14px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.82rem',
              fontWeight: 600
            }}
          >
            <RotateCcw size={15} />
            Reset
          </button>
        </div>
      </header>

      {/* Grid Principal: Mapa a la Izquierda, Fichas de Videojuego a la Derecha */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.15fr 0.85fr',
        gap: '24px',
        flex: 1
      }}>
        {/* =========================================================================
            PANEL IZQUIERDO: Mapa Interactivo Nacional / Distrital (Escalable)
           ========================================================================= */}
        <section style={{
          background: 'rgba(25, 24, 27, 0.7)',
          backdropFilter: 'blur(14px)',
          borderRadius: '18px',
          border: `1px solid rgba(197, 169, 137, 0.2)`,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 35px rgba(0,0,0,0.35)',
          overflow: 'hidden'
        }}>
          {/* Barra de control del Mapa */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} color={COLORS.rosaFuerte} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                  {viewMode === 'nacional' ? 'Visor Geográfico Nacional' : `Detalle Distrital: ${selectedState}`}
                </h3>
              </div>
              <span style={{ fontSize: '0.8rem', color: COLORS.gris }}>
                {viewMode === 'nacional'
                  ? 'Haz clic en cualquier estado para desplegar sus credenciales y datos'
                  : `Visualización de los ${currentEntityMeta.distritos || distritosEstaduales.length || 'N'} distritos federales`}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              {viewMode === 'estatal_distritos' ? (
                <button
                  onClick={() => setViewMode('nacional')}
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.rosaFuerte}, #99004d)`,
                    border: 'none',
                    color: COLORS.blanco,
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.8rem',
                    boxShadow: '0 4px 12px rgba(230, 0, 115, 0.35)'
                  }}
                >
                  <ArrowLeft size={16} /> Volver a México
                </button>
              ) : (
                <button
                  onClick={() => setViewMode('estatal_distritos')}
                  style={{
                    background: 'rgba(197, 169, 137, 0.15)',
                    border: `1px solid ${COLORS.beige}`,
                    color: COLORS.beige,
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.8rem',
                    transition: 'all 0.2s'
                  }}
                >
                  Ver Distritos de {selectedState} <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Selector de acceso directo rápido */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
            background: 'rgba(0,0,0,0.3)',
            padding: '8px 14px',
            borderRadius: '10px'
          }}>
            <span style={{ fontSize: '0.78rem', color: COLORS.beige, fontWeight: 700, textTransform: 'uppercase' }}>
              Entidad Seleccionada:
            </span>
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setEditingCard(null);
              }}
              style={{
                background: COLORS.grisOxford,
                color: COLORS.blanco,
                border: `1px solid ${COLORS.grisMedio}`,
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.85rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {ENTIDADES_CATALOGO.map(ent => (
                <option key={ent.id} value={ent.name}>
                  {ent.id.toString().padStart(2, '0')} - {ent.name}
                </option>
              ))}
            </select>
            <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: COLORS.grisClaro }}>
              Distritos Federales: <b style={{ color: COLORS.rosaFuerte }}>{currentEntityMeta.distritos}</b>
            </span>
          </div>

          {/* Renderizado de Mapa con Plotly */}
          <div style={{
            flex: 1,
            minHeight: '440px',
            background: 'radial-gradient(circle at center, #1c1a1f 0%, #0d0c0e 100%)',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.06)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {viewMode === 'nacional' ? (
              <Plot
                data={[{
                  type: 'choropleth',
                  geojson: mexicoGeoData,
                  locations: locations,
                  z: zValues,
                  featureidkey: 'properties.name',
                  colorscale: [
                    [0, COLORS.grisOxford],
                    [0.4, '#5a565f'],
                    [0.6, COLORS.beige],
                    [1, COLORS.rosaFuerte]
                  ],
                  zmin: 0,
                  zmax: 100,
                  showscale: false,
                  marker: {
                    line: {
                      color: locations.map(n =>
                        normalizeStateName(n) === normalizeStateName(selectedState)
                          ? COLORS.blanco
                          : 'rgba(255,255,255,0.22)'
                      ),
                      width: locations.map(n =>
                        normalizeStateName(n) === normalizeStateName(selectedState) ? 2.5 : 0.8
                      )
                    }
                  },
                  hoverinfo: 'text',
                  text: locations.map(name => {
                    const voc = vocalesStore[name];
                    const ve = voc ? voc.vocalEjecutivo.nombre : 'Por definir';
                    return `<b>${name.toUpperCase()}</b><br>🏛️ Vocal Ejecutivo: ${ve}<br>👉 Clic para seleccionar ficha`;
                  }),
                  hoverlabel: {
                    bgcolor: COLORS.negro,
                    bordercolor: COLORS.rosaFuerte,
                    font: { family: 'Outfit, sans-serif', size: 12, color: COLORS.blanco }
                  }
                }]}
                layout={{
                  geo: {
                    scope: 'world',
                    showframe: false,
                    showcoastlines: false,
                    showland: true,
                    landcolor: '#161518',
                    showocean: true,
                    oceancolor: '#0b0a0c',
                    showlakes: false,
                    projection: { type: 'mercator' },
                    center: { lat: 23.6345, lon: -102.5528 },
                    lonaxis: { range: [-118.5, -86] },
                    lataxis: { range: [14.2, 33] },
                    bgcolor: 'transparent'
                  },
                  margin: { t: 0, r: 0, b: 0, l: 0 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: COLORS.grisClaro },
                  dragmode: false,
                  autosize: true
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                onClick={(event) => {
                  if (event && event.points && event.points[0]) {
                    const clickedState = event.points[0].location;
                    if (clickedState) {
                      setSelectedState(clickedState);
                      setEditingCard(null);
                    }
                  }
                }}
                config={{
                  displayModeBar: false,
                  scrollZoom: false,
                  responsive: true
                }}
              />
            ) : (
              /* Vista Nivel 2: Distritos Electorales del Estado */
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                padding: '24px',
                boxSizing: 'border-box',
                overflowY: 'auto'
              }}>
                <div style={{
                  background: 'rgba(230, 0, 115, 0.08)',
                  border: `1px solid ${COLORS.rosaFuerte}`,
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <h4 style={{ margin: 0, color: COLORS.blanco, fontSize: '1rem', fontWeight: 700 }}>
                      🗺️ Subdivisión Distrital Electoral - {selectedState}
                    </h4>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: COLORS.grisCalido }}>
                      {distritosEstaduales.length > 0
                        ? `Se detectaron ${distritosEstaduales.length} polígonos distritales vectoriales listos para drill-down isométrico.`
                        : `Configuración para ${currentEntityMeta.distritos} distritos uninominales.`}
                    </p>
                  </div>
                  <span style={{
                    background: COLORS.rosaFuerte,
                    color: COLORS.blanco,
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    padding: '4px 12px',
                    borderRadius: '20px'
                  }}>
                    Nivel 2 Activo
                  </span>
                </div>

                {/* Grid de Distritos */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '14px'
                }}>
                  {Array.from({ length: currentEntityMeta.distritos || distritosEstaduales.length || 2 }).map((_, idx) => {
                    const distNum = idx + 1;
                    return (
                      <div
                        key={distNum}
                        style={{
                          background: 'rgba(40, 38, 43, 0.85)',
                          border: `1px solid rgba(197, 169, 137, 0.25)`,
                          borderRadius: '12px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          transition: 'all 0.2s',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = COLORS.rosaFuerte;
                          e.currentTarget.style.transform = 'translateY(-3px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(197, 169, 137, 0.25)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            background: COLORS.grisOxford,
                            color: COLORS.beige,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px'
                          }}>
                            0{distNum} DTO
                          </span>
                          <span style={{ fontSize: '0.7rem', color: COLORS.grisMedio }}>Federal</span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: COLORS.blanco }}>
                          Junta Distrital {distNum}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: COLORS.grisClaro }}>
                          Cabecera: <span style={{ color: COLORS.beige }}>En asignación</span>
                        </div>
                        <div style={{
                          marginTop: 'auto',
                          paddingTop: '8px',
                          borderTop: '1px solid rgba(255,255,255,0.06)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.7rem',
                          color: COLORS.grisMedio
                        }}>
                          <span>Capacitación: OK</span>
                          <span style={{ color: COLORS.rosaFuerte, fontWeight: 700 }}>Activo</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* =========================================================================
            PANEL DERECHO: Fichas Duales Estilo Credencial de Videojuego
           ========================================================================= */}
        <section style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          {/* Header del bloque de credenciales */}
          <div style={{
            background: 'rgba(32, 31, 34, 0.7)',
            backdropFilter: 'blur(12px)',
            borderRadius: '14px',
            padding: '12px 18px',
            border: `1px solid rgba(197, 169, 137, 0.2)`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: COLORS.beige, fontWeight: 700, letterSpacing: '1px' }}>
                Junta Local Ejecutiva
              </span>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: COLORS.blanco }}>
                {selectedState}
              </h2>
            </div>
            <div style={{
              background: 'rgba(230, 0, 115, 0.15)',
              border: `1px solid ${COLORS.rosaFuerte}`,
              color: COLORS.rosaFuerte,
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <Award size={14} /> 2 Fichas Oficiales
            </div>
          </div>

          {/* =======================================================================
              TARJETA 1: Vocal Ejecutivo de la Junta Estatal Local
             ======================================================================= */}
          <CredentialCard
            roleKey="vocalEjecutivo"
            title="Vocal Ejecutivo(a)"
            subtitle="Junta Local Ejecutiva"
            data={editingCard === 'vocalEjecutivo' ? editFormData : currentVocales.vocalEjecutivo}
            isEditing={editingCard === 'vocalEjecutivo'}
            badgeColor={COLORS.rosaFuerte}
            avatarInitials="VE"
            onStartEdit={() => handleStartEdit('vocalEjecutivo')}
            onSaveEdit={() => handleSaveEdit('vocalEjecutivo')}
            onCancelEdit={handleCancelEdit}
            onChangeField={(field, val) => setEditFormData(prev => ({ ...prev, [field]: val }))}
          />

          {/* =======================================================================
              TARJETA 2: Vocal de Capacitación Electoral y Educación Cívica
             ======================================================================= */}
          <CredentialCard
            roleKey="vocalCapacitacion"
            title="Vocal de Capacitación"
            subtitle="Educación Cívica y Capacitación Electoral"
            data={editingCard === 'vocalCapacitacion' ? editFormData : currentVocales.vocalCapacitacion}
            isEditing={editingCard === 'vocalCapacitacion'}
            badgeColor={COLORS.beige}
            avatarInitials="VC"
            onStartEdit={() => handleStartEdit('vocalCapacitacion')}
            onSaveEdit={() => handleSaveEdit('vocalCapacitacion')}
            onCancelEdit={handleCancelEdit}
            onChangeField={(field, val) => setEditFormData(prev => ({ ...prev, [field]: val }))}
          />
        </section>
      </div>
    </div>
  );
}

// ===========================================================================
// Componente de Tarjeta / Ficha Tipo Videojuego (Dual Credential Card)
// ===========================================================================
function CredentialCard({
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
      background: 'rgba(28, 27, 30, 0.85)',
      backdropFilter: 'blur(16px)',
      borderRadius: '16px',
      border: isEditing
        ? `2px solid ${COLORS.rosaFuerte}`
        : `1px solid rgba(197, 169, 137, 0.25)`,
      boxShadow: isEditing
        ? `0 0 25px rgba(230, 0, 115, 0.35)`
        : `0 10px 25px rgba(0,0,0,0.35)`,
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.25s ease'
    }}>
      {/* Detalle visual decorativo estilo credencial SPEN / Cyberpunk */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 120,
        height: 120,
        background: `radial-gradient(circle, ${badgeColor}22 0%, transparent 70%)`,
        pointerEvents: 'none'
      }} />

      {/* Franja superior de estatus y acciones */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {/* Avatar / Foto estilo Gamer / Ficha */}
          <div style={{
            width: 54,
            height: 54,
            borderRadius: '14px',
            background: `linear-gradient(135deg, ${COLORS.grisOxford}, #1e1d20)`,
            border: `2px solid ${badgeColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.15rem',
            color: COLORS.blanco,
            boxShadow: `0 4px 12px ${badgeColor}33`,
            position: 'relative'
          }}>
            {avatarInitials}
            <div style={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#22c55e',
              border: '2px solid #1c1b1e'
            }} />
          </div>

          <div>
            <div style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              color: badgeColor,
              letterSpacing: '1px'
            }}>
              {subtitle}
            </div>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: COLORS.blanco
            }}>
              {title}
            </div>
          </div>
        </div>

        {/* Botón de Editar / Guardar In-Situ */}
        <div>
          {isEditing ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={onSaveEdit}
                style={{
                  background: COLORS.rosaFuerte,
                  border: 'none',
                  color: COLORS.blanco,
                  padding: '6px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: '0 4px 12px rgba(230, 0, 115, 0.4)'
                }}
              >
                <Check size={14} /> Guardar
              </button>
              <button
                onClick={onCancelEdit}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: `1px solid ${COLORS.grisMedio}`,
                  color: COLORS.blanco,
                  padding: '6px 10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={onStartEdit}
              title="Editar datos in-situ"
              style={{
                background: 'rgba(197, 169, 137, 0.12)',
                border: `1px solid rgba(197, 169, 137, 0.35)`,
                color: COLORS.beige,
                padding: '6px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.2s'
              }}
            >
              <Edit3 size={13} /> Editar Ficha
            </button>
          )}
        </div>
      </div>

      {/* Contenido de Campos de la Ficha */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Campo 1: Nombre de la persona */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '10px',
          padding: '10px 14px',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div style={{
            fontSize: '0.7rem',
            color: COLORS.gris,
            textTransform: 'uppercase',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 4
          }}>
            <User size={13} color={COLORS.rosaFuerte} />
            Nombre del Funcionario(a):
          </div>
          {isEditing ? (
            <input
              type="text"
              value={data.nombre || ''}
              onChange={(e) => onChangeField('nombre', e.target.value)}
              placeholder="Ingresa el nombre completo"
              style={{
                width: '100%',
                background: '#121113',
                border: `1px solid ${COLORS.rosaFuerte}`,
                borderRadius: '6px',
                color: COLORS.blanco,
                padding: '6px 10px',
                fontSize: '0.92rem',
                fontWeight: 600,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          ) : (
            <div style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: COLORS.blanco,
              letterSpacing: '0.2px'
            }}>
              {data.nombre || 'No asignado'}
            </div>
          )}
        </div>

        {/* Campos 2 y 3: Antigüedades en Grid Dual */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12
        }}>
          {/* Antigüedad en el Cargo */}
          <div style={{
            background: 'rgba(0,0,0,0.25)',
            borderRadius: '10px',
            padding: '10px 14px',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <div style={{
              fontSize: '0.68rem',
              color: COLORS.gris,
              textTransform: 'uppercase',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              marginBottom: 4
            }}>
              <Clock size={12} color={COLORS.beige} />
              Antigüedad en el Cargo:
            </div>
            {isEditing ? (
              <input
                type="text"
                value={data.antiguedadCargo || ''}
                onChange={(e) => onChangeField('antiguedadCargo', e.target.value)}
                placeholder="Ej. 3 años, 4 meses"
                style={{
                  width: '100%',
                  background: '#121113',
                  border: `1px solid ${COLORS.beige}`,
                  borderRadius: '6px',
                  color: COLORS.blanco,
                  padding: '5px 8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            ) : (
              <div style={{
                fontSize: '0.92rem',
                fontWeight: 700,
                color: COLORS.beige
              }}>
                {data.antiguedadCargo || 'Sin registro'}
              </div>
            )}
          </div>

          {/* Antigüedad en el INE */}
          <div style={{
            background: 'rgba(0,0,0,0.25)',
            borderRadius: '10px',
            padding: '10px 14px',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <div style={{
              fontSize: '0.68rem',
              color: COLORS.gris,
              textTransform: 'uppercase',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              marginBottom: 4
            }}>
              <Award size={12} color={COLORS.rosaFuerte} />
              Antigüedad en el INE:
            </div>
            {isEditing ? (
              <input
                type="text"
                value={data.antiguedadIne || ''}
                onChange={(e) => onChangeField('antiguedadIne', e.target.value)}
                placeholder="Ej. 12 años"
                style={{
                  width: '100%',
                  background: '#121113',
                  border: `1px solid ${COLORS.rosaFuerte}`,
                  borderRadius: '6px',
                  color: COLORS.blanco,
                  padding: '5px 8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            ) : (
              <div style={{
                fontSize: '0.92rem',
                fontWeight: 700,
                color: COLORS.rosaFuerte
              }}>
                {data.antiguedadIne || 'Sin registro'}
              </div>
            )}
          </div>
        </div>

        {/* Footer de Ficha: Estatus y Folio del Funcionario */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 8,
          borderTop: '1px solid rgba(255,255,255,0.07)',
          fontSize: '0.72rem',
          color: COLORS.grisMedio
        }}>
          <span>Folio: <b style={{ color: COLORS.grisClaro }}>{data.folio || 'SPEN-ACTIVO'}</b></span>
          <span style={{
            background: 'rgba(34, 197, 94, 0.12)',
            color: '#4ade80',
            padding: '2px 8px',
            borderRadius: '4px',
            fontWeight: 700
          }}>
            ● {data.estatus || 'Activo SPEN'}
          </span>
        </div>
      </div>
    </div>
  );
}
