import { useNavigate, Outlet, useLocation } from 'react-router';
import { Home, BarChart3, X, Trophy } from 'lucide-react';
import { type ReactElement, useState, createContext, useContext, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUser, authClient } from '@/lib/auth';
import { type IAppUser, isITomAIUser } from '@/types';

import { useEducationalTheme } from '@/hooks/useEducationalTheme';
import { Button } from './ui/button';
import { ModeToggle } from './mode-toggle';
import LayoutUserInfo from './Layout/LayoutUserInfo';
import LayoutMobileMenu from './Layout/LayoutMobileMenu';

// Context pour le menu mobile partagé entre Layout et PageHeader
interface MobileMenuContextType {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

const MobileMenuContext = createContext<MobileMenuContextType | null>(null);

// Hook exporté pour utilisation dans d'autres composants (PageHeader)
// eslint-disable-next-line react-refresh/only-export-components
export const useMobileMenu = () => {
  const context = useContext(MobileMenuContext);
  if (!context) {
    throw new Error('useMobileMenu must be used within Layout');
  }
  return context;
};

// Navigation simplifiée selon le rôle
const getNavigation = (user: IAppUser | null) => {
  if (!isITomAIUser(user)) {
    return [];
  }

  if (user.role === 'student') {
    return [
      { name: 'Accueil', href: '/student', icon: Home },
      { name: 'Mes Badges', href: '/student/badges', icon: Trophy }
    ];
  }

  if (user.role === 'parent') {
    return [
      { name: 'Dashboard', href: '/parent', icon: BarChart3 }
    ];
  }

  return [];
};

function Layout(): ReactElement {
  const user = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  useEducationalTheme(); // Active automatiquement le thème parent/étudiant
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigation = getNavigation(user as IAppUser | null);

  const handleLogout = async () => {
    // Documentation officielle Better Auth - Pattern onSuccess recommandé
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          void navigate('/auth/login');
        },
      },
    });
  };

  // Contexte du menu mobile pour partage avec PageHeader (memoized pour éviter re-renders)
  const mobileMenuContext: MobileMenuContextType = useMemo(() => ({
    isOpen: isMobileMenuOpen,
    toggle: () => setIsMobileMenuOpen(prev => !prev),
    open: () => setIsMobileMenuOpen(true),
    close: () => setIsMobileMenuOpen(false)
  }), [isMobileMenuOpen]);

  // Détecter si on est sur une page avec PageHeader (chat)
  const isPageWithHeader = location.pathname.includes('/chat');

  // Utilise le système de thème éducatif avec CSS Variables
  // Les couleurs sont gérées automatiquement par useEducationalTheme()
  // Parent: Bleu professionnel | Étudiant: Vert motivant

  return (
    <MobileMenuContext.Provider value={mobileMenuContext}>
      <div className="h-screen flex bg-background text-foreground">
        {/* Mobile Menu Button - FAB pour pages sans PageHeader uniquement */}
        {!isPageWithHeader && (
          <AnimatePresence>
            {!isMobileMenuOpen && (
              <motion.div
                key="burger-button"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{
                  duration: 0.15,
                  ease: "easeOut"
                }}
              >
                <LayoutMobileMenu
                  isMobileMenuOpen={isMobileMenuOpen}
                  onToggle={mobileMenuContext.toggle}
                  positionClassName="fixed bottom-4 right-4"
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}

      {/* Sidebar Desktop - Fixed */}
      <aside className="hidden md:block fixed inset-y-0 z-50 w-64">
        <div className="h-full flex flex-col bg-sidebar border-r border-border">

          {/* Header - Logo simple */}
          <header className="flex h-14 items-center px-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                T
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-sidebar-foreground">TomIA</span>
                <span className="text-xs text-muted-foreground">Assistant IA</span>
              </div>
            </div>
          </header>

          {/* Navigation principale */}
          <div className="flex-1 overflow-auto">
            <nav className="p-2 space-y-1">
              {navigation.map((item) => {
                const IconComponent = item.icon;
                const isActive = location.pathname === item.href;

                return (
                  <Button
                    key={item.name}
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start gap-3 h-9"
                    onClick={() => navigate(item.href)}
                  >
                    <IconComponent className="h-4 w-4" />
                    <span className="font-medium">{item.name}</span>
                  </Button>
                );
              })}
            </nav>
          </div>

          {/* User Profile Card */}
          <div className="p-3 border-t border-border/50">
            <LayoutUserInfo user={user as IAppUser | null} />
          </div>

          {/* Actions Footer */}
          <footer className="p-3 border-t border-border/50">
            <div className="flex items-center gap-2">
              <ModeToggle />
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex-1 h-8"
              >
                Déconnexion
              </Button>
            </div>
          </footer>

        </div>
      </aside>

      {/* Mobile Sidebar Overlay - Animated slide-in/out + backdrop fade */}
      <AnimatePresence mode="wait">
        {isMobileMenuOpen && (
          <motion.div
            key="mobile-sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 md:hidden"
          >
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.aside
              key="mobile-sidebar"
              initial={{ x: -264 }}
              animate={{ x: 0 }}
              exit={{ x: -264 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
                duration: 0.3
              }}
              className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-border"
            >
              <div className="h-full flex flex-col">

              {/* Mobile Header - Logo simple */}
              <header className="flex h-14 items-center justify-between px-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                    T
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-sidebar-foreground">TomIA</span>
                    <span className="text-xs text-muted-foreground">Assistant IA</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="h-8 w-8 hover:rotate-90 hover:scale-110 transition-all duration-200 active:scale-95"
                >
                  <X className="h-4 w-4" />
                </Button>
              </header>

              {/* Mobile Navigation */}
              <div className="flex-1 overflow-auto">
                <nav className="p-2 space-y-1">
                  {navigation.map((item) => {
                    const IconComponent = item.icon;
                    const isActive = location.pathname === item.href;

                    return (
                      <Button
                        key={item.name}
                        variant={isActive ? "secondary" : "ghost"}
                        className="w-full justify-start gap-3 h-9"
                        onClick={() => {
                          void navigate(item.href);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <IconComponent className="h-4 w-4" />
                        <span className="font-medium">{item.name}</span>
                      </Button>
                    );
                  })}
                </nav>
              </div>

              {/* Mobile User Profile */}
              <div className="p-3 border-t border-border/50">
                <LayoutUserInfo user={user as IAppUser | null} />
              </div>

              {/* Mobile Actions Footer */}
              <footer className="p-3 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <ModeToggle />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="flex-1 h-8"
                  >
                    Déconnexion
                  </Button>
                </div>
              </footer>

              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

        {/* Main Content Area */}
        <main className="flex-1 md:ml-64 h-screen overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </MobileMenuContext.Provider>
  );
}

export default Layout;
