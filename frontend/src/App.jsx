import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Statistical from './components/Statistical';
import Clustering from './components/Clustering';
import Reductor from './components/Reductor';
import MexicoMap from './components/MexicoMap';
import SustitucionesPage from './components/SustitucionesPage';
import DatasetViewer from './components/DatasetViewer';
import Presentation from './components/Presentation';
import { getSheets, uploadDataFile, getActiveFile, getDatasets, selectDataset, clearCache } from './services/api';
import { Menu, X } from 'lucide-react';
import './App.css';

const SHEET_ICONS = {
  'Global': '🌍',
  'Nombramientos': '📋',
  'Capacitación': '📚',
  'Asistencia a Simulacros': '🎯',
  'Sustituciones de FMDC': '🔄',
  'Visitados': '🚶',
  'CCRL Optimo': '📈',
  'CCRL Requeridos': '📉'
};

const SHEET_LABELS = {
  'CCRL Optimo': 'Óptimo de Ciudadanos requeridos por Ley',
  'CCRL Requeridos': 'Mínimo de Ciudadanos requeridos por Ley'
};

// Etiquetas amigables para los datasets
const DATASET_LABELS = {
  'PE_2020-2021_1a.xlsx': { name: 'Proceso Electoral 2020-2021', period: '1ª Etapa', icon: '📊' },
  'PEC_2023-2024_1a.xlsx': { name: 'PEC 2023-2024', period: '1ª Etapa', icon: '📈' },
  'PE_2020-2021_2a.xlsx': { name: 'Proceso Electoral 2020-2021', period: '2ª Etapa', icon: '📊' },
  'PEC_2023-2024_2a.xlsx': { name: 'PEC 2023-2024', period: '2ª Etapa', icon: '📈' },
  'PEL_2022-2023_Coahuila.xlsx': { name: 'PEL 2022-2023 Coahuila', period: 'Local', icon: '🗺️' },
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSheet, setActiveSheet] = useState('Global');
  const [availableSheets, setAvailableSheets] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [activeFile, setActiveFile] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [datasetsForStage, setDatasetsForStage] = useState([]);
  const [loadingDataset, setLoadingDataset] = useState(false);
  const [datasetMeta, setDatasetMeta] = useState(null); // { n_days, n_districts }
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Cuando se selecciona una etapa, cargar la lista de datasets disponibles
  useEffect(() => {
    if (!selectedStage) return;
    const loadDatasets = async () => {
      try {
        // Limpiar caché del backend al cambiar de etapa
        await clearCache();
        const result = await getDatasets(selectedStage);
        const datasets = result.datasets[String(selectedStage)] || [];
        setDatasetsForStage(datasets);
      } catch (e) {
        console.error('Error loading datasets:', e);
        setDatasetsForStage([]);
      }
    };
    loadDatasets();
  }, [selectedStage]);

  // Seleccionar un dataset
  const handleSelectDataset = async (filename) => {
    setLoadingDataset(true);
    try {
      const res = await selectDataset(filename, selectedStage);
      setSelectedDataset(filename);
      setActiveFile(res.filename);
      setAvailableSheets(res.sheets || []);
      setDatasetMeta({ n_days: res.n_days, n_districts: res.n_districts });
      if (res.sheets && res.sheets.length > 0) {
        setActiveSheet(res.sheets[0]);
      }
      setDataVersion(v => v + 1);
      setActiveTab('dashboard');
    } catch (e) {
      console.error('Error selecting dataset:', e);
      alert('Error al cargar el dataset. Verifique que el archivo existe.');
    } finally {
      setLoadingDataset(false);
    }
  };

  // Cambiar de etapa: limpiar todo
  const handleChangeStage = async () => {
    try { await clearCache(); } catch (e) { /* ignore */ }
    setSelectedStage(null);
    setSelectedDataset(null);
    setAvailableSheets([]);
    setActiveFile(null);
    setDatasetMeta(null);
    setSelectedState(null);
    setActiveTab('dashboard');
    setActiveSheet('Global');
    setDatasetsForStage([]);
  };

  // Cambiar de dataset (dentro de la misma etapa)
  const handleChangeDataset = async () => {
    try { await clearCache(); } catch (e) { /* ignore */ }
    setSelectedDataset(null);
    setAvailableSheets([]);
    setActiveFile(null);
    setDatasetMeta(null);
    setSelectedState(null);
    setActiveTab('dashboard');
    setActiveSheet('Global');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadDataFile(file, selectedStage);
      setDataVersion(v => v + 1);
      setAvailableSheets(res.sheets || []);
      if (res.sheets && res.sheets.length > 0) {
        setActiveSheet(res.sheets[0]);
      }
      setActiveFile(res.filename);
      setSelectedDataset(res.filename);
      alert('Datos cargados y procesados exitosamente.');
    } catch (error) {
      console.error('Error uploading file', error);
      if (error.response && error.response.status === 400) {
        const detail = error.response.data.details || '';
        alert(`⚠️ Error de Validación:\n${error.response.data.error}\n\n${detail}`);
      } else {
        alert('Error al cargar el archivo. Verifica el formato del Excel.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleStateClick = (stateName) => {
    setSelectedState(prev => prev === stateName ? null : stateName);
  };

  const hasData = availableSheets && availableSheets.length > 0;

  // Si la ruta es /sustituciones, mostramos la página especial
  if (currentPath === '/sustituciones') {
    return <SustitucionesPage />;
  }

  // ============================================
  // PANTALLA 1: Selección de Etapa
  // ============================================
  if (!selectedStage) {
    return (
      <div className="stage-selection-container">
        <div className="stage-selection-card">
          <div className="logo-icon big">INE</div>
          <h1>Plataforma de Análisis de Cumplimiento</h1>
          <p className="description">Seleccione la etapa operativa que desea analizar para iniciar el procesamiento de datos.</p>

          <div className="stage-options">
            <button className="stage-option-btn" onClick={() => setSelectedStage(1)}>
              <div className="btn-icon">1️⃣</div>
              <div className="btn-content">
                <h3>Etapa 1: Visitas y Notificaciones</h3>
                <p>Análisis de Visitas, Notificaciones y Ciudadanos CR.</p>
              </div>
            </button>

            <button className="stage-option-btn" onClick={() => setSelectedStage(2)}>
              <div className="btn-icon">2️⃣</div>
              <div className="btn-content">
                <h3>Etapa 2: Nombramientos y Capacitación</h3>
                <p>Análisis de Nombramientos, Capacitación y Simulacros.</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // PANTALLA 2: Selección de Dataset
  // ============================================
  if (!selectedDataset) {
    return (
      <div className="stage-selection-container">
        <div className="stage-selection-card" style={{ maxWidth: '900px' }}>
          <div className="logo-icon big">INE</div>
          <h1>Etapa {selectedStage}: {selectedStage === 1 ? 'Visitas y Notificaciones' : 'Nombramientos y Capacitación'}</h1>
          <p className="description">Seleccione el dataset que desea analizar. Solo se mostrarán los datos del dataset seleccionado.</p>

          {loadingDataset ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              Cargando dataset...
            </div>
          ) : (
            <>
              <div className="dataset-grid">
                {datasetsForStage.map((ds, idx) => {
                  const label = DATASET_LABELS[ds.filename] || { name: ds.filename, period: '', icon: '📄' };
                  return (
                    <button
                      key={ds.filename}
                      className="dataset-card"
                      onClick={() => handleSelectDataset(ds.filename)}
                      disabled={!ds.exists}
                      style={{ animationDelay: `${idx * 0.1}s` }}
                    >
                      <div className="dataset-card-icon">{label.icon}</div>
                      <div className="dataset-card-content">
                        <h3>{label.name}</h3>
                        <span className="dataset-card-period">{label.period}</span>
                        <span className="dataset-card-file">{ds.filename}</span>
                        <span className="dataset-card-size">{ds.size_mb} MB</span>
                      </div>
                      {!ds.exists && <span className="dataset-card-missing">No disponible</span>}
                    </button>
                  );
                })}
              </div>

              <div className="dataset-actions">
                <button className="sidebar-btn secondary" onClick={handleChangeStage} style={{ maxWidth: '300px', margin: '0 auto' }}>
                  ← Regresar a Selección de Etapa
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ============================================
  // PANTALLA 3: Dashboard principal
  // ============================================
  return (
    <div className="app-layout">
      {/* Backdrop overlay for mobile menu */}
      {mobileMenuOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar */}
      <aside className={`app-sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-icon">INE</div>
          <h2>Reductor de Días</h2>
        </div>
        <div className="sidebar-metadata">
          <span className="sidebar-subtitle">Etapa {selectedStage}: {selectedStage === 1 ? 'Visitas' : 'FMDC'}</span>
          {activeFile && (
            <div className="active-file-indicator">
              <div className="active-file-label">Dataset Activo</div>
              <span title={activeFile}>{activeFile}</span>
              {datasetMeta && (
                <div className="dataset-meta-info">
                  <span>📅 {datasetMeta.n_days} días</span>
                  <span>🏛️ {datasetMeta.n_districts} distritos</span>
                </div>
              )}
            </div>
          )}
        </div>

        {hasData && (
          <div className="sidebar-section">
            <h3 className="sidebar-section-title">Rubros</h3>
            {availableSheets.map(sheet => (
              <button
                key={sheet}
                className={`sidebar-btn ${activeSheet === sheet && activeTab !== 'viewer' ? 'active' : ''}`}
                onClick={() => { 
                  setActiveSheet(sheet); 
                  setActiveTab('dashboard'); 
                  setMobileMenuOpen(false);
                }}
              >
                <span className="sidebar-icon">{SHEET_ICONS[sheet] || '📄'}</span>
                <span className="sidebar-label" style={{ fontSize: '0.8rem', lineHeight: '1.2' }}>
                  {SHEET_LABELS[sheet] || sheet}
                </span>
              </button>
            ))}
          </div>
        )}

        {hasData && (
          <div className="sidebar-section">
            <h3 className="sidebar-section-title">Datos</h3>
            <button
              className={`sidebar-btn viewer-btn ${activeTab === 'viewer' ? 'active' : ''}`}
              onClick={() => { 
                setActiveTab('viewer'); 
                setMobileMenuOpen(false);
              }}
            >
              <span className="sidebar-icon">📋</span>
              <span className="sidebar-label">Ver Dataset</span>
            </button>
            <button
              className={`sidebar-btn ${activeTab === 'presentation' ? 'active' : ''}`}
              onClick={() => { 
                setActiveTab('presentation'); 
                setMobileMenuOpen(false);
              }}
              style={{
                background: activeTab === 'presentation' ? 'var(--accent-color)' : 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(99, 102, 241, 0.15))',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                marginTop: '8px'
              }}
            >
              <span className="sidebar-icon">📽️</span>
              <span className="sidebar-label" style={{ fontWeight: '600', color: activeTab === 'presentation' ? '#fff' : '#c084fc' }}>Presentación Ejecutiva</span>
            </button>
          </div>
        )}

        <div className="sidebar-section">
          <h3 className="sidebar-section-title">Opciones</h3>
          <label className="upload-sidebar-btn mb-15">
            {uploading ? '⏳ Procesando...' : '📂 Cargar Excel'}
            <input
              type="file"
              accept=".xlsx, .xls"
              style={{ display: 'none' }}
              onChange={(e) => {
                handleFileUpload(e);
                setMobileMenuOpen(false);
              }}
              disabled={uploading}
            />
          </label>
          <button className="sidebar-btn secondary" onClick={() => { handleChangeDataset(); setMobileMenuOpen(false); }}>
            📁 Cambiar Dataset
          </button>
          <button className="sidebar-btn secondary" onClick={() => { handleChangeStage(); setMobileMenuOpen(false); }}>
            🔄 Cambiar Etapa
          </button>
        </div>

        {selectedState && (
          <div className="sidebar-section state-filter">
            <h3 className="sidebar-section-title">Filtro Activo</h3>
            <div className="state-badge">
              <span>🏛️ {selectedState}</span>
              <button className="clear-filter-btn" onClick={() => { setSelectedState(null); setMobileMenuOpen(false); }}>✕</button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="app-content">
        {/* Mobile top navigation bar */}
        <header className="mobile-header">
          <button className="menu-toggle-btn" onClick={() => setMobileMenuOpen(prev => !prev)} title="Abrir Menú">
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="mobile-header-title">
            <span className="logo-icon small">INE</span>
            <span>Reductor de Días</span>
          </div>
          <div style={{ width: 22 }}></div>
        </header>

        {/* Dataset Viewer Tab */}
        {activeTab === 'viewer' ? (
          <main className="app-main">
            <DatasetViewer
              key={`viewer-${dataVersion}-${activeSheet}`}
              sheet={activeSheet === 'Global' ? null : activeSheet}
              state={selectedState}
            />
          </main>
        ) : (
          <>
            {/* Mapa visible excepto en presentación */}
            {activeTab !== 'presentation' && (
              <div className="map-panel">
                <MexicoMap
                  key={`map-${dataVersion}-${activeSheet}`}
                  sheet={hasData ? activeSheet : null}
                  selectedState={selectedState}
                  onStateClick={handleStateClick}
                  dataVersion={dataVersion}
                />
                {!hasData && (
                  <div className="map-overlay-message">
                    <p>Esperando carga de datos para visualizar el mapa de cumplimiento...</p>
                  </div>
                )}
              </div>
            )}

            {!hasData ? (
              <div className="empty-state-container" style={{ minHeight: '300px' }}>
                <div className="empty-state-card" style={{ padding: '30px', margin: '20px' }}>
                  <div className="empty-state-icon" style={{ fontSize: '2rem' }}>📂</div>
                  <h2>Sin Datos para Análisis</h2>
                  <p>Por favor, utilice el botón en el menú lateral para cargar un archivo Excel (.xlsx).</p>
                </div>
              </div>
            ) : (
              <>
                {/* Tabs Navigation */}
                <nav className="tab-navigation">
                  <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                    📊 Dashboard
                  </button>
                  <button className={`tab-btn ${activeTab === 'statistical' ? 'active' : ''}`} onClick={() => setActiveTab('statistical')}>
                    📉 Estadísticas
                  </button>
                  <button className={`tab-btn ${activeTab === 'clustering' ? 'active' : ''}`} onClick={() => setActiveTab('clustering')}>
                    🕸️ Clustering
                  </button>
                  <button className={`tab-btn highlight-tab ${activeTab === 'reductor' ? 'active' : ''}`} onClick={() => setActiveTab('reductor')}>
                    🎯 Reductor
                  </button>
                  <button className={`tab-btn ${activeTab === 'presentation' ? 'active' : ''}`} style={{ background: activeTab === 'presentation' ? 'var(--panel-bg)' : 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(109, 40, 217, 0.2))', border: '1px solid rgba(139, 92, 246, 0.4)', color: '#e0e7ff', fontWeight: '600' }} onClick={() => setActiveTab('presentation')}>
                    📽️ Presentación Ejecutiva
                  </button>
                </nav>

                {/* Content */}
                <main className="app-main">
                  <div className="tab-content" key={`${dataVersion}-${activeSheet}-${selectedState}`}>
                    {activeTab === 'dashboard' && <Dashboard sheet={activeSheet} state={selectedState} />}
                    {activeTab === 'statistical' && <Statistical sheet={activeSheet} state={selectedState} />}
                    {activeTab === 'clustering' && <Clustering sheet={activeSheet} state={selectedState} />}
                    {activeTab === 'reductor' && <Reductor sheet={activeSheet} state={selectedState} />}
                    {activeTab === 'presentation' && <Presentation />}
                  </div>
                </main>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
