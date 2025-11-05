import type { ReactElement } from 'react';
import { useUser } from '@/lib/auth';

interface ILayoutLogoProps {
  collapsed?: boolean;
  mobile?: boolean;
}

export const LayoutLogo = ({ collapsed = false, mobile: _mobile = false }: ILayoutLogoProps): ReactElement => {
  const _user = useUser();

  return (
    <div className="flex items-center gap-3 p-4 border-b border-border">
      <div className="flex items-center gap-3 min-w-0">
        {/* Modern Logo with role-based colors */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden shadow-md transition-all duration-300 hover:shadow-lg hover:scale-105 bg-primary">
          <span className="text-primary-foreground font-bold text-lg relative z-10">T</span>
          <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-white to-transparent rounded-xl" />
        </div>

        {!collapsed && (
          <div className="min-w-0 animate-fade-in">
            <h1 className="text-lg font-bold truncate transition-colors duration-200 text-foreground">
              TomIA
            </h1>
            <p className="text-xs truncate transition-colors duration-200 text-muted-foreground">
              Tuteur Socratique IA
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LayoutLogo;
