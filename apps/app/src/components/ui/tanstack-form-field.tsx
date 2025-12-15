/**
 * Perfect integration between TanStack Form and ShadCN components
 * Following official patterns for type-safe form fields
 */

import * as React from "react"
import { FieldApi } from "@tanstack/react-form"
import { Eye as EyeIcon, EyeOff as EyeOffIcon, type LucideIcon } from "lucide-react"
import { Label } from "./label"
import { Input } from "./input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"
import { cn } from "@/lib/utils"

// Type helper pour TanStack Form FieldApi - utilise les types par défaut
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFieldApi = FieldApi<any, any, any, any, any, any, any, any, any, any, any, any, any, any, any, any, any, any, any, any, any, any, any>

interface TanStackFormFieldProps {
  field: AnyFieldApi
  children: React.ReactNode
}

interface TanStackInputFieldProps {
  field: AnyFieldApi
  label: string
  placeholder?: string
  type?: React.HTMLInputTypeAttribute
  disabled?: boolean
  className?: string
  id?: string
  autoComplete?: string
  required?: boolean
  icon?: LucideIcon
}

// Main form field wrapper for TanStack + ShadCN integration
export function TanStackFormField({ field, children }: TanStackFormFieldProps) {
  const hasError = field.state.meta.errors.length > 0
  const errorId = hasError ? `${field.name}-error` : undefined

  return (
    <div className="space-y-1">
      {children}
      {hasError && (
        <p
          id={errorId}
          className="text-xs font-medium text-destructive mt-1.5"
          role="alert"
          aria-live="polite"
        >
          {field.state.meta.errors[0]}
        </p>
      )}
    </div>
  )
}

// Input field with perfect ShadCN + TanStack integration
export function TanStackInputField({
  field,
  label,
  placeholder,
  type = "text",
  disabled = false,
  className,
  id,
  autoComplete,
  required = false,
  icon: Icon,
}: TanStackInputFieldProps) {
  const fieldId = id ?? `field-${field.name}`
  const hasError = field.state.meta.errors.length > 0
  const errorId = hasError ? `${field.name}-error` : undefined

  return (
    <TanStackFormField field={field}>
      <Label htmlFor={fieldId}>
        {label}
        {required && <span className="text-destructive ml-1" aria-label="requis">*</span>}
      </Label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
        )}
        <Input
          id={fieldId}
          type={type}
          value={field.state.value}
          onChange={(e) => field.handleChange(e.target.value)}
          onBlur={field.handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={hasError}
          aria-describedby={errorId}
          className={cn(
            Icon && "pl-10",
            hasError && "border-destructive focus-visible:ring-destructive",
            className
          )}
        />
      </div>
    </TanStackFormField>
  )
}

// Password field with toggle visibility and strength indicator
interface TanStackPasswordFieldProps extends Omit<TanStackInputFieldProps, 'type'> {
  showPassword: boolean
  onTogglePassword: () => void
  toggleIcon?: {
    show: LucideIcon
    hide: LucideIcon
  }
  showStrengthIndicator?: boolean
  suggestStrongPassword?: boolean
}

// Fonction utilitaire pour calculer la force du mot de passe
function calculatePasswordStrength(password: string): {
  score: number
  level: 'weak' | 'fair' | 'good' | 'strong'
  feedback: string[]
} {
  let score = 0
  const feedback: string[] = []

  if (password.length >= 8) score += 1
  else feedback.push('Au moins 8 caractères')

  if (/[a-z]/.test(password)) score += 1
  else feedback.push('Une lettre minuscule')

  if (/[A-Z]/.test(password)) score += 1
  else feedback.push('Une lettre majuscule')

  if (/[0-9]/.test(password)) score += 1
  else feedback.push('Un chiffre')

  if (/[^A-Za-z0-9]/.test(password)) score += 1
  else feedback.push('Un caractère spécial')

  if (password.length >= 12) score += 1

  const levels = {
    0: 'weak' as const,
    1: 'weak' as const,
    2: 'fair' as const,
    3: 'good' as const,
    4: 'good' as const,
    5: 'strong' as const,
    6: 'strong' as const,
  }

  return {
    score,
    level: levels[score as keyof typeof levels],
    feedback
  }
}

