import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { bgColors } from '@/lib/styles';
import { logError } from '@/lib/dev-logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Full structured log for debugging — includes component stack
    console.error(
      '[ErrorBoundary]',
      JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      }, null, 2),
    );
    logError(error, errorInfo.componentStack ?? undefined);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
          <View className="items-center max-w-sm">
            <View className="h-16 w-16 items-center justify-center rounded-full mb-4" style={{ backgroundColor: bgColors.destructive[10] }}>
              <AlertTriangle size={32} color="#DC2626" />
            </View>

            <Text variant="h2" className="text-center mb-2">
              Oups, une erreur s'est produite
            </Text>

            <Text variant="muted" className="text-center mb-6">
              Quelque chose s'est mal passé. Essaie de recharger la page.
            </Text>

            {__DEV__ && this.state.error && (
              <View className="w-full mb-6 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <Text variant="small" className="font-mono text-red-600 dark:text-red-400">
                  {this.state.error.message}
                </Text>
                {this.state.errorInfo?.componentStack && (
                  <Text variant="small" className="font-mono text-red-500 dark:text-red-300 mt-2">
                    {this.state.errorInfo.componentStack.slice(0, 500)}
                  </Text>
                )}
              </View>
            )}

            <Button onPress={this.handleRetry} className="flex-row gap-2">
              <RefreshCw size={18} color="#FFFFFF" />
              <Text className="text-white dark:text-slate-900 font-semibold">
                Réessayer
              </Text>
            </Button>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}
