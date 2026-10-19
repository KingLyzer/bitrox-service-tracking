import React from 'react';
import Modal from './Modal';

export default function ConfirmDialog({ isOpen = true, onClose, onCancel, onConfirm, title = 'Onay', message, confirmText = 'Evet', cancelText = 'İptal', type = 'danger' }) {
  const handleClose = onClose || onCancel;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="sm"
      id="confirm-dialog"
      footer={
        <>
          <button className="btn btn-secondary btn-sm" onClick={handleClose}>{cancelText}</button>
          <button
            className={`btn btn-${type} btn-sm`}
            id="confirm-dialog-ok"
            onClick={() => { onConfirm?.(); handleClose?.(); }}
            autoFocus
          >{confirmText}</button>
        </>
      }
    >
      <div style={{ padding: '8px 0', fontSize: 14 }}>
        {type === 'danger' && <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 10 }}>⚠️</div>}
        <p style={{ textAlign: 'center', lineHeight: 1.6 }}>{message}</p>
      </div>
    </Modal>
  );
}