export function TanStackPasswordField({
  field,
  label,
  placeholder = "••••••••",
  disabled = false,
  className,
  id,
  autoComplete = "current-password",
  required = false,
  icon: Icon,
  showPassword,
  onTogglePassword,
  toggleIcon,
  showStrengthIndicator = false,
  suggestStrongPassword = false,
}: TanStackPasswordFieldProps) {
  const fieldId = id ?? `field-${field.name}`
  const hasError = field.state.meta.errors.length > 0
  const errorId = hasError ? `${field.name}-error` : undefined
  const strengthId = showStrengthIndicator ? `${field.name}-strength` : undefined
  const passwordStrength = showStrengthIndicator ? calculatePasswordStrength(field.state.value ?? '') : null

  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    field.handleChange(password)
  }

  // Combine aria-describedby IDs
  const describedBy = [errorId, strengthId].filter(Boolean).join(' ') || undefined

  return (
    <TanStackFormField field={field}>
      <div className="flex items-center justify-between mb-2">
        <Label htmlFor={fieldId} className="mb-0">
          {label}
          {required && <span className="text-destructive ml-1" aria-label="requis">*</span>}
        </Label>
        {suggestStrongPassword && (
          <button
            type="button"
            onClick={generateStrongPassword}
            className="text-xs text-primary hover:text-primary/80 underline-offset-4 hover:underline focus-ring rounded-sm"
            aria-label="Générer automatiquement un mot de passe sécurisé"
          >
            Générer un mot de passe fort
          </button>
        )}
      </div>

      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
        )}
        <Input
          id={fieldId}
          type={showPassword ? 'text' : 'password'}
          value={field.state.value}
          onChange={(e) => field.handleChange(e.target.value)}
          onBlur={field.handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={hasError}
          aria-describedby={describedBy}
          className={cn(
            Icon && "pl-10",
            "pr-10",
            hasError && "border-destructive focus-visible:ring-destructive",
            className
          )}
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-ring rounded-sm"
          onClick={onTogglePassword}
          aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          tabIndex={0}
        >
          {showPassword ? (
            toggleIcon?.hide ? <toggleIcon.hide className="w-4 h-4" /> : <EyeOffIcon className="w-4 h-4" />
          ) : (
            toggleIcon?.show ? <toggleIcon.show className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Indicateur de force du mot de passe accessible */}
      {showStrengthIndicator && passwordStrength && field.state.value && (
        <div
          id={strengthId}
          className="mt-2 space-y-2"
          role="status"
          aria-label={`Force du mot de passe: ${passwordStrength.level === 'weak' ? 'Faible' : passwordStrength.level === 'fair' ? 'Correct' : passwordStrength.level === 'good' ? 'Bon' : 'Fort'}`}
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  passwordStrength.level === 'weak' && 'w-1/4 bg-destructive',
                  passwordStrength.level === 'fair' && 'w-2/4 bg-warning',
                  passwordStrength.level === 'good' && 'w-3/4 bg-warning',
                  passwordStrength.level === 'strong' && 'w-full bg-success'
                )}
              />
            </div>
            <span className={cn(
              "text-xs font-medium",
              passwordStrength.level === 'weak' && 'text-destructive',
              passwordStrength.level === 'fair' && 'text-warning',
              passwordStrength.level === 'good' && 'text-warning',
              passwordStrength.level === 'strong' && 'text-success'
            )}>
              {passwordStrength.level === 'weak' && 'Faible'}
              {passwordStrength.level === 'fair' && 'Correct'}
              {passwordStrength.level === 'good' && 'Bon'}
              {passwordStrength.level === 'strong' && 'Fort'}
            </span>
          </div>

          {passwordStrength.feedback.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span>Manque : </span>
              {passwordStrength.feedback.join(', ')}
            </div>
          )}
        </div>
      )}
    </TanStackFormField>
  )
}

// Select field with perfect ShadCN + TanStack integration
interface TanStackSelectFieldProps {
  field: AnyFieldApi
  label: string
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  required?: boolean
  icon?: LucideIcon
  options: Array<{ value: string; label: string }>
}

export function TanStackSelectField({
  field,
  label,
  placeholder = "Sélectionner...",
  disabled = false,
  className,
  id,
  required = false,
  icon: Icon,
  options,
}: TanStackSelectFieldProps) {
  const fieldId = id ?? `field-${field.name}`
  const hasError = field.state.meta.errors.length > 0

  return (
    <TanStackFormField field={field}>
      <Label htmlFor={fieldId}>
        {label}
        {required && <span className="text-destructive ml-1" aria-label="requis">*</span>}
      </Label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
        )}
        <Select
          value={field.state.value}
          onValueChange={field.handleChange}
          disabled={disabled}
          required={required}
        >
          <SelectTrigger
            id={fieldId}
            className={cn(
              Icon && "pl-10",
              hasError && "border-destructive focus:ring-destructive",
              className
            )}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </TanStackFormField>
  )
}
