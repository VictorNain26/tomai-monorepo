/**
 * AuthSeparator - Atom séparateur avec texte central
 *
 * Séparateur "ou" avec lignes horizontales pour auth forms
 */

import { Separator } from '@/components/ui/separator';

export interface AuthSeparatorProps {
  text?: string;
}

export function AuthSeparator({ text = 'ou' }: AuthSeparatorProps) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <Separator className="w-full" />
      </div>
      <div className="relative flex justify-center text-xs font-medium">
        <span className="bg-card px-3 text-muted-foreground">{text}</span>
      </div>
    </div>
  );
}
