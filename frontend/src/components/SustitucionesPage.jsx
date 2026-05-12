import React, { useState, useEffect } from 'react';
import Statistical from './Statistical';
import MexicoMap from './MexicoMap';
import { getSheets, uploadDataFile, getActiveFile } from '../services/api';
import { Home, Upload, FileText } from 'lucide-react';

const SustitucionesPage = () => {
  const rubro = "Sustituciones de FMDC";
  const [dataVersion, setDataVersion] = useState(0);
  const [availableSheets, setAvailableSheets] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getSheets();
        setAvailableSheets(data.sheets || []);
        const fileInfo = await getActiveFile();
        setActiveFile(fileInfo.filename);
      } catch (e) {
        console.error('Error loading data in Sustituciones', e);
      }
    };
    loadData();
  }, [dataVersion]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadDataFile(file);
      setDataVersion(v => v + 1);
      alert('Datos cargados y procesados exitosamente.');
    } catch (error) {
      console.error('Error uploading file', error);
      alert('Error al cargar archivo.');
    } finally {
      setUploading(false);
    }
  };

  const hasData = availableSheets && availableSheets.length > 0;

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <div className="logo-icon">INE</div>
          <h2>Sustituciones</h2>
        </div>
        
        <div className="sidebar-metadata">
          <span className="sidebar-subtitle">Análisis Especial FMDC</span>
          {activeFile && (
            <div className="active-file-indicator">
              <div className="active-file-label">Archivo Activo:</div>
              <span title={activeFile}>{activeFile}</span>
            </div>
          )}
        </div>

        <div className="sidebar-section">
          <h3 className="sidebar-section-title">Navegación</h3>
          <button className="sidebar-btn" onClick={() => window.location.href = '/'}>
            <span className="sidebar-icon"><Home size={18} /></span>
            <span className="sidebar-label">Volver al Inicio</span>
          </button>
        </div>

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
        </div>
      </aside>

      {/* Content Area */}
      <div className="app-content">
        {!hasData ? (
          <div className="empty-state-container">
            <div className="empty-state-card">
              <div className="empty-state-icon">🔄</div>
              <h2>Módulo de Sustituciones</h2>
              <p>Este panel especializado requiere la carga de un archivo de datos para activar el motor de análisis de Sustituciones de FMDC.</p>
              <label className="upload-main-btn">
                {uploading ? '⏳ Procesando...' : 'Cargar Archivo de Datos'}
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
        ) : (
          <>
            <header className="tab-navigation" style={{ padding: '20px 24px', background: 'rgba(15, 23, 42, 0.6)' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.5rem' }}>🔄</span> Análisis de Sustituciones de FMDC
              </h2>
            </header>

            <div className="app-main">
              <div className="info-box">
                <p className="explanation-text">
                  Se presenta el análisis técnico del rubro de Sustituciones de FMDC. A diferencia de los rubros operativos estándar, este panel se enfoca en la dinámica de reemplazo y su impacto en la cobertura nacional. Se analizan los patrones de variabilidad para identificar regiones donde el proceso de sustitución presenta anomalías estadísticas o retrasos significativos respecto a la media esperada.
                </p>
              </div>

              <div className="map-panel" style={{ marginBottom: '30px', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden' }}>
                <MexicoMap
                  sheet={rubro}
                  selectedState={null}
                  onStateClick={() => {}}
                  dataVersion={dataVersion}
                />
              </div>

              <Statistical sheet={rubro} state={null} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SustitucionesPage;
