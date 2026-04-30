import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import Statistical from './components/Statistical';
import Clustering from './components/Clustering';
import Reductor from './components/Reductor';
import './App.css';
import { LayoutDashboard, LineChart, Network, Target } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon">INE</div>
          <h1>Reductor de Días</h1>
          <span className="subtitle">Análisis de Cumplimiento de Visitas</span>
        </div>
        <nav className="tab-navigation">
          <button 
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} /> Dashboard General
          </button>
          <button 
            className={`tab-btn ${activeTab === 'statistical' ? 'active' : ''}`}
            onClick={() => setActiveTab('statistical')}
          >
            <LineChart size={18} /> Análisis Estadístico
          </button>
          <button 
            className={`tab-btn ${activeTab === 'clustering' ? 'active' : ''}`}
            onClick={() => setActiveTab('clustering')}
          >
            <Network size={18} /> Clustering
          </button>
          <button 
            className={`tab-btn highlight-tab ${activeTab === 'reductor' ? 'active' : ''}`}
            onClick={() => setActiveTab('reductor')}
          >
            <Target size={18} /> Reductor de Días
          </button>
        </nav>
      </header>

      <main className="app-main">
        <div className="tab-content">
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
