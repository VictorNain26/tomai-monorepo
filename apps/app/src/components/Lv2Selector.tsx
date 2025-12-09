import React from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { cn } from '@/lib/utils';
import { Globe } from 'lucide-react';
import { isLv2EligibleLevel, type Lv2Option } from '@/types';

/**
 * Métadonnées LV2 pour affichage
 */
const LV2_OPTIONS: Array<{
  key: Lv2Option;
  name: string;
  description: string;
  color: string;
}> = [
  {
    key: 'espagnol',
    name: 'Espagnol',
    description: 'Vocabulaire, grammaire et culture hispanophone',
    color: 'text-yellow-600 dark:text-yellow-400'
  },
  {
    key: 'allemand',
    name: 'Allemand',
    description: 'Expression orale, écrite et culture germanique',
    color: 'text-slate-600 dark:text-slate-400'
  },
  {
    key: 'italien',
    name: 'Italien',
    description: 'Langue et civilisation italiennes',
    color: 'text-green-600 dark:text-green-400'
  }
];

interface ILv2SelectorProps {
  /** Niveau scolaire de l'élève */
  schoolLevel?: string;
  /** LV2 actuellement sélectionnée */
  selectedLv2?: Lv2Option | null;
  /** Callback lors du changement de LV2 */
  onLv2Change: (lv2: Lv2Option | null) => void;
  /** Classes CSS additionnelles */
  className?: string;
  /** Désactiver le composant */
  disabled?: boolean;
}

/**
 * Composant de sélection de la Langue Vivante 2 (LV2)
 * S'affiche uniquement pour les niveaux >= 5ème
 */
export const Lv2Selector: React.FC<ILv2SelectorProps> = ({
  schoolLevel,
  selectedLv2,
  onLv2Change,
  className = '',
  disabled = false
}) => {
  const isEligible = isLv2EligibleLevel(schoolLevel);

  // Ne pas afficher si niveau non éligible
  if (!isEligible) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-primary" />
        <Label className="text-sm font-medium text-foreground">
          Langue Vivante 2 (LV2)
        </Label>
      </div>

      <div className="bg-info/10 border border-info/20 rounded-lg p-3 mb-3">
        <p className="text-sm text-info flex items-start gap-2">
          <span className="text-lg">🌍</span>
          <span>
            <strong>LV2 obligatoire :</strong> À partir de la 5ème, choisissez une seconde langue vivante.
            Ce choix détermine les contenus pédagogiques proposés.
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        {LV2_OPTIONS.map((option) => (
          <Button
            key={option.key}
            type="button"
            onClick={() => onLv2Change(option.key)}
            disabled={disabled}
            variant={selectedLv2 === option.key ? "default" : "outline"}
            size="lg"
            className={cn(
              "h-auto p-4 text-left justify-start transition-all duration-200 hover:scale-105",
              selectedLv2 === option.key && "bg-gradient-to-r from-primary/10 to-secondary/10 shadow-md ring-2 ring-primary/30",
              selectedLv2 !== option.key && "hover:border-primary/50 hover:bg-primary/10",
              disabled && "opacity-50 cursor-not-allowed transform-none"
            )}
          >
            <div className="flex flex-col items-start w-full">
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-2">
                  <Globe className={cn("w-4 h-4", option.color)} />
                  <span className="font-semibold text-base">{option.name}</span>
                </div>
                {selectedLv2 === option.key && <span className="text-primary">✓</span>}
              </div>
              <div className="text-xs text-muted-foreground">{option.description}</div>
            </div>
          </Button>
        ))}
      </div>

      {/* Option pour retirer la LV2 */}
      {selectedLv2 && (
        <Button
          type="button"
          onClick={() => onLv2Change(null)}
          disabled={disabled}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
        >
          Retirer la LV2 sélectionnée
        </Button>
      )}
    </div>
  );
};

export default Lv2Selector;
