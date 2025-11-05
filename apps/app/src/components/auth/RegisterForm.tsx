import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Mail, Lock, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { authClient } from '@/lib/auth'
import { GoogleAuthButton } from '../GoogleAuthButton'
import { AuthLayout } from './AuthLayout'
import { AuthCard } from './AuthCard'
import { TanStackInputField, TanStackPasswordField } from '../ui/tanstack-form-field'
import { AuthSeparator } from './atoms/AuthSeparator'
import { AuthSubmitButton } from './molecules/AuthSubmitButton'

interface RegisterFormData {
  email: string
  password: string
  name: string
}

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false)
  const register = async (data: RegisterFormData) => {
    await authClient.signUp.email(data);
  };
  const loginWithGoogle = async () => {
    await authClient.signIn.social({ provider: 'google' });
  };
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      name: '',
    } as RegisterFormData,
    onSubmit: async ({ value }) => {
      setIsLoading(true)
      try {
        await register(value)
      } finally {
        setIsLoading(false)
      }
    },
  })

  return (
    <AuthLayout
      subtitle="Créez votre compte pour suivre la scolarité de vos enfants"
      showBackToLogin={true}
    >
      <AuthCard
        accountType="parent"
        title="Inscription Parentale"
      >
        <div className="space-y-4">

          {/* Formulaire d'Inscription Parents Uniquement */}
          <motion.form
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
            className="space-y-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {/* Nom complet */}
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => {
                  if (!value?.trim()) return 'Votre nom complet est requis'
                  if (value.length < 2) return 'Le nom doit faire au moins 2 caractères'
                  return undefined
                },
              }}
            >
              {(field) => (
                <TanStackInputField
                  field={field}
                  label="Nom complet"
                  type="text"
                  placeholder="Marie Dupont"
                  autoComplete="name"
                  disabled={isLoading}
                  required
                  icon={User}
                />
              )}
            </form.Field>

            {/* Email */}
            <form.Field
              name="email"
              validators={{
                onChange: ({ value }) => {
                  if (!value?.trim()) return 'Votre adresse email est requise'
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Merci de saisir une adresse email valide'
                  return undefined
                },
              }}
            >
              {(field) => (
                <TanStackInputField
                  field={field}
                  label="Adresse email"
                  type="email"
                  placeholder="marie.dupont@gmail.com"
                  autoComplete="email"
                  disabled={isLoading}
                  required
                  icon={Mail}
                />
              )}
            </form.Field>

            {/* Mot de passe */}
            <form.Field
              name="password"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return 'Votre mot de passe est requis'
                  if (value.length < 6) return 'Votre mot de passe doit contenir au moins 6 caractères'
                  return undefined
                },
              }}
            >
              {(field) => (
                <TanStackPasswordField
                  field={field}
                  label="Mot de passe"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isLoading}
                  required
                  icon={Lock}
                  showPassword={showPassword}
                  onTogglePassword={() => setShowPassword(!showPassword)}
                />
              )}
            </form.Field>

            {/* Bouton inscription */}
            <AuthSubmitButton
              isLoading={isLoading}
              loadingText="Création..."
            >
              Créer mon compte parental
            </AuthSubmitButton>
          </motion.form>

          {/* Google Auth */}
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="space-y-4">
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
              />
            </div>
          </motion.div>
        </div>
      </AuthCard>
    </AuthLayout>
  )
}
