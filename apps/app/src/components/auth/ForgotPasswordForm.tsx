import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Link } from 'react-router'
import { Mail, CheckCircle, Key, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth'
import { AuthLayout } from './AuthLayout'
import { AuthCard } from './AuthCard'
import { TanStackInputField } from '../ui/tanstack-form-field'
import { Button } from '../ui/button'

interface ForgotPasswordFormData {
  email: string
}

export function ForgotPasswordForm() {
  const [emailSent, setEmailSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Implémentation Better Auth forgetPassword
  const handleForgotPassword = async (_data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      // Better Auth forgetPassword avec redirect URL
      await authClient.forgetPassword({
        email: _data.email,
        redirectTo: `${window.location.origin}/auth/reset-password`
      });
      setEmailSent(true);
    } catch (error) {
      toast.error((error as Error).message || 'Erreur lors de l\'envoi de l\'email')
    } finally {
      setIsLoading(false);
    }
  }

  const form = useForm({
    defaultValues: {
      email: '',
    } as ForgotPasswordFormData,
    onSubmit: async ({ value }) => {
      await handleForgotPassword(value)
    },
  })

  if (emailSent) {
    return (
      <AuthLayout
        subtitle="Instructions de récupération envoyées avec succès"
        showBackToLogin={true}
      >
        <AuthCard
          variant="success"
          title="Email de récupération envoyé"
          icon={<CheckCircle className="w-6 h-6 text-success" />}
        >
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Nous venons d'envoyer un lien de réinitialisation à votre adresse email.
                Cliquez sur le lien reçu pour créer un nouveau mot de passe.
              </p>

              <p className="text-sm text-muted-foreground">
                Le lien expire dans 24 heures. Si vous ne recevez rien,
                vérifiez vos courriers indésirables.
              </p>
            </div>

            <Link to="/auth/login">
              <Button variant="default" size="sm" className="w-full">
                Se connecter
              </Button>
            </Link>
          </div>
        </AuthCard>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      subtitle="Récupérez l'accès à votre compte en quelques étapes"
      showBackToLogin={true}
    >
      <AuthCard
        accountType="parent"
        title="Récupération de compte"
        description="Saisissez votre email pour recevoir les instructions de réinitialisation"
        icon={<Key className="w-5 h-5 text-primary" />}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
          className="space-y-6"
        >
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

          <Button
            type="submit"
            variant="default"
            size="lg"
            disabled={isLoading}
            className="w-full group"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Envoi en cours...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>Envoyer le lien de récupération</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            )}
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  )
}
