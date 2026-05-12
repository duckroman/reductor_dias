import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Statistical from './components/Statistical';
import Clustering from './components/Clustering';
import Reductor from './components/Reductor';
import MexicoMap from './components/MexicoMap';
import SustitucionesPage from './components/SustitucionesPage';
import { getSheets, uploadDataFile, getActiveFile } from './services/api';
import './App.css';

const SHEET_ICONS = {
  'Global': '🌐',
  'Nombramientos': '📋',
  'Capacitación': '📚',
  'Asistencia a Simulacros': '🎯',
  'Sustituciones de FMDC': '🔄',
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSheet, setActiveSheet] = useState('Global');
  const [availableSheets, setAvailableSheets] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [activeFile, setActiveFile] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null); // null, 1 o 2
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Solo cargar el archivo activo si existe, pero no forzar la carga de rubros si no hay archivo
  useEffect(() => {
    const checkActiveFile = async () => {
      if (!selectedStage) return;
      try {
        const fileInfo = await getActiveFile();
        if (fileInfo.filename) {
          setActiveFile(fileInfo.filename);
          const data = await getSheets(selectedStage);
          setAvailableSheets(data.sheets || []);
          if (data.sheets && data.sheets.length > 0) {
            setActiveSheet(prev => prev || data.sheets[0]);
          }
        } else {
          setAvailableSheets([]);
          setActiveFile(null);
        }
      } catch (e) {
        console.error('Error checking active file', e);
      }
    };
    
    // Si cambiamos de etapa o hay nueva version, reseteamos disponible
    if (selectedStage) {
      checkActiveFile();
    }
  }, [dataVersion, selectedStage]);

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
      alert('Datos cargados y procesados exitosamente.');
    } catch (error) {
      console.error('Error uploading file', error);
      alert('Error al cargar el archivo. Verifica el formato.');
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

  // PANTALLA DE SELECCIÓN DE ETAPA
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

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <div className="logo-icon">INE</div>
          <h2>Reductor de Días</h2>
        </div>
        <div className="sidebar-metadata">
          <span className="sidebar-subtitle">Etapa {selectedStage}: {selectedStage === 1 ? 'Visitas' : 'FMDC'}</span>
          {activeFile && (
              <div className="active-file-indicator">
                <div className="active-file-label">Archivo Activo:</div>
                <span title={activeFile}>{activeFile}</span>
              </div>
            )}
        </div>

        {hasData && (
          <div className="sidebar-section">
            <h3 className="sidebar-section-title">Rubros</h3>
            {availableSheets.map(sheet => (
              <button
                key={sheet}
                className={`sidebar-btn ${activeSheet === sheet ? 'active' : ''}`}
                onClick={() => setActiveSheet(sheet)}
              >
                <span className="sidebar-icon">{SHEET_ICONS[sheet] || '📄'}</span>
                <span className="sidebar-label">{sheet}</span>
              </button>
            ))}
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
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          <button className="sidebar-btn secondary" onClick={() => { setSelectedStage(null); setAvailableSheets([]); }}>
             🔄 Cambiar Etapa
          </button>
        </div>

        {selectedState && (
          <div className="sidebar-section state-filter">
            <h3 className="sidebar-section-title">Filtro Activo</h3>
            <div className="state-badge">
              <span>🏛️ {selectedState}</span>
              <button className="clear-filter-btn" onClick={() => setSelectedState(null)}>✕</button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="app-content">
        {/* Mapa siempre visible - En ceros si no hay data */}
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
            </nav>

            {/* Content */}
            <main className="app-main">
              <div className="tab-content" key={`${dataVersion}-${activeSheet}-${selectedState}`}>
                {activeTab === 'dashboard' && <Dashboard sheet={activeSheet} state={selectedState} />}
                {activeTab === 'statistical' && <Statistical sheet={activeSheet} state={selectedState} />}
                {activeTab === 'clustering' && <Clustering sheet={activeSheet} state={selectedState} />}
                {activeTab === 'reductor' && <Reductor sheet={activeSheet} state={selectedState} />}
              </div>
            </main>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
