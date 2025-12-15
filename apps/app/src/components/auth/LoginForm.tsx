import { useState, useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { Link, useNavigate } from 'react-router'
import { Mail, Lock, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { authClient, useSession } from '@/lib/auth'
import { GoogleAuthButton } from '../GoogleAuthButton'
import { AuthLayout } from './AuthLayout'
import { AuthCard } from './AuthCard'
import { TanStackInputField, TanStackPasswordField } from '../ui/tanstack-form-field'
import { AuthSeparator } from './atoms/AuthSeparator'
import { AuthSubmitButton } from './molecules/AuthSubmitButton'
import { AccountTypeToggle } from './molecules/AccountTypeToggle'
import type { AccountTypeType } from '@/types'

interface LoginFormData {
  identifier: string
  password: string
}

export function LoginForm() {
  const [accountType, setAccountType] = useState<AccountTypeType>('parent')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { refetch } = useSession()

  const login = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      let authResult: { data?: unknown } | null = null;

      if (accountType === 'parent') {
        // Connexion parent par email avec Better Auth
        authResult = await authClient.signIn.email({
          email: data.identifier,
          password: data.password,
          callbackURL: `${window.location.origin}/parent`
        });
      } else {
        // Connexion élève par username - API REST directe
        const baseURL = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000';
        const response = await fetch(`${baseURL}/api/auth/sign-in/username`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            username: data.identifier,
            password: data.password,
          }),
        });

        if (response.ok) {
          // Force la synchronisation de la session Better Auth
          void refetch();

          // Redirection immédiate après synchronisation
          void navigate('/student', { replace: true });
          return;
        } else {
          authResult = null;
        }
      }

      // Vérification du résultat d'authentification
      if (authResult?.data) {
        // Redirection directe vers le dashboard
        const redirectPath = accountType === 'parent' ? '/parent' : '/student';
        void navigate(redirectPath, { replace: true });
      } else {
        setError(accountType === 'parent'
          ? 'Email ou mot de passe incorrect'
          : 'Nom d\'utilisateur ou mot de passe incorrect'
        );
      }
    } catch {
      setError('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: `${window.location.origin}/auth/callback`
      });
    } catch {
      setError('Erreur de connexion Google');
      setIsLoading(false);
    }
  };

  // Configuration UX selon type de compte - Design system OKLCH
  const config = {
    parent: {
      identifierLabel: 'Email',
      identifierPlaceholder: 'marie.dupont@exemple.com',
      identifierType: 'email' as const,
      autoComplete: 'email' as const,
      validation: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      validationMessage: 'Veuillez saisir une adresse email valide',
      buttonText: 'Se connecter',
      welcomeMessage: 'Bienvenue dans votre espace parent',
    },
    student: {
      identifierLabel: 'Nom d\'utilisateur',
      identifierPlaceholder: 'marie_d123',
      identifierType: 'text' as const,
      autoComplete: 'username' as const,
      validation: /.{3,}/,
      validationMessage: 'Le nom d\'utilisateur doit faire au moins 3 caractères',
      buttonText: 'Se connecter',
      welcomeMessage: 'Bon retour parmi nous !',
    }
  }

  const currentConfig = config[accountType]

  const form = useForm({
    defaultValues: {
      identifier: '',
      password: '',
    } as LoginFormData,
    onSubmit: async ({ value }) => {
      setIsLoading(true)
      try {
        await login(value)
      } finally {
        setIsLoading(false)
      }
    },
  })

  // Reset seulement les erreurs quand le type de compte change, préserver les données
  useEffect(() => {
    // Préserver les valeurs actuelles et reset seulement les erreurs
    const currentValues = form.state.values
    form.reset(currentValues)
    setError(null)
  }, [accountType, form])

  return (
    <AuthLayout
      subtitle="Accédez à votre espace Tom"
      showRegisterLink={true}
    >
      <AuthCard
        title="Choisissez votre profil"
        accountType={accountType}
      >
        <div className="space-y-6">

          {/* Sélection type de compte */}
          <AccountTypeToggle
            accountType={accountType}
            onAccountTypeChange={setAccountType}
            disabled={isLoading}
          />

          {/* Formulaire principal - Transitions fluides */}
          <motion.form
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
            className="space-y-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            key={accountType}
          >
            {/* Champ identifiant - UX optimisée */}
            <form.Field
              name="identifier"
              validators={{
                onChange: ({ value }) => {
                  if (!value?.trim()) {
                    return accountType === 'parent'
                      ? 'Votre adresse email est requise'
                      : 'Ton nom d\'utilisateur est requis';
                  }
                  if (accountType === 'parent' && !currentConfig.validation.test(value)) {
                    return currentConfig.validationMessage;
                  }
                  if (accountType === 'student' && !currentConfig.validation.test(value)) {
                    return currentConfig.validationMessage;
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <TanStackInputField
                  field={field}
                  label={currentConfig.identifierLabel}
                  type={currentConfig.identifierType}
                  placeholder={currentConfig.identifierPlaceholder}
                  autoComplete={currentConfig.autoComplete}
                  disabled={isLoading}
                  required
                  icon={accountType === 'parent' ? Mail : User}
                />
              )}
            </form.Field>

            {/* Champ mot de passe - UX optimisée */}
            <form.Field
              name="password"
              validators={{
                onChange: ({ value }) => {
                  if (!value) {
                    return accountType === 'parent'
                      ? 'Votre mot de passe est requis'
                      : 'Ton mot de passe est requis'
                  }
                  if (value.length < 6) {
                    return accountType === 'parent'
                      ? 'Votre mot de passe doit contenir au moins 6 caractères'
                      : 'Ton mot de passe doit faire au moins 6 caractères'
                  }
                  return undefined
                },
              }}
            >
              {(field) => (
                <TanStackPasswordField
                  field={field}
                  label="Mot de passe"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isLoading}
                  required
                  icon={Lock}
                  showPassword={showPassword}
                  onTogglePassword={() => setShowPassword(!showPassword)}
                />
              )}
            </form.Field>

            {/* Lien mot de passe oublié - Collé à l'input, plus discret */}
            <div className="text-right -mt-1">
              <Link
                to="/auth/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 underline-offset-4 hover:underline"
              >
                Mot de passe oublié ?
              </Link>
            </div>

            {/* Affichage erreur globale */}
            {error && (
              <div className="text-sm text-destructive text-center">
                {error}
              </div>
            )}

            {/* Bouton connexion */}
            <AuthSubmitButton
              isLoading={isLoading}
              loadingText="Connexion..."
            >
              {currentConfig.buttonText}
            </AuthSubmitButton>
          </motion.form>

          {/* Google Auth - Solution propre avec transition fluide */}
          <motion.div
            className="overflow-hidden"
            initial={false}
            animate={{
              maxHeight: accountType === 'parent' ? 200 : 0,
              opacity: accountType === 'parent' ? 1 : 0
            }}
            transition={{
              duration: 0.4,
              ease: [0.23, 1, 0.32, 1],
              opacity: { duration: 0.3 }
            }}
          >
            <div className="space-y-3 pt-3">
              <AuthSeparator />

              <GoogleAuthButton
                onClick={async () => {
                  setIsLoading(true)
                  try {
                    await loginWithGoogle()
                  } finally {
                    setIsLoading(false)
                  }
                }}
                isLoading={isLoading}
                className="w-full"
                disabled={accountType !== 'parent'}
              />
            </div>
          </motion.div>
        </div>
      </AuthCard>
    </AuthLayout>

  )
}
