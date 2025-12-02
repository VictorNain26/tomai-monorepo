import { type ReactElement } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import { Toaster } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import { useUser, useSession } from './lib/auth';
import type { ITomUser } from './types';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import OAuthCallback from './pages/OAuthCallback';
import StudentDashboard from './pages/StudentDashboard';
import Chat from './pages/Chat';
import ParentDashboard from './pages/ParentDashboard';
import ChildView from './pages/ChildView';
import Pricing from './pages/Pricing';
import SubscriptionManage from './pages/SubscriptionManage';
import SubscriptionSuccess from './pages/SubscriptionSuccess';
import SubscriptionCancel from './pages/SubscriptionCancel';
import StudentProtectedRoute from './components/StudentProtectedRoute';
import ParentProtectedRoute from './components/ParentProtectedRoute';
import PublicRoute from './components/PublicRoute';
import Layout from './components/Layout';
import { ThemeProvider } from './components/theme-provider';
import { AudioManagerProvider } from './lib/AudioManager';
import { useAuthErrorHandler } from './hooks/useAuthErrorHandler';

// Components

// Redirection intelligente selon l'état de connexion
function DefaultRedirect(): ReactElement {
  const user = useUser();
  const { isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (user) {
    // Si connecté, rediriger vers le dashboard approprié
    const redirectPath = (user as ITomUser).role === 'parent' ? '/parent' : '/student';
    return <Navigate to={redirectPath} replace />;
  }

  // Si non connecté, rediriger vers login
  return <Navigate to="/auth/login" replace />;
}

function AppContent(): ReactElement {
  // Better Auth gère automatiquement la session avec hooks React

  // SUPPRIMÉ: Le cache des matières ne doit se charger que sur le dashboard étudiant
  // L'initialisation se fait maintenant dans Home.tsx (dashboard étudiant uniquement)

  // ✅ PRODUCTION-READY: Gestion automatique des 401 (session invalide/utilisateur supprimé)
  useAuthErrorHandler();

  return (
    <div className="h-full transition-colors bg-muted/30">
      <Toaster
        position="top-right"
        toastOptions={{
          className: "bg-card text-foreground border border-border"
        }}
      />

      <Routes>
        {/* Redirection racine - Architecture propre sans appel de session */}
        <Route path="/" element={<DefaultRedirect />} />

        {/* Routes d'authentification - Protégées contre accès si connecté */}
        <Route element={<PublicRoute />}>
          <Route path="/auth">
            <Route
              path="login"
              element={<Login />}
            />
            <Route
              path="register"
              element={<Register />}
            />
            <Route
              path="callback"
              element={<OAuthCallback />}
            />
          </Route>
        </Route>

        {/* Routes de récupération de mot de passe (sans auth) */}
        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />
        <Route
          path="/auth/forgot-password"
          element={<ForgotPassword />}
        />
        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />
        <Route
          path="/auth/reset-password"
          element={<ResetPassword />}
        />

        {/* Routes étudiants - Protection spécifique */}
        <Route element={<StudentProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/student">
              <Route index element={<StudentDashboard />} />
              <Route path="chat" element={<Chat />} />
            </Route>
          </Route>
        </Route>

        {/* Routes parents - Protection spécifique */}
        <Route element={<ParentProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/parent">
              <Route index element={<ParentDashboard />} />
              <Route path="children/:childId" element={<ChildView />} />
            </Route>
          </Route>
        </Route>

        {/* Routes abonnement - Accessibles aux parents uniquement */}
        <Route element={<ParentProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/subscription">
              <Route path="pricing" element={<Pricing />} />
              <Route path="manage" element={<SubscriptionManage />} />
              <Route path="success" element={<SubscriptionSuccess />} />
              <Route path="cancel" element={<SubscriptionCancel />} />
            </Route>
          </Route>
        </Route>

        {/* Compatibilité anciennes routes */}
        <Route path="/login" element={<Navigate to="/auth/login" replace />} />
        <Route path="/register" element={<Navigate to="/auth/register" replace />} />
        <Route path="/chat" element={<Navigate to="/student" replace />} />
        <Route path="/guide" element={<Navigate to="/student/guide" replace />} />
        <Route path="/parent/children/new" element={<Navigate to="/parent" replace />} />
        <Route path="/parent/children/manage" element={<Navigate to="/parent" replace />} />
        <Route path="/parent/child/:childId" element={<Navigate to="/parent" replace />} />

        {/* Redirection par défaut */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

// Wrapper pour utiliser useLocation dans Router context
function App(): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AudioManagerProvider>
          <Router>
            <AppContent />
            <ReactQueryDevtools initialIsOpen={false} />
          </Router>
        </AudioManagerProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
