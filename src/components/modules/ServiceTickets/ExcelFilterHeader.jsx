import React, { useState, useEffect } from 'react';

export default function ExcelFilterHeader(props) {
  const { displayName, enableSorting, progressSort, column, field, isFiltered, onOpenFilter } = props;
  const [sortState, setSortState] = useState(() => {
    try {
      return column?.getSort?.() || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!column?.addEventListener) return;
    const onSortChanged = () => {
      setSortState(column.getSort?.() || null);
    };
    column.addEventListener('sortChanged', onSortChanged);
    return () => {
      column.removeEventListener?.('sortChanged', onSortChanged);
    };
  }, [column]);

  const handleHeaderClick = (e) => {
    if (enableSorting && progressSort) {
      progressSort();
    }
  };

  const handleFilterClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onOpenFilter) {
      const rect = e.currentTarget.getBoundingClientRect();
      onOpenFilter(field, displayName, rect);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      height: '100%',
      userSelect: 'none',
      gap: 6
    }}>
      {/* Sütun Başlığı ve Sıralama */}
      <div
        onClick={handleHeaderClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          flex: 1,
          minWidth: 0,
          cursor: enableSorting ? 'pointer' : 'default',
          overflow: 'hidden'
        }}
        title={enableSorting ? `${displayName} — Sıralamak için tıklayın` : displayName}
      >
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: isFiltered ? 800 : 700,
          color: isFiltered ? '#f97316' : 'var(--color-text, #f1f5f9)',
          fontSize: 11.5,
          letterSpacing: '0.3px',
          textTransform: 'uppercase'
        }}>
          {displayName}
        </span>
        {sortState === 'asc' && (
          <span style={{ fontSize: 10, color: '#f97316', fontWeight: 800, flexShrink: 0 }}>▲</span>
        )}
        {sortState === 'desc' && (
          <span style={{ fontSize: 10, color: '#f97316', fontWeight: 800, flexShrink: 0 }}>▼</span>
        )}
      </div>

      {/* Excel Tarzı Filtreleme İkonu */}
      <button
        type="button"
        onClick={handleFilterClick}
        title={`${displayName} filtresini aç (${isFiltered ? 'Filtre Aktif' : 'Filtre Yok'})`}
        style={{
          background: isFiltered ? 'rgba(249, 115, 22, 0.25)' : 'rgba(255, 255, 255, 0.04)',
          border: isFiltered ? '1px solid #f97316' : '1px solid var(--color-border, rgba(255, 255, 255, 0.12))',
          borderRadius: 5,
          width: 22,
          height: 22,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: isFiltered ? '#f97316' : 'var(--color-text-muted, #94a3b8)',
          boxShadow: isFiltered ? '0 0 8px rgba(249, 115, 22, 0.35)' : 'none',
          transition: 'all 0.15s ease',
          outline: 'none',
          flexShrink: 0,
          padding: 0
        }}
        onMouseEnter={e => {
          if (!isFiltered) {
            e.currentTarget.style.color = '#f97316';
            e.currentTarget.style.background = 'rgba(249, 115, 22, 0.15)';
            e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.4)';
          }
        }}
        onMouseLeave={e => {
          if (!isFiltered) {
            e.currentTarget.style.color = 'var(--color-text-muted, #94a3b8)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
            e.currentTarget.style.borderColor = 'var(--color-border, rgba(255, 255, 255, 0.12))';
          }
        }}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill={isFiltered ? '#f97316' : 'none'}
          stroke="currentColor"
          strokeWidth={isFiltered ? '2.8' : '2.2'}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
        </svg>
      </button>
    </div>
  );
}
