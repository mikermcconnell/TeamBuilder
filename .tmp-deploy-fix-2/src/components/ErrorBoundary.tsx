import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackComponent?: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  isolate?: boolean;
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Error caught by ${this.props.componentName || 'ErrorBoundary'}:`, error, errorInfo);

    this.setState({
      errorInfo
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys } = this.props;
    const { hasError } = this.state;

    if (hasError && resetKeys && prevProps.resetKeys !== resetKeys) {
      // Reset the error boundary if resetKeys have changed
      this.resetErrorBoundary();
    }
  }

  resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    const { hasError, error } = this.state;
    const { fallbackComponent: FallbackComponent, isolate, componentName } = this.props;

    if (hasError && error) {
      if (FallbackComponent) {
        return <FallbackComponent error={error} resetErrorBoundary={this.resetErrorBoundary} />;
      }

      // Default fallback UI for isolated errors
      if (isolate) {
        return (
          <div className="p-4 m-2 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-900">
                  {componentName || 'Component'} Error
                </p>
                <p className="text-sm text-red-700 mt-1">
                  {error.message}
                </p>
                <Button
                  onClick={this.resetErrorBoundary}
                  size="sm"
                  variant="outline"
                  className="mt-3 text-red-600 border-red-300 hover:bg-red-50"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        );
      }

      // Full error display
      return (
        <div className="p-4 border border-red-500 rounded-lg bg-red-50">
          <h2 className="text-red-600 font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Something went wrong
          </h2>
          <pre className="mt-2 text-sm bg-white p-3 rounded overflow-auto">
            {error.message}
          </pre>
          <Button
            onClick={this.resetErrorBoundary}
            className="mt-4 bg-red-600 hover:bg-red-700 text-white"
          >
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Helper function for easier use with hooks
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}