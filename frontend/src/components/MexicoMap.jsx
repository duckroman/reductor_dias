import React, { useState, useEffect } from 'react';
import { getStateSummary } from '../services/api';
import PlotlyComponent from 'react-plotly.js';

const Plot = PlotlyComponent.default || PlotlyComponent;

const MexicoMap = ({ sheet, selectedState, onStateClick, dataVersion }) => {
  const [stateData, setStateData] = useState([]);
  const [geoJson, setGeoJson] = useState(null);

  // Cargar GeoJSON una sola vez
  useEffect(() => {
    fetch('/mexico_geo.json')
      .then(r => r.json())
      .then(data => setGeoJson(data))
      .catch(e => console.error('Error loading GeoJSON', e));
  }, []);

  // Cargar resumen estatal cuando cambia el rubro o la versión de datos
  useEffect(() => {
    if (!sheet) return;
    const fetchSummary = async () => {
      try {
        const data = await getStateSummary(sheet);
        setStateData(data);
      } catch (e) {
        console.error('Error loading state summary', e);
      }
    };
    fetchSummary();
  }, [sheet, dataVersion]);

  if (!geoJson) return <div style={{ padding: '20px', color: '#94a3b8' }}>Cargando mapa...</div>;

  // Construir mapeo de datos para el choropleth (Case-insensitive)
  const stateMap = {};
  stateData.forEach(s => { 
    if (s.entidad) {
      stateMap[s.entidad.toLowerCase().trim()] = s; 
    }
  });

  const locations = geoJson.features.map(f => f.properties.name);
  const values = locations.map(name => {
    const s = stateMap[name.toLowerCase().trim()];
    return s ? (s.media_actual || 0) * 100 : 0;
  });
  const hoverTexts = locations.map(name => {
    const s = stateMap[name.toLowerCase().trim()];
    if (!s) return `${name}: Sin datos`;
    return `<b>${name}</b><br>Cumplimiento: ${((s.media_actual || 0) * 100).toFixed(1)}%<br>Distritos: ${s.n_distritos}`;
  });

  return (
    <div style={{ padding: '24px' }}>
      <div className="map-title" style={{ marginBottom: '16px' }}>
        🗺️ Mapa de Cumplimiento por Entidad — <span style={{color: '#818cf8'}}>{sheet}</span>
        {selectedState && (
          <span style={{ marginLeft: '15px', color: '#6ee7b7', fontSize: '0.85rem' }}>
            | Filtro: {selectedState}
          </span>
        )}
      </div>
      <div style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <Plot
          data={[{
            type: 'choropleth',
            geojson: geoJson,
            locations: locations,
            z: values,
            featureidkey: 'properties.name',
            colorscale: [
              [0, '#ef4444'],
              [0.25, '#f97316'],
              [0.5, '#fbbf24'],
              [0.75, '#22c55e'],
              [1, '#059669']
            ],
            zmin: 0,
            zmax: 100,
            marker: {
              line: {
                color: selectedState ? locations.map(n =>
                  n.toLowerCase().trim() === selectedState.toLowerCase().trim() ? '#ffffff' : 'rgba(255,255,255,0.2)'
                ) : 'rgba(255,255,255,0.2)',
                width: selectedState ? locations.map(n =>
                  n.toLowerCase().trim() === selectedState.toLowerCase().trim() ? 2 : 0.5
                ) : 0.5,
              }
            },
            hoverinfo: 'text',
            text: hoverTexts,
            hoverlabel: {
              bgcolor: '#0f172a',
              bordercolor: '#6366f1',
              font: { family: 'Outfit, sans-serif', size: 13, color: '#f8fafc' },
            },
            colorbar: {
              title: { text: '%', font: { color: '#94a3b8', size: 12 } },
              tickfont: { color: '#94a3b8' },
              len: 0.8,
            },
            selectedpoints: selectedState ? [locations.findIndex(l => l.toLowerCase().trim() === selectedState.toLowerCase().trim())] : undefined,
          }]}
          layout={{
            geo: {
              scope: 'north america',
              showframe: false,
              showcoastlines: false,
              showland: true,
              landcolor: '#0f172a',
              showocean: true,
              oceancolor: '#020617',
              showlakes: false,
              projection: { type: 'mercator' },
              center: { lat: 23.6345, lon: -102.5528 },
              lonaxis: { range: [-118, -86] },
              lataxis: { range: [14, 33] },
              bgcolor: '#030712',
            },
            margin: { t: 0, r: 0, b: 0, l: 0 },
            paper_bgcolor: '#030712',
            plot_bgcolor: '#030712',
            font: { color: '#94a3b8' },
            dragmode: false,
            height: 350,
          }}
        useResizeHandler={true}
        style={{ width: '100%' }}
        onClick={(event) => {
          if (event && event.points && event.points[0]) {
            const clickedState = event.points[0].location;
            if (clickedState && onStateClick) {
              onStateClick(clickedState);
            }
          }
        }}
        config={{ displayModeBar: false, scrollZoom: false }}
      />
      </div>
    </div>
  );
};

export default MexicoMap;
