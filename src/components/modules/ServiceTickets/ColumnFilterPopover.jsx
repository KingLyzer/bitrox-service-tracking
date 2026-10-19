import React, { useState, useMemo, useEffect, useRef } from 'react';

/**
 * Extracts and sorts unique values with occurrence counts for a given column.
 */
export function getUniqueColumnValues(tickets, field) {
  const counts = new Map();

  (tickets || []).forEach(t => {
    let val;
    if (field === 'created_at') {
      val = t.created_at ? String(t.created_at).slice(0, 10) : '—';
    } else if (field === 'asset_name') {
      val = (t.asset_name || t.model_name || '').trim() || '—';
    } else {
      val = (t[field] !== undefined && t[field] !== null && String(t[field]).trim() !== '') ? String(t[field]).trim() : '—';
    }
    counts.set(val, (counts.get(val) || 0) + 1);
  });

  const list = Array.from(counts.entries()).map(([val, count]) => ({ val, count }));

  // Ordering based on domain rules
  if (field === 'created_at') {
    list.sort((a, b) => b.val.localeCompare(a.val));
  } else if (field === 'status') {
    const order = ['Yeni Kayıt', 'İncelemede', 'Parça Bekliyor', 'Onarımda', 'Testte', 'Dış Serviste', 'Tamamlandı', 'Teslim Edildi', 'Pert', 'İptal'];
    list.sort((a, b) => {
      const idxA = order.indexOf(a.val);
      const idxB = order.indexOf(b.val);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.val.localeCompare(b.val, 'tr');
    });
  } else if (field === 'priority') {
    const order = ['Acil', 'Kritik', 'Yüksek', 'Normal', 'Orta', 'Düşük'];
    list.sort((a, b) => {
      const idxA = order.indexOf(a.val);
      const idxB = order.indexOf(b.val);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return a.val.localeCompare(b.val, 'tr');
    });
  } else {
    list.sort((a, b) => {
      if (a.val === '—') return 1;
      if (b.val === '—') return -1;
      return a.val.localeCompare(b.val, 'tr');
    });
  }

  return list;
}

