import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { bgColors, colors } from '@/lib/styles';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to monitoring service
    console.error('ErrorBoundary caught:', error, errorInfo);
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
        <View className="flex-1 items-center justify-center bg-background p-6">
          <View className="items-center max-w-sm">
            <View className="h-16 w-16 items-center justify-center rounded-full mb-4" style={{ backgroundColor: bgColors.destructive[10] }}>
              <AlertTriangle size={32} color={colors.destructive.DEFAULT} />
            </View>

            <Text variant="h2" className="text-center mb-2">
              Oups, une erreur s'est produite
            </Text>

            <Text variant="muted" className="text-center mb-6">
              Quelque chose s'est mal passé. Essaie de recharger la page.
            </Text>

            {__DEV__ && this.state.error && (
              <View className="w-full mb-6 p-3 bg-muted rounded-lg">
                <Text variant="small" className="font-mono text-destructive">
                  {this.state.error.message}
                </Text>
              </View>
            )}

            <Button onPress={this.handleRetry} className="flex-row gap-2">
              <RefreshCw size={18} color={colors.primary.foreground} />
              <Text className="text-primary-foreground font-semibold">
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
