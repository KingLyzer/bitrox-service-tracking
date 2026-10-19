import React, { useState, useEffect } from 'react';
import AddressLabelTab from './AddressLabelTab';
import HandoverProtocol from '../HandoverProtocol';
import './docsAndLabels.css';

export default function DocsAndLabels({ defaultTab = 'address', tabId }) {
  const initialTab = tabId === 'handover' ? 'handover' : defaultTab;
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (tabId === 'handover') {
      setActiveTab('handover');
    } else if (tabId === 'address-label') {
      setActiveTab('address');
    } else if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, tabId]);

  return (
    <div className="docs-labels-container">
      {/* ── UNIFIED TOP BAR & TAB PILLS ── */}
      <div className="docs-labels-header">
        <div className="docs-labels-title-box">
          <div className="docs-labels-title-icon">
            {activeTab === 'address' ? '🏷️' : '✍️'}
          </div>
          <div className="docs-labels-title-text">
            <h2>{activeTab === 'address' ? 'Kargo & Adres Etiketi' : 'Zimmet & Teslim Tutanağı'}</h2>
            <span>Resmi Tutanaklar, Zimmet Sözleşmeleri ve Kargo Etiketleri</span>
          </div>
        </div>

        <div className="docs-labels-nav-pills">
          <button
            type="button"
            className={`docs-pill-btn ${activeTab === 'address' ? 'active' : ''}`}
            onClick={() => setActiveTab('address')}
          >
            <span style={{ fontSize: 15 }}>🏷️</span>
            <span>Kargo & Adres Etiketi</span>
          </button>

          <button
            type="button"
            className={`docs-pill-btn ${activeTab === 'handover' ? 'active' : ''}`}
            onClick={() => setActiveTab('handover')}
          >
            <span style={{ fontSize: 15 }}>✍️</span>
            <span>Teslim Tutanağı</span>
          </button>
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="docs-labels-content">
        {activeTab === 'address' && <AddressLabelTab />}
        {activeTab === 'handover' && (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <HandoverProtocol />
          </div>
        )}
      </div>
    </div>
  );
}
