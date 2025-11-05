import type { ReactElement } from 'react';
import { DollarSign } from 'lucide-react';
import { formatCost, getCostColor } from '@/utils/costUtils';
import type { UserRoleType, ICostTracking } from '@/types';
import { cn } from '@/lib/utils';

interface ILayoutMonthlyCostProps {
 monthlyCosts?: ICostTracking | null | undefined;
 userRole?: UserRoleType;
}

export const LayoutMonthlyCost = ({ monthlyCosts, userRole }: ILayoutMonthlyCostProps): ReactElement | null => {
 // Ne pas afficher les coûts aux étudiants
 if (userRole === 'student' || monthlyCosts?.currentMonthCost === undefined) {
 return null;
 }

 return (
 <div className={`px-4 py-3 border-t border-border`}>
 <div className="p-3 rounded-lg border bg-card backdrop-blur-sm">
 <div className="flex items-center justify-between text-sm">
 <div className="flex items-center gap-2">
 <div className={`w-5 h-5 rounded-sm flex items-center justify-center shrink-0 bg-muted`}>
 <DollarSign className={`w-3 h-3 text-muted-foreground`} />
 </div>
 <span className={`font-medium text-foreground`}>Ce mois</span>
 </div>
 <span className={cn("font-semibold", getCostColor(monthlyCosts.currentMonthCost))}>
 {formatCost(monthlyCosts.currentMonthCost)} / 20€
 </span>
 </div>

 {/* Barre de progression visuelle */}
 <div className="mt-2 space-y-1">
 <div className={`w-full rounded-full h-1.5 bg-muted/20`}>
 <div
 className="h-1.5 rounded-full transition-all duration-500 ease-out bg-primary"
 style={{
 width: `${Math.min((monthlyCosts.currentMonthCost / 20) * 100, 100)}%`
 }}
 />
 </div>
 <div className={`flex justify-between text-xs text-muted-foreground`}>
 <span>0€</span>
 <span>20€</span>
 </div>
 </div>
 </div>
 </div>
 );
};

export default LayoutMonthlyCost;

/**
 * LayoutMonthlyCost Component - Architecture 2025
 *
 * Features:
 * - Barre de progression visuelle pour budget
 * - Animation fluide de progression
 * - Classes design system modulaires
 * - Masquage automatique pour étudiants
 * - Indicateurs visuels de dépassement
 */
