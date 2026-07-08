import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Plotly from 'plotly.js'

Plotly.setPlotConfig({
  topojsonURL: `${import.meta.env.BASE_URL}topojson/`
});
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
