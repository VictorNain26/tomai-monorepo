/**
 * PasswordCriteria - Atom pour affichage critères mot de passe
 *
 * Indicateur visuel de critère validé/non-validé avec animation
 */

import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';

export interface PasswordCriteriaProps {
  met: boolean;
  children: ReactNode;
}

export function PasswordCriteria({ met, children }: PasswordCriteriaProps) {
  return (
    <motion.div
      className="flex items-center gap-2 text-sm"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <CheckCircle
        className={`w-4 h-4 transition-colors duration-200 ${
          met ? 'text-success' : 'text-muted-foreground'
        }`}
      />
      <span className={met ? 'text-foreground' : 'text-muted-foreground'}>
        {children}
      </span>
    </motion.div>
  );
}
