import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getRawData } from '../services/api';

/**
 * DatasetViewer — Visor premium de datos crudos del dataset.
 * Columnas de ID fijas con anchos explícitos calculados en JS.
 * Filtros tipo Excel en columnas de identificación.
 */

// Anchos fijos por nombre de columna (px)
const COL_WIDTHS = {
  'ID Entidad': 80,
  'Entidad': 150,
  'ID Distrito': 90,
  'Distrito': 80,
  'Cabecera': 150,
};
const DEFAULT_ID_WIDTH = 100;
const DAY_COL_WIDTH = 72;

function DatasetViewer({ sheet, state }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({});
  const [openFilter, setOpenFilter] = useState(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setFilters({});
      setOpenFilter(null);
      try {
        const result = await getRawData(sheet, state);
        setData(result);
      } catch (e) {
        console.error('Error fetching raw data:', e);
        setError('No se pudo cargar el dataset. Verifique que hay datos disponibles.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [sheet, state]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpenFilter(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Valores únicos para filtros
  const getUniqueValues = (colName) => {
    if (!data || !data.rows) return [];
    const vals = new Set();
    data.rows.forEach(row => {
      const v = row[colName];
      if (v !== null && v !== undefined && v !== '') vals.add(String(v));
    });
    return Array.from(vals).sort((a, b) => {
      const na = parseFloat(a), nb = parseFloat(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  };

  // Filas filtradas
  const filteredRows = useMemo(() => {
    if (!data || !data.rows) return [];
    return data.rows.filter(row => {
      for (const [col, filterState] of Object.entries(filters)) {
        const val = String(row[col] ?? '');
        if (!filterState.selected.has(val)) return false;
      }
      return true;
    });
  }, [data, filters]);

  const toggleFilter = (colName) => {
    setOpenFilter(prev => prev === colName ? null : colName);
  };

  const handleSelectAll = (colName) => {
    setFilters(prev => {
      const next = { ...prev };
      delete next[colName]; // Eliminar el filtro selecciona todos los datos
      return next;
    });
  };

  const handleDeselectAll = (colName) => {
    setFilters(prev => ({
      ...prev,
      [colName]: { selected: new Set() }
    }));
  };

  const handleToggleValue = (colName, value, allValues) => {
    setFilters(prev => {
      const current = prev[colName];
      const newSelected = current ? new Set(current.selected) : new Set(allValues);
      
      if (newSelected.has(value)) newSelected.delete(value);
      else newSelected.add(value);
      
      if (newSelected.size === allValues.length) {
        const next = { ...prev };
        delete next[colName];
        return next;
      }
      return { ...prev, [colName]: { selected: newSelected } };
    });
  };

  const isColumnFiltered = (colName) => {
    return filters.hasOwnProperty(colName);
  };

  const activeFilterCount = Object.keys(filters).length;

  // Color-coding por cumplimiento
  const getCellStyle = (value) => {
    const v = parseFloat(value);
    if (isNaN(v)) return {};
    if (v >= 0.95) return { color: '#4ade80', fontWeight: 600 };
    if (v >= 0.85) return { color: '#86efac' };
    if (v >= 0.70) return { color: '#fbbf24' };
    if (v >= 0.50) return { color: '#fb923c' };
    return { color: '#f87171' };
  };

  const formatValue = (val) => {
    if (val === null || val === undefined || val === '') return '—';
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    return (num * 100).toFixed(1) + '%';
  };

  if (loading) {
    return <div className="loading"><div className="loading-spinner"></div>Cargando dataset...</div>;
  }
  if (error) {
    return (
      <div className="empty-state-container" style={{ minHeight: '300px' }}>
        <div className="empty-state-card" style={{ padding: '30px' }}>
          <div className="empty-state-icon" style={{ fontSize: '2rem' }}>⚠️</div>
          <h2>Error</h2><p>{error}</p>
        </div>
      </div>
    );
  }
  if (!data || !data.rows || data.rows.length === 0) {
    return (
      <div className="empty-state-container" style={{ minHeight: '300px' }}>
        <div className="empty-state-card" style={{ padding: '30px' }}>
          <div className="empty-state-icon" style={{ fontSize: '2rem' }}>📭</div>
          <h2>Sin datos</h2><p>No se encontraron registros en el dataset seleccionado.</p>
        </div>
      </div>
    );
  }

  const { id_columns, day_columns, n_days, n_districts, filename, sheet: sheetName } = data;

  // === Calcular anchos y offsets de columnas ID ===
  const idColWidths = id_columns.map(col => COL_WIDTHS[col] || DEFAULT_ID_WIDTH);
  const idColLefts = [];
  let cumLeft = 0;
  for (let i = 0; i < idColWidths.length; i++) {
    idColLefts.push(cumLeft);
    cumLeft += idColWidths[i];
  }
  const totalIdWidth = cumLeft;
  const isLastIdCol = (i) => i === id_columns.length - 1;

  // Estilo inline para celdas ID (header)
  const idThStyle = (i, colName) => ({
    position: 'sticky',
    left: idColLefts[i],
    width: idColWidths[i],
    minWidth: idColWidths[i],
    maxWidth: idColWidths[i],
    zIndex: openFilter === colName ? 50 : 30, // Elevar z-index si el dropdown está abierto para sobreponerse a filas sticky
    borderRight: isLastIdCol(i) ? '2px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.15)',
  });

  // Estilo inline para celdas ID (body)
  const idTdStyle = (i, isEven) => ({
    position: 'sticky',
    left: idColLefts[i],
    width: idColWidths[i],
    minWidth: idColWidths[i],
    maxWidth: idColWidths[i],
    zIndex: 10,
    background: isEven ? '#0c0c14' : '#12121c',
    borderRight: isLastIdCol(i) ? '2px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.08)',
  });

  // Estilo inline para celdas de día
  const dayColStyle = { width: DAY_COL_WIDTH, minWidth: DAY_COL_WIDTH, maxWidth: DAY_COL_WIDTH };

  // Ancho total de la tabla
  const totalWidth = totalIdWidth + (day_columns.length * DAY_COL_WIDTH);

  return (
    <div className="dataset-viewer-container">
      {/* Header con metadata */}
      <div className="dv-header">
        <div className="dv-header-info">
          <h2>📋 Visor de Dataset</h2>
          <span className="dv-subtitle">Rubro: <strong>{sheetName}</strong></span>
        </div>
        <div className="dv-header-stats">
          <div className="dv-stat">
            <span className="dv-stat-label">Archivo</span>
            <span className="dv-stat-value">{filename}</span>
          </div>
          <div className="dv-stat">
            <span className="dv-stat-label">Distritos</span>
            <span className="dv-stat-value">{n_districts}</span>
          </div>
          <div className="dv-stat">
            <span className="dv-stat-label">Días</span>
            <span className="dv-stat-value">{n_days}</span>
          </div>
          <div className="dv-stat">
            <span className="dv-stat-label">Mostrando</span>
            <span className="dv-stat-value">
              {filteredRows.length}{activeFilterCount > 0 ? ` / ${n_districts}` : ''}
            </span>
          </div>
          {activeFilterCount > 0 && (
            <button className="dv-clear-all-btn" onClick={() => setFilters({})} title="Limpiar todos los filtros">
              ✕ Limpiar filtros ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {/* Tabla con scroll horizontal */}
      <div className="dv-table-wrapper" ref={wrapperRef}>
        <table className="dv-table" style={{ width: totalWidth }}>
          <thead>
            <tr>
              {id_columns.map((col, i) => {
                const uniqueVals = getUniqueValues(col);
                const filtered = isColumnFiltered(col);
                return (
                  <th
                    key={`id-${i}`}
                    className={`dv-th-purple ${filtered ? 'dv-th-filtered' : ''}`}
                    style={idThStyle(i, col)}
                  >
                    <div className="dv-th-content">
                      <span className="dv-th-label">{col}</span>
                      <button
                        className={`dv-filter-btn ${filtered ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleFilter(col); }}
                        title={`Filtrar por ${col}`}
                      >
                        {filtered ? '🔽' : '▼'}
                      </button>
                    </div>
                    {openFilter === col && (
                      <FilterDropdown
                        colName={col}
                        values={uniqueVals}
                        selected={filters[col]?.selected}
                        onToggle={(val) => handleToggleValue(col, val, uniqueVals)}
                        onSelectAll={() => handleSelectAll(col)}
                        onClear={() => handleDeselectAll(col)}
                      />
                    )}
                  </th>
                );
              })}
              {day_columns.map((col, i) => (
                <th key={`day-${i}`} className="dv-th-purple dv-th-day" style={dayColStyle}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, rowIdx) => {
              const isEven = rowIdx % 2 === 0;
              return (
                <tr key={rowIdx} className={isEven ? 'dv-row-even' : 'dv-row-odd'}>
                  {id_columns.map((col, colIdx) => (
                    <td key={`id-${colIdx}`} className="dv-td-id" style={idTdStyle(colIdx, isEven)}>
                      {row[col] || '—'}
                    </td>
                  ))}
                  {day_columns.map((col, colIdx) => (
                    <td key={`day-${colIdx}`} className="dv-td-day" style={getCellStyle(row[col])}>
                      {formatValue(row[col])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** FilterDropdown — Dropdown de filtro tipo Excel */
function FilterDropdown({ colName, values, selected, onToggle, onSelectAll, onClear }) {
  const [search, setSearch] = useState('');
  const filteredValues = search
    ? values.filter(v => v.toLowerCase().includes(search.toLowerCase()))
    : values;
  const allSelected = !selected || selected.size === values.length;

  return (
    <div className="dv-filter-dropdown" onClick={(e) => e.stopPropagation()}>
      <div className="dv-filter-search">
        <input
          type="text"
          placeholder={`Buscar en ${colName}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>
      <div className="dv-filter-actions">
        <button onClick={onSelectAll}>{allSelected ? '☑ Todo' : '☐ Todo'}</button>
        <button onClick={onClear}>Limpiar</button>
      </div>
      <div className="dv-filter-list">
        {filteredValues.map(val => {
          const isChecked = allSelected || (selected && selected.has(val));
          return (
            <label key={val} className="dv-filter-item">
              <input type="checkbox" checked={isChecked} onChange={() => onToggle(val)} />
              <span>{val}</span>
            </label>
          );
        })}
        {filteredValues.length === 0 && <div className="dv-filter-empty">Sin resultados</div>}
      </div>
      <div className="dv-filter-footer">{values.length} valores únicos</div>
    </div>
  );
}

export default DatasetViewer;
