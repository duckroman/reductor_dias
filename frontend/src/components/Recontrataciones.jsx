import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Users,
  PhoneCall,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Building2,
  Layers,
  FileSpreadsheet,
  MessageSquare
} from 'lucide-react';
import mexicoGeoData from '../data/mexico_geo.json';
import { getRecontratacionesEstado } from '../services/api';

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
  const [loadingDataset, setLoadingDataset] = useState(false);

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

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const normalize = (str) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  // Cargar dataset del estado
  useEffect(() => {
    if (!selectedState) {
      setStateDataset(null);
      return;
    }

    setLoadingDataset(true);
    getRecontratacionesEstado(selectedState)
      .then(res => {
        setStateDataset(res);
      })
      .catch(err => {
        console.warn('Error fetching dataset for state:', selectedState, err);
        setStateDataset(null);
      })
      .finally(() => {
        setLoadingDataset(false);
      });
  }, [selectedState]);

  // Selección al hacer clic en el mapa
  const handleMapClick = (stateName) => {
    setSelectedState(stateName);
    setCardTab('resumen_jle');
    setSelectedDistritoItem(null);
    setEditingCard(null);
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

  const zValues = useMemo(() => {
    return locations.map(name => {
      if (!selectedState) return 20;
      return normalize(name) === normalize(selectedState) ? 100 : 35;
    });
  }, [locations, selectedState]);

  // Datos JLE del dataset
  const jleData = stateDataset?.totales;

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
        height: '56px',
        background: COLORS.blanco,
        borderBottom: `1px solid ${COLORS.bordeSuave}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
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
            PE Concurrente
          </span>
        </div>

        {selectedState && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.85rem', color: COLORS.grisMedio }}>
              Estado: <b style={{ color: COLORS.grisOxford }}>{selectedState}</b>
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
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cerrar tarjeta
            </button>
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
        height: 'calc(100vh - 56px)',
        overflow: 'hidden'
      }}>
        <label style={{
          position: 'absolute',
          top: 16,
          left: 20,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '10px 12px',
          background: 'rgba(255,255,255,0.96)',
          border: `1px solid ${COLORS.bordeSuave}`,
          borderRadius: '10px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
          color: COLORS.grisOxford,
          fontSize: '0.78rem',
          fontWeight: 700
        }}>
          <Building2 size={16} color={COLORS.beige} />
          <span>Elegir estado</span>
          <select
            aria-label="Elegir estado"
            value={selectedState ?? ''}
            onChange={(event) => {
              if (event.target.value) handleMapClick(event.target.value);
            }}
            style={{
              maxWidth: 'min(48vw, 220px)',
              padding: '7px 28px 7px 9px',
              border: `1px solid ${COLORS.bordeSuave}`,
              borderRadius: '7px',
              background: COLORS.blanco,
              color: COLORS.grisOxford,
              font: 'inherit',
              cursor: 'pointer'
            }}
          >
            <option value="">Selecciona...</option>
            {[...ENTIDADES_CATALOGO]
              .sort((a, b) => a.name.localeCompare(b.name, 'es'))
              .map(({ name }) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <Plot
          data={[{
            type: 'choropleth',
            geojson: mexicoGeoData,
            locations: locations,
            z: zValues,
            featureidkey: 'properties.name',
            colorscale: [
              [0, '#EAECEF'],
              [0.35, '#DEE2E6'],
              [0.7, COLORS.beige],
              [1, COLORS.grisOxford]
            ],
            zmin: 0,
            zmax: 100,
            showscale: false,
            marker: {
              line: {
                color: locations.map(n =>
                  normalize(n) === normalize(selectedState)
                    ? COLORS.grisOxford
                    : '#CBD0D5'
                ),
                width: locations.map(n =>
                  normalize(n) === normalize(selectedState) ? 2.5 : 0.8
                )
              }
            },
            hoverinfo: 'text',
            text: locations.map(name => {
              return `<b>${name.toUpperCase()}</b><br>👉 Clic para desplegar información del dataset y vocales`;
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
            margin: { t: 0, r: 0, b: 0, l: 0 },
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

        {/* Indicador de ayuda al inicio */}
        {!selectedState && (
          <div style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            padding: '12px 24px',
            borderRadius: '30px',
            border: `1px solid ${COLORS.bordeSuave}`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '0.88rem',
            fontWeight: 600,
            color: COLORS.grisOxford,
            pointerEvents: 'none',
            zIndex: 10
          }}>
            <Building2 size={18} color={COLORS.beige} />
            Haz clic sobre cualquier estado para desplegar su tarjeta informativa
          </div>
        )}

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
          }}>
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
                  Estado Seleccionado
                </span>
                <h2 style={{ margin: '2px 0 0', fontSize: '1.35rem', fontWeight: 800, color: COLORS.grisOxford }}>
                  {selectedState}
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
                    title="Vocal de Capacitación"
                    subtitle="Educación Cívica y Capacitación"
                    data={editingCard === 'vocalCapacitacion' ? editFormData : currentVocales.vocalCapacitacion}
                    isEditing={editingCard === 'vocalCapacitacion'}
                    badgeColor={COLORS.beige}
                    avatarInitials="VC"
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
                /* Estado sin dataset */
                <div style={{
                  padding: '30px 20px',
                  textAlign: 'center',
                  background: COLORS.fondoClaro,
                  borderRadius: '14px',
                  border: `1px dashed ${COLORS.bordeSuave}`
                }}>
                  <FileSpreadsheet size={36} color={COLORS.beige} style={{ margin: '0 auto 10px' }} />
                  <h4 style={{ margin: '0 0 6px', color: COLORS.grisOxford }}>Dataset no disponible</h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: COLORS.grisMedio, lineHeight: 1.4 }}>
                    Aún no se ha cargado el archivo Excel correspondiente a <b>{selectedState}</b> en la carpeta <code>datasets/</code>.
                  </p>
                  <button
                    onClick={() => setCardTab('vocales')}
                    style={{
                      marginTop: '16px',
                      background: COLORS.grisOxford,
                      color: COLORS.blanco,
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <User size={14} color={COLORS.beige} /> Consultar o Editar Vocales
                  </button>
                </div>
              ) : cardTab === 'resumen_jle' ? (
                /* =============================================================
                   PESTAÑA: DATOS JLE DEL DATASET
                   ============================================================= */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{
                    fontSize: '0.78rem',
                    color: COLORS.grisMedio,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>Fila: <b style={{ color: COLORS.grisOxford }}>JLE</b></span>
                    <span>Archivo: <b>{stateDataset?.archivo ?? '—'}</b></span>
                  </div>

                  <ContactDistributionChart
                    total={jleData?.total_contactar}
                    notLocated={jleData?.contactados_no_localizados}
                    contacted={jleData?.comunicacion_establecida}
                    accepted={jleData?.aceptaron_recontratacion}
                    pending={jleData?.pendiente_contactar}
                  />

                  {/* Variables en Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px'
                  }}>
                    {/* Total a contactar (A) */}
                    <DatasetFieldCard
                      title="Total de ciudadanos/as a contactar (A)"
                      value={jleData?.total_contactar ?? 0}
                      icon={<Users size={16} color={COLORS.grisOxford} />}
                      borderColor={COLORS.grisOxford}
                    />

                    {/* Contactados no localizados (B) */}
                    <DatasetFieldCard
                      title="Ciudadanos/as contactados, pero no localizados (B)"
                      value={jleData?.contactados_no_localizados ?? 0}
                      icon={<PhoneCall size={16} color={COLORS.grisMedio} />}
                      borderColor={COLORS.grisMedio}
                    />

                    {/* Comunicación establecida (C) */}
                    <DatasetFieldCard
                      title="Ciudadanos/as con comunicación establecida (C)"
                      value={jleData?.comunicacion_establecida ?? 0}
                      icon={<UserCheck size={16} color={COLORS.beige} />}
                      borderColor={COLORS.beige}
                      highlight
                    />

                    {/* Pendiente por contactar (A-B-C) */}
                    <DatasetFieldCard
                      title="Ciudadanía pendiente por contactar (A-B-C)"
                      value={jleData?.pendiente_contactar ?? 0}
                      icon={<AlertCircle size={16} color={COLORS.grisOxford} />}
                      borderColor={COLORS.grisOxford}
                    />
                  </div>

                  {/* Aceptaron la recontratación */}
                  <div style={{
                    background: 'linear-gradient(135deg, #FAF8F5, #FFFFFF)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    border: `1.5px solid ${COLORS.beige}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: COLORS.beige }}>
                        Ciudadanos/as que aceptaron la recontratación
                      </div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: COLORS.grisOxford, marginTop: 2 }}>
                        {jleData?.aceptaron_recontratacion ?? 0}
                      </div>
                    </div>
                    <CheckCircle2 size={32} color={COLORS.beige} />
                  </div>

                  {/* ¿La JLE ya invitó a las RPP? */}
                  <div style={{
                    background: COLORS.fondoClaro,
                    borderRadius: '12px',
                    padding: '12px 14px',
                    border: `1px solid ${COLORS.bordeSuave}`
                  }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: COLORS.grisMedio, textTransform: 'uppercase' }}>
                      ¿La JLE ya invitó a las Representaciones de Partidos Políticos a las entrevistas de recontratación?
                    </span>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: COLORS.grisOxford, marginTop: 4 }}>
                      {jleData?.invito_rpp || 'Sin respuesta'}
                    </div>
                  </div>

                  {/* Observaciones (en su caso) */}
                  <div style={{
                    background: COLORS.fondoClaro,
                    borderRadius: '12px',
                    padding: '12px 14px',
                    border: `1px solid ${COLORS.bordeSuave}`
                  }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: COLORS.grisMedio, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MessageSquare size={13} /> Observaciones (en su caso)
                    </span>
                    <div style={{ fontSize: '0.85rem', color: COLORS.grisOxford, marginTop: 4 }}>
                      {jleData?.observaciones ? jleData.observaciones : 'Sin observaciones registradas.'}
                    </div>
                  </div>

                  {/* Botones de acción rápida dentro de la tarjeta */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button
                      onClick={() => setCardTab('distritos')}
                      style={{
                        flex: 1,
                        background: COLORS.grisOxford,
                        color: COLORS.blanco,
                        border: 'none',
                        padding: '10px',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                    >
                      <Layers size={15} /> Mostrar Distritos ({stateDataset?.distritos?.length ?? 0})
                    </button>

                    <button
                      onClick={() => setCardTab('vocales')}
                      style={{
                        flex: 1,
                        background: COLORS.fondoClaro,
                        color: COLORS.grisOxford,
                        border: `1px solid ${COLORS.bordeSuave}`,
                        padding: '10px',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                    >
                      <User size={15} color={COLORS.beige} /> Figuras Vocales
                    </button>
                  </div>
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
                          Distrito Federal {selectedDistritoItem.distrito}
                        </span>
                        <h3 style={{ margin: '2px 0 0', fontSize: '1.15rem', color: COLORS.grisOxford }}>
                          Cabecera: {selectedDistritoItem.cabecera}
                        </h3>
                      </div>

                      <ContactDistributionChart
                        total={selectedDistritoItem.total_contactar}
                        notLocated={selectedDistritoItem.contactados_no_localizados}
                        contacted={selectedDistritoItem.comunicacion_establecida}
                        accepted={selectedDistritoItem.aceptaron_recontratacion}
                        pending={selectedDistritoItem.pendiente_contactar}
                      />

                      {/* Variables con la misma nomenclatura y campos */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '10px'
                      }}>
                        <DatasetFieldCard
                          title="Total a contactar (A)"
                          value={selectedDistritoItem.total_contactar}
                          icon={<Users size={16} color={COLORS.grisOxford} />}
                          borderColor={COLORS.grisOxford}
                        />

                        <DatasetFieldCard
                          title="No localizados (B)"
                          value={selectedDistritoItem.contactados_no_localizados}
                          icon={<PhoneCall size={16} color={COLORS.grisMedio} />}
                          borderColor={COLORS.grisMedio}
                        />

                        <DatasetFieldCard
                          title="Comunicación establecida (C)"
                          value={selectedDistritoItem.comunicacion_establecida}
                          icon={<UserCheck size={16} color={COLORS.beige} />}
                          borderColor={COLORS.beige}
                          highlight
                        />

                        <DatasetFieldCard
                          title="Pendiente por contactar"
                          value={selectedDistritoItem.pendiente_contactar}
                          icon={<AlertCircle size={16} color={COLORS.grisOxford} />}
                          borderColor={COLORS.grisOxford}
                        />
                      </div>

                      <div style={{
                        background: 'linear-gradient(135deg, #FAF8F5, #FFFFFF)',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        border: `1.5px solid ${COLORS.beige}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: COLORS.beige }}>
                            Aceptaron la recontratación
                          </div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: COLORS.grisOxford, marginTop: 2 }}>
                            {selectedDistritoItem.aceptaron_recontratacion}
                          </div>
                        </div>
                        <CheckCircle2 size={30} color={COLORS.beige} />
                      </div>

                      <div style={{
                        background: COLORS.fondoClaro,
                        borderRadius: '12px',
                        padding: '12px 14px',
                        border: `1px solid ${COLORS.bordeSuave}`
                      }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: COLORS.grisMedio, textTransform: 'uppercase' }}>
                          Observaciones
                        </span>
                        <div style={{ fontSize: '0.85rem', color: COLORS.grisOxford, marginTop: 4 }}>
                          {selectedDistritoItem.observaciones ? selectedDistritoItem.observaciones : 'Sin observaciones en este distrito.'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Lista de distritos */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <span style={{ fontSize: '0.8rem', color: COLORS.grisMedio }}>
                        Selecciona un distrito para consultar sus datos correspondientes:
                      </span>

                      {(stateDataset?.distritos ?? []).map((dist) => (
                        <div
                          key={dist.distrito}
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
                              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: COLORS.grisOxford }}>
                                {dist.cabecera}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: COLORS.grisMedio, marginTop: 4 }}>
                              A contactar: <b>{dist.total_contactar}</b> • Aceptaron: <b style={{ color: COLORS.beige }}>{dist.aceptaron_recontratacion}</b>
                            </div>
                          </div>
                          <ChevronRight size={18} color={COLORS.grisMedio} />
                        </div>
                      ))}
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

function ContactDistributionChart({ total, notLocated, contacted, accepted, pending }) {
  const toCount = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const totalValue = Number.isFinite(Number(total)) ? Number(total) : 0;
  const contactedValue = toCount(contacted);
  const acceptedValue = Math.min(toCount(accepted), contactedValue);
  const segments = [
    { label: 'No localizados (B)', value: toCount(notLocated), color: COLORS.grisMedio },
    {
      label: 'Comunicación establecida, sin aceptación',
      value: contactedValue - acceptedValue,
      color: COLORS.beige,
    },
    { label: 'Aceptaron la recontratación', value: acceptedValue, color: '#6F8F72' },
    { label: 'Pendientes por contactar', value: toCount(pending), color: COLORS.grisOxford },
  ];

  return (
    <section
      aria-label="Distribución de ciudadanos por situación de contacto"
      style={{
        background: COLORS.blanco,
        border: `1px solid ${COLORS.bordeSuave}`,
        borderRadius: '12px',
        padding: '14px 12px 8px',
      }}
    >
      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: COLORS.grisOxford, textTransform: 'uppercase', textAlign: 'center' }}>
        Desglose de ciudadanos/as a contactar
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 220 }}>
        <div style={{ flex: '0 0 48%', minWidth: 0, height: 220 }}>
          {segments.some(segment => segment.value > 0) ? (
            <Plot
              data={[{
                type: 'pie',
                labels: segments.map(segment => segment.label),
                values: segments.map(segment => segment.value),
                textinfo: 'none',
                marker: {
                  colors: segments.map(segment => segment.color),
                  line: { color: COLORS.blanco, width: 2 },
                },
                hovertemplate: '%{label}<br>%{value:,} ciudadanos/as (%{percent})<extra></extra>',
                sort: false,
              }]}
              layout={{
                height: 220,
                margin: { t: 4, r: 4, b: 4, l: 4 },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                showlegend: false,
              }}
              config={{ displayModeBar: false, responsive: true }}
              useResizeHandler
              style={{ width: '100%', height: 220 }}
            />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.grisMedio, fontSize: '0.78rem', textAlign: 'center' }}>
              Sin cantidades para mostrar.
            </div>
          )}
        </div>
        <div aria-label="Referencia de colores y porcentajes" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {segments.map(segment => {
            const percentage = totalValue > 0 ? (segment.value / totalValue) * 100 : 0;
            return (
              <div key={segment.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: '0.7rem', lineHeight: 1.3 }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, flex: '0 0 10px', marginTop: 2, borderRadius: '50%', background: segment.color }} />
                <span style={{ flex: 1, color: COLORS.grisOxford }}>
                  {segment.label}
                  <br />
                  <b>{segment.value.toLocaleString('es-MX')}</b>
                  <span style={{ color: COLORS.grisMedio }}> · {percentage.toFixed(1)}%</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{
        textAlign: 'center',
        fontSize: '0.72rem',
        color: COLORS.grisMedio,
        padding: '0 8px 4px',
      }}>
        Total a contactar: <b style={{ color: COLORS.grisOxford }}>{totalValue.toLocaleString('es-MX')}</b>
        {' · '}Las aceptaciones se separan de comunicación establecida.
      </div>
    </section>
  );
}

// ===========================================================================
// Tarjetas de Campo de Dataset
// ===========================================================================
function DatasetFieldCard({ title, value, icon, borderColor, highlight }) {
  return (
    <div style={{
      background: highlight ? 'linear-gradient(135deg, #FAF8F5, #FFFFFF)' : COLORS.fondoClaro,
      borderRadius: '10px',
      padding: '12px 14px',
      border: `1px solid ${highlight ? COLORS.beige : COLORS.bordeSuave}`,
      borderLeft: `3px solid ${borderColor}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: COLORS.grisMedio, textTransform: 'uppercase', lineHeight: 1.2 }}>
          {title}
        </span>
        {icon}
      </div>
      <div style={{
        fontSize: '1.4rem',
        fontWeight: 800,
        color: highlight ? COLORS.beige : COLORS.grisOxford,
        marginTop: 4
      }}>
        {value}
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
