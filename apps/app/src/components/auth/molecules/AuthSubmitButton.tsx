/**
 * AuthSubmitButton - Molecule bouton submit auth
 *
 * Bouton avec loading state et animations pour formulaires auth
 */

import { type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface AuthSubmitButtonProps {
  isLoading: boolean;
  loadingText?: string;
  children: ReactNode;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'secondary';
  className?: string;
}

export function AuthSubmitButton({
  isLoading,
  loadingText = 'Chargement...',
  children,
  disabled = false,
  variant = 'default',
  className = 'w-full'
}: AuthSubmitButtonProps) {
  return (
    <Button
      type="submit"
      variant={variant}
      size="lg"
      disabled={isLoading || disabled}
      className={`group ${className}`}
    >
      {isLoading ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>{loadingText}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span>{children}</span>
          <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
        </div>
      )}
    </Button>
  );
}
