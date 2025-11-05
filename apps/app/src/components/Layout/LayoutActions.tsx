import type { ReactElement } from 'react';
import { LogOut, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { ModeToggle } from '../mode-toggle';

interface ILayoutActionsProps {
  onLogout: () => void;
  collapsed?: boolean;
  onToggleCollapse?: (() => void) | undefined;
  mobile?: boolean;
  _userRole?: 'parent' | 'student' | undefined;
}

export const LayoutActions = ({
  onLogout,
  collapsed = false,
  onToggleCollapse,
  mobile = false,
  _userRole
}: ILayoutActionsProps): ReactElement => {

  return (
    <div className={`p-4 space-y-4 border-t border-border`}>
      {/* Bouton toggle collapse moderne pour desktop */}
      {!mobile && onToggleCollapse && (
        <Button
          variant="secondary"
          onClick={onToggleCollapse}
          className="w-full h-11 text-sm rounded-lg font-medium gap-2"
          aria-label={collapsed ? 'Développer le menu' : 'Réduire le menu'}
          title={collapsed ? 'Développer le menu' : 'Réduire le menu'}
        >
          {collapsed ? (
            <PanelLeft className="w-4 h-4" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4" />
              <span className="font-medium">Réduire le menu</span>
            </>
          )}
        </Button>
      )}

      {/* Toggle thème */}
      <div className="flex justify-center">
        <ModeToggle />
      </div>

      {/* Bouton de déconnexion moderne */}
      <Button
        variant="destructive"
        onClick={onLogout}
        className={`w-full h-11 rounded-lg font-medium gap-2 ${
          collapsed ? 'px-2' : 'px-4'
        }`}
        aria-label="Se déconnecter"
        title={collapsed ? 'Se déconnecter' : undefined}
      >
        <LogOut className="w-4 h-4" />
        {!collapsed && <span className="font-medium">Déconnexion</span>}
      </Button>
    </div>
  );
};

export default LayoutActions;
