import React, { useState, useMemo, useCallback } from 'react';
import '../../styles/layout.css';

export default function DataGrid({
  columns = [],
  data = [],
  onRowClick,
  onRowDoubleClick,
  contextMenu,
  getRowClass,
  loading = false,
  emptyText = 'Kayıt bulunamadı.',
  height = '100%',
  toolbarLeft,
  toolbarRight,
  id,
}) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [contextMenuState, setContextMenuState] = useState(null);

  // Filter
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(row =>
      columns.some(col => {
        const val = col.render ? '' : String(row[col.key] ?? '').toLowerCase();
        return val.includes(q);
      })
    );
  }, [data, search, columns]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortCol] ?? '', bv = b[sortCol] ?? '';
      const cmp = String(av).localeCompare(String(bv), 'tr', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  const handleSort = useCallback((key) => {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(key); setSortDir('asc'); }
  }, [sortCol]);

  const handleContextMenu = useCallback((e, row) => {
    if (!contextMenu) return;
    e.preventDefault();
    setContextMenuState({ x: e.clientX, y: e.clientY, row });
  }, [contextMenu]);

  return (
    <div className="data-grid-wrapper" style={{ height }} id={id}>
      {/* Toolbar */}
      <div className="data-grid-toolbar">
        {toolbarLeft}
        <div className="data-grid-search">
          <span className="data-grid-search-icon">🔍</span>
          <input
            id={`${id || 'grid'}-search`}
            type="text"
            placeholder="Ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 13 }} onClick={() => setSearch('')}>✕</button>}
        </div>
        <div style={{ flex: 1 }} />
        {toolbarRight}
      </div>

      {/* Table */}
      <div className="data-grid-table-wrapper">
        {loading ? (
          <div className="flex-center" style={{ height: 200 }}><div className="spinner" /></div>
        ) : sorted.length === 0 ? (
          <div className="data-grid-empty">{emptyText}</div>
        ) : (
          <table className="data-grid-table">
            <thead>
              <tr>
                {columns.map(col => (
                  <th
                    key={col.key}
                    style={{ width: col.width, minWidth: col.minWidth }}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                  >
                    {col.header}
                    {sortCol === col.key && (
                      <span className="sort-indicator">{sortDir === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr
                  key={row.id ?? i}
                  className={getRowClass?.(row) || ''}
                  onClick={() => onRowClick?.(row)}
                  onDoubleClick={() => onRowDoubleClick?.(row)}
                  onContextMenu={e => handleContextMenu(e, row)}
                >
                  {columns.map(col => (
                    <td key={col.key} style={{ maxWidth: col.maxWidth || 300 }}>
                      {col.render ? col.render(row[col.key], row) : (
                        <span className={col.truncate ? 'truncate' : ''} style={{ display: 'block' }}>
                          {row[col.key] ?? ''}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="data-grid-footer">
        <span>Toplam: <b>{sorted.length}</b>{search && ` (filtre: ${data.length})`} kayıt</span>
        <span>Çift tıklayarak detay açın</span>
      </div>

      {/* Context Menu */}
      {contextMenuState && contextMenu && (
        <>
          <div style={ctxOverlay} onClick={() => setContextMenuState(null)} />
          <div style={{ ...ctxMenu, left: contextMenuState.x, top: contextMenuState.y }}>
            {contextMenu(contextMenuState.row, () => setContextMenuState(null)).map((item, i) =>
              item.sep ? <div key={i} style={ctxSep} /> : (
                <button key={i} style={ctxItem} onClick={() => { item.onClick(contextMenuState.row); setContextMenuState(null); }}>
                  {item.icon && <span style={{ marginRight: 6 }}>{item.icon}</span>}
                  {item.label}
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

const ctxOverlay = { position: 'fixed', inset: 0, zIndex: 9998 };
const ctxMenu = {
  position: 'fixed', zIndex: 9999, background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', minWidth: 160, padding: '4px 0',
};
const ctxItem = {
  display: 'flex', alignItems: 'center', width: '100%', background: 'none',
  border: 'none', padding: '6px 16px', fontSize: 12, cursor: 'pointer', textAlign: 'left',
  fontFamily: 'var(--font-family)', color: 'var(--color-text)',
};
const ctxSep = { height: 1, background: 'var(--color-border)', margin: '3px 0' };
