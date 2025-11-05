import React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { cn } from '@/lib/utils'

interface AuthCardProps {
  children: React.ReactNode
  title?: string
  description?: string
  icon?: React.ReactNode
  accountType?: 'parent' | 'student' | null
  variant?: 'default' | 'success' | 'error' | 'warning'
  className?: string
}

/**
 * Card d'authentification - Design 2025 glassmorphism
 * Optimisé pour UX moderne avec hiérarchie claire et accessibilité
 */
export function AuthCard({
  children,
  title,
  description,
  icon,
  accountType,
  variant = 'default',
  className,
}: AuthCardProps) {
  // Classes shadcn/ui avec glassmorphism moderne
  const cardStyles = cn(
    // Base glassmorphism
    "border backdrop-blur-xl bg-gradient-to-br text-card-foreground",
    // Shadows for depth
    "shadow-2xl",
    // Spacing et responsivité optimisés
    "p-0",
    // Animations subtiles
    "transition-all duration-300 hover:shadow-3xl",
    // Variant success/error avec glassmorphism
    {
      "border-success/30 from-success/10 to-success/5 shadow-success/20": variant === 'success',
      "border-destructive/30 from-destructive/10 to-destructive/5 shadow-destructive/20": variant === 'error',
      "border-warning/30 from-warning/10 to-warning/5 shadow-warning/20": variant === 'warning',
    },
    // AccountType avec glassmorphism gradients
    {
      "border-primary/30 from-primary/10 via-card/95 to-card/90 shadow-primary/20": accountType === 'parent' && variant === 'default',
      "border-secondary/30 from-secondary/10 via-card/95 to-card/90 shadow-secondary/20": accountType === 'student' && variant === 'default',
      "from-card/95 to-card/90 border-border/50": !accountType && variant === 'default',
    },
    className
  )

  const titleStyles = cn(
    "text-xl font-bold tracking-tight text-center",
    // Couleurs variants - couleurs pleines pour meilleure lisibilité
    {
      "text-success": variant === 'success',
      "text-destructive": variant === 'error',
      "text-warning": variant === 'warning',
      "text-primary": accountType === 'parent' && variant === 'default',
      "text-secondary-foreground": accountType === 'student' && variant === 'default',
      "text-foreground": !accountType && variant === 'default',
    }
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
    >
      <Card className={cardStyles}>
        {(title ?? description) && (
          <CardHeader className="space-y-3 text-center relative">
            {/* Gradient overlay pour depth */}
            <div className="absolute inset-0 bg-gradient-to-b from-background/5 to-transparent pointer-events-none rounded-t-lg" />

            <div className="relative z-10">
              {title && (
                <CardTitle className={titleStyles}>
                  {icon ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-2xl">{icon}</span>
                      <span>{title}</span>
                    </div>
                  ) : (
                    title
                  )}
                </CardTitle>
              )}
              {description && (
                <CardDescription className="text-base text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  {description}
                </CardDescription>
              )}
            </div>
          </CardHeader>
        )}

        <CardContent className="space-y-4 relative">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            {children}
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
