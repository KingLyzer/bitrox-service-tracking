import React, { useState, useEffect } from 'react';
import './guideWizard.css';
import { MODULE_GUIDES } from './guideData';

export default function GuideWizardModal({
  guide,
  isOpen,
  onClose,
  dontShowAgain,
  onToggleDontShowAgain,
  onDisableAllGuides,
  onSelectModuleGuide
}) {
  const [currentStep, setCurrentStep] = useState(0);

  // Modül değiştiğinde adımı sıfırla
  useEffect(() => {
    setCurrentStep(0);
  }, [guide?.id]);

  // ESC tuşu ile kapatma
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep, guide]);

  if (!isOpen || !guide) return null;

  const steps = guide.steps || [];
  const totalSteps = steps.length;
  const step = steps[currentStep] || {};
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const progressPercent = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 100;

  return (
    <div className="guide-wizard-overlay" onClick={onClose}>
      <div
        className="guide-wizard-card"
        style={{
          '--guide-theme-color': guide.color || '#3b82f6',
          '--guide-icon-bg': `${guide.color || '#3b82f6'}22`,
          '--guide-badge-bg': `${guide.color || '#3b82f6'}26`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HEADER ── */}
        <div className="guide-wizard-header">
          <div className="guide-header-left">
            <div className="guide-module-icon">
              {guide.icon}
            </div>
            <div className="guide-header-text">
              <h3>
                {guide.title}
                <span className="guide-module-badge">{guide.badge}</span>
              </h3>
              <p>{guide.description}</p>
            </div>
          </div>
          <button className="guide-close-btn" onClick={onClose} title="Sihirbazı Kapat (ESC)">
            ✕
          </button>
        </div>

        {/* ── PROGRESS BAR ── */}
        <div className="guide-progress-container">
          <div className="guide-progress-bar-bg">
            <div className="guide-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="guide-step-counter">
            Adım {currentStep + 1} / {totalSteps}
          </div>
        </div>

        {/* ── STEP CONTENT ── */}
        <div className="guide-wizard-body">
          <div key={`${guide.id}-${currentStep}`} className="guide-step-card">
            <div className="guide-step-header">
              <span className="guide-step-icon">{step.icon || '📌'}</span>
              <h4 className="guide-step-title">{step.title}</h4>
            </div>

            <p className="guide-step-desc">{step.desc}</p>

            {step.tips && (
              <div className="guide-tip-box">
                <span className="guide-tip-icon">💡</span>
                <p className="guide-tip-text">
                  <strong>İpucu:</strong> {step.tips}
                </p>
              </div>
            )}
          </div>

          {/* Adım Noktaları (Dots) */}
          <div className="guide-dots-container">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`guide-dot ${idx === currentStep ? 'active' : ''}`}
                onClick={() => setCurrentStep(idx)}
                title={`Adım ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="guide-wizard-footer">
          <div className="guide-footer-left">
            <label className="guide-dont-show-checkbox">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={onToggleDontShowAgain}
              />
              Bu bölüm için otomatik açma
            </label>
            {onDisableAllGuides && (
              <button
                type="button"
                className="guide-disable-all-btn"
                onClick={onDisableAllGuides}
                title="Tüm modüller için otomatik açılışı kalıcı olarak kapatır"
              >
                🚫 Bir Daha Gösterme (Tümünü Kapat)
              </button>
            )}
          </div>

          <div className="guide-footer-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handlePrev}
              disabled={isFirstStep}
              style={{ opacity: isFirstStep ? 0.4 : 1, fontSize: 12 }}
            >
              ◀ Geri
            </button>

            <button
              type="button"
              className={`btn ${isLastStep ? 'btn-success' : 'btn-primary'} btn-sm`}
              onClick={handleNext}
              style={{ fontSize: 12, fontWeight: 700, minWidth: 100 }}
            >
              {isLastStep ? 'Tamamla & Başla 🚀' : 'İleri ▶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
