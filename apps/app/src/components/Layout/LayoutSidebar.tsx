/**
 * LayoutSidebar - Sidebar moderne avec glassmorphism
 *
 * Design 2025 : backdrop-blur, gradients subtils, micro-interactions
 * Utilise le système de couleurs centralisé (config/theme.ts)
 */

import type { ReactElement } from 'react';
import type { ICostTracking, IAppUser } from '@/types';
import LayoutLogo from './LayoutLogo';
import LayoutUserInfo from './LayoutUserInfo';
import LayoutNavigation, { type INavigationItem } from './LayoutNavigation';
import LayoutMonthlyCost from './LayoutMonthlyCost';
import LayoutSubscriptionBadge from './LayoutSubscriptionBadge';
import LayoutActions from './LayoutActions';
import { cn } from '@/lib/utils';

interface ILayoutSidebarProps {
  user: IAppUser | null;
  navigation: INavigationItem[];
  monthlyCosts?: ICostTracking | null;
  onLogout: () => void;
  onNavItemClick: () => void;
  collapsed?: boolean;
  onToggleCollapse?: (() => void) | undefined;
  mobile?: boolean;
}

export const LayoutSidebar = ({
  user,
  navigation,
  monthlyCosts,
  onLogout,
  onNavItemClick,
  collapsed = false,
  onToggleCollapse,
  mobile = false
}: ILayoutSidebarProps): ReactElement => {
  return (
    <div
      className={cn(
        'flex flex-col h-full relative overflow-hidden',
        // Glassmorphism effect
        'bg-gradient-to-b from-card/95 to-card/90',
        'backdrop-blur-md',
        // Modern border with subtle glow
        'border-r border-border/50',
        // Shadow for depth
        'shadow-xl'
      )}
    >
      {/* Gradient overlay pour depth - Bleu (Parent) + Vert (Élève) */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 pointer-events-none" />

      {/* Content avec z-index au-dessus de l'overlay */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header Section - Glassmorphism */}
        <div
          className={cn(
            'flex-shrink-0 p-4',
            'border-b border-border/30',
            'bg-gradient-to-r from-background/50 to-transparent',
            'backdrop-blur-sm'
          )}
        >
          <LayoutLogo collapsed={collapsed} mobile={mobile} />
          {!collapsed && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <LayoutUserInfo user={user} />
            </div>
          )}
        </div>

        {/* Main Navigation - Smooth scrolling */}
        <div className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-border/30 scrollbar-track-transparent">
          <LayoutNavigation
            navigation={navigation}
            user={user}
            onItemClick={onNavItemClick}
            collapsed={collapsed}
          />
        </div>

        {/* Footer Section - Glassmorphism */}
        <div
          className={cn(
            'flex-shrink-0 mt-auto',
            'border-t border-border/30',
            'bg-gradient-to-t from-background/50 to-transparent',
            'backdrop-blur-sm'
          )}
        >
          {/* Subscription Badge */}
          <LayoutSubscriptionBadge collapsed={collapsed} />

          {!collapsed && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <LayoutMonthlyCost
                monthlyCosts={monthlyCosts}
                {...(user?.role && { userRole: 'parent' /* user.role */ })}
              />
            </div>
          )}
          <LayoutActions
            onLogout={onLogout}
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
            mobile={mobile}
            _userRole={user?.role as 'parent' | 'student' | undefined}
          />
        </div>
      </div>
    </div>
  );
};

export default LayoutSidebar;
