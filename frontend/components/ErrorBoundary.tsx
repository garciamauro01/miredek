import { Component, type ErrorInfo, type ReactNode } from 'react';

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
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    background: '#f9fafb',
                    color: '#374151',
                    fontFamily: 'sans-serif',
                    textAlign: 'center'
                }}>
                    <h1 style={{ color: '#ef4444', marginBottom: '10px' }}>Ops! Algo deu errado.</h1>
                    <p style={{ marginBottom: '20px', maxWidth: '400px' }}>
                        O MireDesk detectou um erro inesperado. Isso pode ocorrer ao rodar no navegador sem as APIs do Electron.
                    </p>
                    <div style={{
                        background: '#fee2e2',
                        padding: '10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#991b1b',
                        marginBottom: '20px',
                        textAlign: 'left',
                        overflow: 'auto',
                        maxWidth: '90%'
                    }}>
                        <code>{this.state.error?.toString()}</code>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '10px 20px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        Recarregar Aplicativo
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
