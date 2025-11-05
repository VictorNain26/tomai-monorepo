import React, { useState, useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { useSearchParams, Link, useNavigate } from 'react-router'
import { Lock, AlertCircle, Shield } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth'
import { Button } from '../ui/button'
import { AuthLayout } from './AuthLayout'
import { AuthCard } from './AuthCard'
import { TanStackPasswordField } from '../ui/tanstack-form-field'
import { PasswordStrengthIndicator } from './molecules/PasswordStrengthIndicator'
import { AuthSubmitButton } from './molecules/AuthSubmitButton'

interface ResetPasswordFormData {
  password: string
  confirmPassword: string
}

export function ResetPasswordForm() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [tokenValid, setTokenValid] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setTokenValid(false)
    }
  }, [token])

  // Implémentation Better Auth resetPassword
  const handleResetPassword = async (_data: ResetPasswordFormData) => {
    if (!token) {
      throw new Error('Token manquant')
    }
    setIsLoading(true);
    try {
      // Better Auth resetPassword avec token et nouveau mot de passe
      await authClient.resetPassword({
        token,
        newPassword: _data.password
      });

      toast.success('Mot de passe mis à jour avec succès !');

      // Redirection vers login après réinitialisation réussie
      setTimeout(() => {
        void navigate('/auth/login', { replace: true });
      }, 1500);
    } catch (error) {
      toast.error((error as Error).message || 'Erreur lors de la réinitialisation')
    } finally {
      setIsLoading(false);
    }
  }

  const form = useForm({
    defaultValues: {
      password: '',
      confirmPassword: '',
    } as ResetPasswordFormData,
    onSubmit: async ({ value }) => {
      await handleResetPassword(value)
    },
  })

  if (!tokenValid) {
    return (
      <AuthLayout
        subtitle="Ce lien de récupération n'est plus valide"
        showBackToLogin={true}
      >
        <AuthCard
          variant="error"
          title="Lien de récupération expiré"
          icon={<AlertCircle className="w-6 h-6 text-destructive" />}
        >
          <div className="space-y-6">
            <motion.div
              className="text-center space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-muted-foreground">
                Ce lien de récupération est expiré ou invalide.
                Pour des raisons de sécurité, les liens expirent après 24 heures.
              </p>

              <p className="text-sm text-muted-foreground">
                Demandez un nouveau lien pour réinitialiser votre mot de passe.
              </p>
            </motion.div>

            <div className="space-y-3">
              <Link to="/auth/forgot-password">
                <Button className="w-full h-12">
                  Renvoyer un lien de récupération
                </Button>
              </Link>

              <Link to="/auth/login">
                <Button variant="outline" className="w-full h-12">
                  Se connecter
                </Button>
              </Link>
            </div>
          </div>
        </AuthCard>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      subtitle="Définissez votre nouveau mot de passe sécurisé"
      showBackToLogin={true}
    >
      <AuthCard
        title="Nouveau mot de passe"
        description="Choisissez un mot de passe d'au moins 6 caractères pour sécuriser votre compte"
        icon={<Shield className="w-5 h-5 text-primary" />}
      >
        <motion.form
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
          className="space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {/* Indicateurs de sécurité */}
          <PasswordStrengthIndicator password={form.state.values.password} />

          <form.Field
            name="password"
            validators={{
              onChange: ({ value }) => {
                if (!value) return 'Mot de passe requis'
                if (value.length < 8) return 'Mot de passe trop court (min. 8 caractères)'
                if (!/[A-Z]/.test(value)) return 'Doit contenir au moins une majuscule'
                if (!/[a-z]/.test(value)) return 'Doit contenir au moins une minuscule'
                if (!/[0-9]/.test(value)) return 'Doit contenir au moins un chiffre'
                return undefined
              },
            }}
          >
            {(field) => (
              <TanStackPasswordField
                field={field}
                label="Nouveau mot de passe"
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

          <form.Field
            name="confirmPassword"
            validators={{
              onChange: ({ value, fieldApi }) => {
                if (!value) return 'Confirmation du mot de passe requise'
                const password = fieldApi.form.getFieldValue('password')
                if (value !== password) return 'Les mots de passe ne correspondent pas'
                return undefined
              },
            }}
          >
            {(field) => (
              <TanStackPasswordField
                field={field}
                label="Confirmer le mot de passe"
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={isLoading}
                required
                icon={Lock}
                showPassword={showConfirmPassword}
                onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            )}
          </form.Field>

          <AuthSubmitButton
            isLoading={isLoading}
            loadingText="Modification en cours..."
          >
            Confirmer le nouveau mot de passe
          </AuthSubmitButton>
        </motion.form>
      </AuthCard>
    </AuthLayout>
  )
}
