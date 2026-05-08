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

  // Construir mapeo de datos para el choropleth
  const stateMap = {};
  stateData.forEach(s => { stateMap[s.entidad] = s; });

  const locations = geoJson.features.map(f => f.properties.name);
  const values = locations.map(name => {
    const s = stateMap[name];
    return s ? (s.media_actual || 0) * 100 : 0;
  });
  const hoverTexts = locations.map(name => {
    const s = stateMap[name];
    if (!s) return `${name}: Sin datos`;
    return `<b>${name}</b><br>Cumplimiento: ${((s.media_actual || 0) * 100).toFixed(1)}%<br>Distritos: ${s.n_distritos}`;
  });

  return (
    <div>
      <div className="map-title">
        🗺️ Mapa de Cumplimiento por Entidad — <span style={{color: '#93c5fd'}}>{sheet}</span>
        {selectedState && (
          <span style={{ marginLeft: '15px', color: '#6ee7b7', fontSize: '0.85rem' }}>
            | Filtro: {selectedState}
          </span>
        )}
      </div>
      <Plot
        data={[{
          type: 'choropleth',
          geojson: geoJson,
          locations: locations,
          z: values,
          featureidkey: 'properties.name',
          colorscale: [
            [0, '#dc2626'],
            [0.25, '#f97316'],
            [0.5, '#facc15'],
            [0.75, '#22c55e'],
            [1, '#059669']
          ],
          zmin: 0,
          zmax: 100,
          marker: {
            line: {
              color: selectedState ? locations.map(n =>
                n === selectedState ? '#ffffff' : 'rgba(255,255,255,0.3)'
              ) : 'rgba(255,255,255,0.3)',
              width: selectedState ? locations.map(n =>
                n === selectedState ? 3 : 0.5
              ) : 0.5,
            }
          },
          hoverinfo: 'text',
          text: hoverTexts,
          hoverlabel: {
            bgcolor: 'rgba(15, 23, 42, 0.95)',
            bordercolor: '#3b82f6',
            font: { family: 'Inter, sans-serif', size: 13, color: '#f8fafc' },
          },
          colorbar: {
            title: { text: '% Cumplimiento', font: { color: '#e0e0e0' } },
            tickfont: { color: '#e0e0e0' },
            ticksuffix: '%',
            len: 0.6,
          },
          selectedpoints: selectedState ? [locations.indexOf(selectedState)] : undefined,
        }]}
        layout={{
          geo: {
            scope: 'north america',
            showframe: false,
            showcoastlines: false,
            showland: true,
            landcolor: 'rgba(30, 41, 59, 0.3)',
            showocean: true,
            oceancolor: 'rgba(15, 23, 42, 0.5)',
            showlakes: false,
            projection: { type: 'mercator' },
            center: { lat: 23.6345, lon: -102.5528 },
            lonaxis: { range: [-118, -86] },
            lataxis: { range: [14, 33] },
            bgcolor: 'rgba(0,0,0,0)',
          },
          margin: { t: 0, r: 0, b: 0, l: 0 },
          paper_bgcolor: 'rgba(0,0,0,0)',
          font: { color: '#e0e0e0' },
          dragmode: false,
          height: 320,
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
  );
};

export default MexicoMap;
