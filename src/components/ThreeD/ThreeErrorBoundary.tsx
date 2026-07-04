import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary для 3D Canvas.
 * Ловит ошибки Three.js/WebGL и показывает fallback вместо чёрного экрана.
 */
export default class ThreeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error('3D Canvas error caught by ErrorBoundary:', error, errorInfo);
    this.props.onError?.(error);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleUse2D = () => {
    this.setState({ hasError: false, error: null });
    // Trigger 2D fallback via parent component
    const event = new CustomEvent('use-2d-fallback');
    window.dispatchEvent(event);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            padding: '24px',
            border: '1px solid rgba(251, 61, 78, 0.3)',
            borderRadius: '12px',
            background: 'rgba(251, 61, 78, 0.05)',
            color: '#e5f2ff',
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ marginBottom: '16px', color: '#fb3d4e' }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>
            3D Scene Failed
          </h3>
          
          <p style={{ margin: '0 0 20px 0', color: 'rgba(229, 242, 255, 0.7)', fontSize: '14px', textAlign: 'center', maxWidth: '400px' }}>
            3D rendering encountered an error. You can reload or switch to stable 2D fallback.
          </p>

          {import.meta.env.DEV && this.state.error && (
            <pre
              style={{
                fontSize: '12px',
                color: '#fb3d4e',
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '12px',
                borderRadius: '6px',
                maxWidth: '100%',
                overflow: 'auto',
                marginBottom: '20px',
              }}
            >
              {this.state.error.message}
            </pre>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                padding: '10px 20px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '8px',
                color: '#38bdf8',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              Reload 3D
            </button>
            
            <button
              type="button"
              onClick={this.handleUse2D}
              style={{
                padding: '10px 20px',
                background: 'rgba(148, 163, 184, 0.15)',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '8px',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              Use 2D Fallback
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
