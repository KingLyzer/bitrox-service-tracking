import React from 'react';
import { useApp } from '../../context/AppContext';
import '../../styles/layout.css';

export default function TabBar() {
  const { tabs, activeTab, setActiveTab, closeTab } = useApp();

  const handleTabAuxClick = (e, tab) => {
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      if (tab.closable !== false) {
        closeTab(tab.id);
      }
    }
  };

  return (
    <div className="tabbar" id="tabbar">
      {tabs.map(tab => (
        <div
          key={tab.id}
          id={`tab-${tab.id}`}
          className={`tab${activeTab === tab.id ? ' active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
          onAuxClick={e => handleTabAuxClick(e, tab)}
          onMouseDown={e => {
            if (e.button === 1) {
              e.preventDefault();
            }
          }}
          title={tab.label}
        >
          <span className="tab-icon">{tab.icon}</span>
          <span className="tab-label" data-text={tab.label}>{tab.label}</span>
          {tab.closable !== false && (
            <span
              className="tab-close"
              onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
              title="Kapat"
            >✕</span>
          )}
        </div>
      ))}
    </div>
  );
}
