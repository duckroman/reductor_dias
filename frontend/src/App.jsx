import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import Statistical from './components/Statistical';
import Clustering from './components/Clustering';
import Reductor from './components/Reductor';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [uploading, setUploading] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const { uploadDataFile } = await import('./services/api');
      await uploadDataFile(file);
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

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon">INE</div>
          <h1>Reductor de Días</h1>
          <span className="subtitle" style={{marginRight: '20px'}}>Análisis de Cumplimiento</span>
          <label className="upload-btn" style={{ cursor: 'pointer', padding: '6px 12px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', borderRadius: '4px', fontSize: '0.85rem' }}>
            {uploading ? 'Cargando...' : '📄 Cargar Excel'}
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              style={{ display: 'none' }} 
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>
        <nav className="tab-navigation">
          <button 
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button 
            className={`tab-btn ${activeTab === 'statistical' ? 'active' : ''}`}
            onClick={() => setActiveTab('statistical')}
          >
            📉 Estadísticas
          </button>
          <button 
            className={`tab-btn ${activeTab === 'clustering' ? 'active' : ''}`}
            onClick={() => setActiveTab('clustering')}
          >
            🕸️ Clustering
          </button>
          <button 
            className={`tab-btn highlight-tab ${activeTab === 'reductor' ? 'active' : ''}`}
            onClick={() => setActiveTab('reductor')}
          >
            🎯 Reductor
          </button>
        </nav>
      </header>

      <main className="app-main">
        <div className="tab-content" key={dataVersion}>
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'statistical' && <Statistical />}
          {activeTab === 'clustering' && <Clustering />}
          {activeTab === 'reductor' && <Reductor />}
        </div>
      </main>
    </div>
  );
}

export default App;
