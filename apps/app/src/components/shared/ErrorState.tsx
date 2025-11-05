/**
 * ErrorState - État Erreur Réutilisable
 *
 * Composant d'erreur standardisé avec retry et navigation.
 * Adapté au mode scolaire et actions personnalisables.
 */

import { type ReactElement } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | unknown;
  mode?: 'primary' | 'college' | 'lycee';
  onRetry?: () => void;
  onBack?: () => void;
  retryLabel?: string;
  backLabel?: string;
  className?: string;
}

export function ErrorState({
  title,
  description,
  error,
  mode = 'lycee',
  onRetry,
  onBack,
  retryLabel,
  backLabel,
  className
}: ErrorStateProps): ReactElement {
  const defaultTitle =
    mode === 'primary'
      ? 'Oups ! Une erreur est survenue'
      : 'Erreur de chargement';

  const defaultDescription =
    mode === 'primary'
      ? 'Quelque chose ne va pas. Réessaie dans quelques instants !'
      : 'Une erreur est survenue lors du chargement des données.';

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : undefined;

  return (
    <Card className={cn('border-destructive/20 bg-destructive/5', className)}>
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          ❌ {title ?? defaultTitle}
        </CardTitle>
        <CardDescription>
          {description ?? defaultDescription}
          {errorMessage && ` ${errorMessage}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {onRetry && (
            <Button
              variant="default"
              onClick={onRetry}
              className="gap-2 min-h-[44px]"
            >
              🔄 {retryLabel ?? 'Réessayer'}
            </Button>
          )}
          {onBack && (
            <Button variant="outline" onClick={onBack} className="min-h-[44px]">
              {backLabel ?? 'Retour'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