export default function ColumnFilterPopover({
  field,
  title,
  anchorRect,
  allTickets = [],
  selectedValues = [],
  onApply,
  onClear,
  onClose,
}) {
  const popoverRef = useRef(null);
  const searchInputRef = useRef(null);

  // All unique options for this field
  const uniqueItems = useMemo(() => getUniqueColumnValues(allTickets, field), [allTickets, field]);

  // Local draft state of selected items
  // If selectedValues is empty, it means no filter is active (everything is shown).
  // For Excel behavior: if empty, initially all unique items are selected so user can uncheck what they don't want.
  const [selected, setSelected] = useState(() => {
    if (selectedValues && selectedValues.length > 0) {
      return new Set(selectedValues);
    }
    return new Set(uniqueItems.map(i => i.val));
  });

  const [search, setSearch] = useState('');

  // Filtered items based on popover search
  const filteredItems = useMemo(() => {
    if (!search.trim()) return uniqueItems;
    const q = search.toLowerCase().trim();
    return uniqueItems.filter(item => item.val.toLowerCase().includes(q));
  }, [uniqueItems, search]);

  // Auto focus search input on open
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Calculate coordinates with boundary protection
  const position = useMemo(() => {
    const popoverWidth = 270;
    const popoverHeight = 360;

    if (!anchorRect) {
      return { top: 120, left: 120 };
    }

    let left = anchorRect.left;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = Math.max(12, window.innerWidth - popoverWidth - 16);
    }
    if (left < 12) left = 12;

    let top = anchorRect.bottom + 6;
    if (top + popoverHeight > window.innerHeight - 16) {
      top = Math.max(12, anchorRect.top - popoverHeight - 6);
    }

    return { top, left };
  }, [anchorRect]);

  // Toggle single item
  const handleToggleItem = (val) => {
    const next = new Set(selected);
    if (next.has(val)) {
      next.delete(val);
    } else {
      next.add(val);
    }
    setSelected(next);
  };

  // Toggle Select All / Deselect All
  const isAllFilteredSelected = filteredItems.length > 0 && filteredItems.every(i => selected.has(i.val));

  const handleToggleSelectAll = () => {
    const next = new Set(selected);
    if (isAllFilteredSelected) {
      filteredItems.forEach(i => next.delete(i.val));
    } else {
      filteredItems.forEach(i => next.add(i.val));
    }
    setSelected(next);
  };

  const handleApply = () => {
    // If all items are selected, effectively clear filter
    if (selected.size === uniqueItems.length) {
      onClear();
    } else {
      onApply(Array.from(selected));
    }
    onClose();
  };

  const handleClear = () => {
    onClear();
    onClose();
  };

  return (
    <>
      {/* Click outside backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99998,
          background: 'transparent',
        }}
      />

      {/* Popover container */}
      <div
        ref={popoverRef}
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          width: 270,
          maxHeight: 380,
          zIndex: 99999,
          background: 'var(--color-surface, #1e293b)',
          border: '1px solid var(--color-border, rgba(255, 255, 255, 0.15))',
          borderRadius: 10,
          boxShadow: '0 18px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(249, 115, 22, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInPop 0.15s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 12px',
          background: 'var(--color-surface-alt, #0f172a)',
          borderBottom: '1px solid var(--color-border, rgba(255, 255, 255, 0.1))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 13, color: '#f97316' }}>🌪️</span>
            <span style={{
              fontSize: 12,
              fontWeight: 800,
              color: 'var(--color-text, #f8fafc)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {title} Filtrele
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted, #94a3b8)',
              cursor: 'pointer',
              fontSize: 13,
              padding: '2px 4px',
              borderRadius: 4,
              lineHeight: 1,
            }}
            title="Kapat"
          >
            ✕
          </button>
        </div>

        {/* Search Input */}
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border, rgba(255, 255, 255, 0.08))' }}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 11,
              color: 'var(--color-text-muted, #94a3b8)',
              pointerEvents: 'none'
            }}>🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Değer ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '5px 22px 5px 26px',
                fontSize: 11.5,
                borderRadius: 6,
                border: '1px solid var(--color-border, rgba(255, 255, 255, 0.15))',
                background: 'var(--color-surface, #1e293b)',
                color: 'var(--color-text, #f8fafc)',
                outline: 'none',
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  fontSize: 10,
                  padding: 2
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Select All Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid var(--color-border, rgba(255, 255, 255, 0.08))',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-text-secondary, #94a3b8)'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={isAllFilteredSelected}
              onChange={handleToggleSelectAll}
              style={{ cursor: 'pointer', accentColor: '#f97316' }}
            />
            <span>(Tümünü Seç)</span>
          </label>

          <span style={{ fontSize: 10, opacity: 0.8 }}>
            {selected.size} / {uniqueItems.length}
          </span>
        </div>

        {/* Scrollable Items List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: 200,
          padding: '4px 6px',
        }}>
          {filteredItems.length === 0 ? (
            <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)' }}>
              Eşleşen değer bulunamadı.
            </div>
          ) : (
            filteredItems.map(item => {
              const checked = selected.has(item.val);
              return (
                <label
                  key={item.val}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 8px',
                    borderRadius: 5,
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontSize: 11.5,
                    color: checked ? 'var(--color-text, #f8fafc)' : 'var(--color-text-muted, #94a3b8)',
                    background: checked ? 'rgba(249, 115, 22, 0.08)' : 'transparent',
                    marginBottom: 2,
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={e => {
                    if (!checked) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  }}
                  onMouseLeave={e => {
                    if (!checked) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleItem(item.val)}
                    style={{ cursor: 'pointer', accentColor: '#f97316', flexShrink: 0 }}
                  />
                  <span style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: checked ? 600 : 400
                  }}>
                    {item.val}
                  </span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: 8,
                    background: 'var(--color-surface-alt, rgba(0, 0, 0, 0.3))',
                    color: checked ? '#f97316' : 'var(--color-text-muted)',
                    border: '1px solid var(--color-border, rgba(255, 255, 255, 0.08))',
                    flexShrink: 0
                  }}>
                    {item.count}
                  </span>
                </label>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          background: 'var(--color-surface-alt, #0f172a)',
          borderTop: '1px solid var(--color-border, rgba(255, 255, 255, 0.1))',
          gap: 6
        }}>
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border, rgba(255, 255, 255, 0.15))',
              color: 'var(--color-text-secondary, #94a3b8)',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Filtreyi Kaldır
          </button>

          <button
            type="button"
            onClick={handleApply}
            style={{
              background: 'linear-gradient(135deg, #ea580c, #f97316)',
              border: 'none',
              color: '#ffffff',
              padding: '5px 14px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(249, 115, 22, 0.35)'
            }}
          >
            ✓ Uygula
          </button>
        </div>
      </div>
    </>
  );
}
