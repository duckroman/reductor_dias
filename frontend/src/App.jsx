import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Statistical from './components/Statistical';
import Clustering from './components/Clustering';
import Reductor from './components/Reductor';
import MexicoMap from './components/MexicoMap';
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
  const [activeSheet, setActiveSheet] = useState('');
  const [selectedState, setSelectedState] = useState(null);
  const [availableSheets, setAvailableSheets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [activeFile, setActiveFile] = useState(null);

  useEffect(() => {
    const loadSheets = async () => {
      try {
        const data = await getSheets();
        setAvailableSheets(data.sheets || []);
        if (data.sheets && data.sheets.length > 0) {
          setActiveSheet(prev => prev || data.sheets[0]);
        }
        
        const fileInfo = await getActiveFile();
        setActiveFile(fileInfo.filename);
      } catch (e) {
        console.error('Error loading initial data', e);
        setAvailableSheets(['Default']);
        setActiveSheet('Default');
      }
    };
    loadSheets();
  }, [dataVersion]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadDataFile(file);
      if (result.sheets) {
        setAvailableSheets(result.sheets);
        setActiveSheet(result.sheets[0]);
      }
      setDataVersion(v => v + 1);
      alert('Datos cargados exitosamente.');
    } catch (error) {
      console.error('Error uploading file', error);
      alert('Error al cargar archivo.');
    } finally {
      setUploading(false);
      if (e && e.target) e.target.value = '';
    }
  };

  const handleStateClick = (stateName) => {
    // Toggle: si se clickea el mismo estado, deseleccionar
    setSelectedState(prev => prev === stateName ? null : stateName);
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <div className="logo-icon">INE</div>
          <div>
            <h2>Reductor de Días</h2>
            <span className="sidebar-subtitle">Análisis de Cumplimiento</span>
            {activeFile && (
              <div className="active-file-indicator">
                📂 <span title={activeFile}>{activeFile}</span>
              </div>
            )}
          </div>
        </div>

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

        <div className="sidebar-section">
          <h3 className="sidebar-section-title">Opciones</h3>
          <label className="upload-sidebar-btn mb-15">
            {uploading ? '⏳ Cargando...' : '📂 Cargar Excel'}
            <input
              type="file"
              accept=".xlsx, .xls"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          <button 
            className="sidebar-btn" 
            onClick={() => window.print()}
            style={{ background: 'rgba(255,255,255,0.1)', textAlign: 'center', display: 'block' }}
          >
            📄 Exportar PDF
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
        {/* Mapa siempre visible */}
        <div className="map-panel">
          <MexicoMap
            sheet={activeSheet}
            selectedState={selectedState}
            onStateClick={handleStateClick}
            dataVersion={dataVersion}
          />
        </div>

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
      </div>
    </div>
  );
}

export default App;
