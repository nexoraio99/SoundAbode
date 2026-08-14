import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled Application Error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#06070a',
            color: '#f8fafc',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              padding: '2.5rem',
              backgroundColor: '#0f172a',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                margin: '0 auto 1.25rem',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: '#ffffff' }}>
              Something Went Wrong
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              An unexpected error occurred. Don't worry, your data is safe. Please reload the page to continue.
            </p>
            <button
              onClick={this.handleReload}
              style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                padding: '0.75rem 1.75rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
