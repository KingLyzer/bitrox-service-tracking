import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/layout.css';

export default function Modal({ isOpen, onClose, title, children, size = 'md', footer, id, disableBackdropClick = false }) {
  const overlayRef = useRef();

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => { 
      if (e.key === 'Escape' && !disableBackdropClick) onClose?.(); 
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, disableBackdropClick]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-overlay"
      ref={overlayRef}
      style={{ zIndex: 1000000 }}
      onMouseDown={e => { 
        if (e.target === overlayRef.current && !disableBackdropClick) onClose?.(); 
      }}
    >
      <div className={`modal modal-${size}`} id={id || 'modal'}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} title="Kapat">✕</button>
        </div>
        <div className="modal-body" style={{ background: 'var(--color-surface)', minHeight: 200 }}>{children}</div>
        {footer && <div className="modal-footer" style={{ background: 'var(--color-surface-alt)' }}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
