import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router'
import { Brain } from 'lucide-react'
import { ModeToggle } from '../mode-toggle'

interface AuthLayoutProps {
  children: React.ReactNode
  subtitle?: string
  showBackToLogin?: boolean
  showRegisterLink?: boolean
}

/**
 * Layout unifié pour l'authentification - Design 2025 glassmorphism
 * Optimisé UX moderne avec hiérarchie claire et micro-interactions
 */
export function AuthLayout({
  children,
  subtitle,
  showBackToLogin = false,
  showRegisterLink = false,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen supports-[min-height:100dvh]:min-h-[100dvh] bg-gradient-to-br from-background via-background to-muted/20">
      {/* Toggle thème - Position fixe optimale */}
      <div className="fixed top-6 right-6 z-50">
        <ModeToggle />
      </div>

      {/* Background glassmorphism moderne avec orbs animés - Bleu (Parent) + Vert (Élève) */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/5 to-muted/10" />
        {/* Orb Parent (Bleu) - Gauche */}
        <div className={`absolute top-20 left-10 w-72 h-72 rounded-full bg-gradient-to-br from-primary/10 via-primary/5 to-transparent blur-3xl animate-pulse`} />
        {/* Orb Élève (Vert) - Droite */}
        <div className={`absolute bottom-20 right-10 w-96 h-96 rounded-full bg-gradient-to-tl from-secondary/10 via-secondary/5 to-transparent blur-3xl animate-pulse`} style={{ animationDelay: '1s' }} />
      </div>

      {/* Container principal centré - Standards responsive */}
      <div className="relative flex min-h-screen supports-[min-height:100dvh]:min-h-[100dvh] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          className="w-full max-w-md space-y-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        >
          {/* Header compact - Logo centré sans wording inutile */}
          <div className="text-center space-y-3">
            <motion.div
              className="flex flex-col items-center space-y-3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1, type: 'spring', stiffness: 100 }}
            >
              {/* Logo TomAI avec glassmorphism moderne */}
              <div className="flex items-center space-x-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent backdrop-blur-sm ring-2 ring-primary/30 shadow-lg shadow-primary/20 transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-primary/30">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                  TomAI
                </h1>
              </div>
            </motion.div>

            {/* Subtitle contextualisé - Plus compact */}
            {subtitle && (
              <motion.p
                className="text-sm text-muted-foreground max-w-xs mx-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                {subtitle}
              </motion.p>
            )}
          </div>

          {/* Contenu principal - shadcn/ui Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            {children}
          </motion.div>

          {/* Navigation - Hiérarchie secondaire claire */}
          {(showRegisterLink || showBackToLogin) && (
            <motion.div
              className="text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              {showRegisterLink && (
                <p className="text-sm text-muted-foreground">
                  Pas encore de compte ?{' '}
                  <Link
                    to="/auth/register"
                    className="font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
                  >
                    S'inscrire
                  </Link>
                </p>
              )}
              {showBackToLogin && (
                <p className="text-sm text-muted-foreground">
                  Déjà un compte ?{' '}
                  <Link
                    to="/auth/login"
                    className="font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
                  >
                    Se connecter
                  </Link>
                </p>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
