/**
 * AccountTypeToggle - Molecule sélection type de compte
 *
 * Cards interactives parent/élève avec design moderne et animations
 */

import { Shield, GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AccountTypeType } from '@/types';

export interface AccountTypeToggleProps {
  accountType: AccountTypeType;
  onAccountTypeChange: (type: AccountTypeType) => void;
  disabled?: boolean;
}

export function AccountTypeToggle({
  accountType,
  onAccountTypeChange,
  disabled = false
}: AccountTypeToggleProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Card Parent */}
      <motion.button
        type="button"
        onClick={() => !disabled && onAccountTypeChange('parent')}
        disabled={disabled}
        whileHover={!disabled ? { scale: 1.02 } : {}}
        whileTap={!disabled ? { scale: 0.98 } : {}}
        className={`
          relative overflow-hidden rounded-lg border-2 p-4 transition-all duration-300
          ${accountType === 'parent'
            ? 'border-primary bg-primary/5 shadow-md shadow-primary/20'
            : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {/* Fond gradient animé */}
        {accountType === 'parent' && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
        )}

        {/* Contenu */}
        <div className="relative flex flex-col items-center gap-2">
          <div className={`
            rounded-full p-2 transition-colors duration-300
            ${accountType === 'parent'
              ? 'bg-primary/10 ring-2 ring-primary/20'
              : 'bg-muted'
            }
          `}>
            <Shield className={`
              w-5 h-5 transition-colors duration-300
              ${accountType === 'parent' ? 'text-primary' : 'text-muted-foreground'}
            `} />
          </div>

          <p className={`
            text-sm font-semibold transition-colors duration-300
            ${accountType === 'parent' ? 'text-primary' : 'text-foreground'}
          `}>
            Parent
          </p>
        </div>

        {/* Indicateur de sélection */}
        {accountType === 'parent' && (
          <motion.div
            className="absolute top-2 right-2"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          </motion.div>
        )}
      </motion.button>

      {/* Card Élève */}
      <motion.button
        type="button"
        onClick={() => !disabled && onAccountTypeChange('student')}
        disabled={disabled}
        whileHover={!disabled ? { scale: 1.02 } : {}}
        whileTap={!disabled ? { scale: 0.98 } : {}}
        className={`
          relative overflow-hidden rounded-lg border-2 p-4 transition-all duration-300
          ${accountType === 'student'
            ? 'border-primary bg-primary/5 shadow-md shadow-primary/20'
            : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {/* Fond gradient animé */}
        {accountType === 'student' && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
        )}

        {/* Contenu */}
        <div className="relative flex flex-col items-center gap-2">
          <div className={`
            rounded-full p-2 transition-colors duration-300
            ${accountType === 'student'
              ? 'bg-primary/10 ring-2 ring-primary/20'
              : 'bg-muted'
            }
          `}>
            <GraduationCap className={`
              w-5 h-5 transition-colors duration-300
              ${accountType === 'student' ? 'text-primary' : 'text-muted-foreground'}
            `} />
          </div>

          <p className={`
            text-sm font-semibold transition-colors duration-300
            ${accountType === 'student' ? 'text-primary' : 'text-foreground'}
          `}>
            Élève
          </p>
        </div>

        {/* Indicateur de sélection */}
        {accountType === 'student' && (
          <motion.div
            className="absolute top-2 right-2"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          </motion.div>
        )}
      </motion.button>
    </div>
  );
}
