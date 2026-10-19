import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function PromptDialog({ title, message, defaultValue = '', placeholder = '', confirmText = 'Tamam', cancelText = 'İptal', onConfirm, onCancel }) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if (defaultValue) {
        inputRef.current.select();
      }
    }
  }, [defaultValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(value);
  };

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 1000000 }}>
      <div className="modal-content" style={{ width: 400, maxWidth: '90%', background: 'var(--color-surface)', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn-close" onClick={onCancel}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '20px' }}>
            {message && <p style={{ marginBottom: 12, fontSize: 13, color: 'var(--color-text-secondary)' }}>{message}</p>}
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={placeholder}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                fontSize: 14,
                background: 'var(--color-bg-dark)',
                color: 'var(--color-text)'
              }}
            />
          </div>
          <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '15px 20px', background: 'var(--color-surface-alt)' }}>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>{cancelText}</button>
            <button type="submit" className="btn btn-primary">{confirmText}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
