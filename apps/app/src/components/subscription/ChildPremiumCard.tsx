/**
 * ChildPremiumCard - Carte enfant avec statut et actions premium
 */

import type { ReactElement } from 'react';
import { Crown, Plus, Minus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { IChild } from '@/types';
import type { ActionType } from './SubscriptionActionDialog';

interface ChildPremiumCardProps {
  child: IChild;
  isPremium: boolean;
  isPendingRemoval: boolean;
  cancelAtPeriodEnd: boolean;
  onAction: (type: ActionType, child: IChild) => void;
}

export function ChildPremiumCard({
  child,
  isPremium,
  isPendingRemoval,
  cancelAtPeriodEnd,
  onAction,
}: ChildPremiumCardProps): ReactElement {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border transition-colors',
        isPremium
          ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
          : 'bg-muted/30 border-border'
      )}
    >
      {/* Child info */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Avatar/Icon */}
        <div className={cn(
          'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
          isPremium
            ? 'bg-amber-100 dark:bg-amber-900/50'
            : 'bg-muted'
        )}>
          {isPremium ? (
            <Crown className="h-5 w-5 text-amber-500" />
          ) : (
            <span className="text-lg font-semibold text-muted-foreground">
              {child.firstName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Name and details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{child.firstName}</span>
            {isPendingRemoval && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 whitespace-nowrap">
                Retrait prévu
              </Badge>
            )}
          </div>
          {child.schoolLevel && (
            <p className="text-sm text-muted-foreground">{child.schoolLevel}</p>
          )}
        </div>
      </div>

      {/* Action button based on child status */}
      <div className="flex-shrink-0 sm:ml-4">
        {isPremium ? (
          isPendingRemoval ? (
            // Child is premium but scheduled for removal - can reactivate
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              onClick={() => onAction('reactivate', child)}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Réactiver
            </Button>
          ) : !cancelAtPeriodEnd ? (
            // Child is premium, not pending removal, subscription active - can remove
            <Button
              variant="ghost"
              size="sm"
              className="w-full sm:w-auto text-muted-foreground hover:text-destructive"
              onClick={() => onAction('remove', child)}
            >
              <Minus className="h-4 w-4 mr-2" />
              Retirer
            </Button>
          ) : null
        ) : !cancelAtPeriodEnd ? (
          // Child is not premium, subscription active - can add
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => onAction('add', child)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter Premium
          </Button>
        ) : null}
      </div>
    </div>
  );
}
