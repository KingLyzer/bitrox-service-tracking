import React from 'react';
import './guideWizard.css';

export default function GuideFloatingBar({ activeGuide, onOpenGuide }) {
  if (!activeGuide) return null;

  return (
    <div
      className="guide-floating-bar"
      onClick={onOpenGuide}
      title={`${activeGuide.title} Kullanım Sihirbazını Aç`}
    >
      <div className="guide-floating-icon">
        🪄
      </div>
      <div className="guide-floating-text">
        <div className="guide-floating-title">
          <span>{activeGuide.icon}</span>
          <span>{activeGuide.title}</span>
          <span style={{ fontSize: 9, opacity: 0.8, color: '#38bdf8' }}>[Rehber]</span>
        </div>
        <div className="guide-floating-subtitle">
          Nasıl kullanılır? Tıkla ve öğren ✨
        </div>
      </div>
    </div>
  );
}
