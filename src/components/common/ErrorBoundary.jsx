import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-danger, #ef4444)', marginBottom: 8 }}>
            Bu sekme yüklenirken bir sorun oluştu
          </div>
          <div style={{ fontSize: 12, marginBottom: 20, maxWidth: 500, background: 'var(--color-surface-alt, rgba(0,0,0,0.05))', border: '1px solid var(--color-border)', padding: '10px 16px', borderRadius: 8, fontFamily: 'monospace', color: 'var(--color-text)' }}>
            {this.state.error?.message || 'Bilinmeyen hata'}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={this.handleRetry}
            style={{ borderRadius: 6, padding: '7px 18px', fontWeight: 600 }}
          >
            🔄 Yeniden Dene
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
