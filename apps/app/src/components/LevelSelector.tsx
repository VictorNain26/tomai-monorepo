import React from 'react';
import { CYCLES, type ILevelInfo, SCHOOL_LEVELS, type EducationLevelType } from '@/constants/schoolLevels';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface ILevelSelectorProps {
 selectedLevel?: EducationLevelType | undefined;
 onLevelChange: (level: EducationLevelType) => void;
 className?: string;
 showCycles?: boolean;
 disabled?: boolean;
}

interface ILevelButtonProps {
 level: EducationLevelType;
 isSelected: boolean;
 onLevelChange: (level: EducationLevelType) => void;
 disabled: boolean;
}

const LevelButton: React.FC<ILevelButtonProps> = ({ level, isSelected, onLevelChange, disabled }) => {
  return (
    <Button
      key={level}
      onClick={() => { onLevelChange(level); }}
      disabled={disabled}
      variant={isSelected ? "default" : "outline"}
      size="lg"
      className={cn(
        "h-auto p-4 sm:p-6 text-left justify-start transition-all duration-200 hover:scale-105",
        isSelected && "bg-gradient-to-r from-primary/10 to-secondary/10 shadow-md ring-2 ring-primary/30",
        !isSelected && "hover:border-primary/50 hover:bg-primary/10",
        disabled && "opacity-50 cursor-not-allowed transform-none"
      )}
    >
      <div className="flex flex-col items-start w-full">
        <div className="flex items-center justify-between w-full mb-1">
          <div className="font-semibold text-base sm:text-lg uppercase">{level}</div>
          {isSelected && <span className="text-primary">✓</span>}
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground">{SCHOOL_LEVELS[level].description}</div>
      </div>
    </Button>
  );
};

const CyclesView: React.FC<Pick<ILevelSelectorProps, 'selectedLevel' | 'onLevelChange' | 'disabled' | 'className'>> = ({
 selectedLevel,
 onLevelChange,
 disabled = false,
 className = ''
}) => (
 <div className={cn("space-y-4 sm:space-y-6", className)}>
 <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
 <p className="text-sm text-warning flex items-start gap-2">
 <span className="text-lg">💡</span>
 <span>
 <strong>Conseil :</strong> Sélectionnez le niveau correspondant à la classe actuelle de votre enfant.
 Cela adaptera automatiquement le contenu pédagogique proposé.
 </span>
 </p>
 </div>

 {Object.entries(CYCLES).map(([cycleName, cycleInfo]) => (
 <div key={cycleName} className="space-y-2 sm:space-y-3">
 <h4 className="text-sm sm:text-md font-semibold text-foreground
 bg-gradient-to-r from-muted/50 to-transparent
 rounded-lg px-3 py-2 border-l-4 border-primary">
 {cycleInfo.name}
 </h4>

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
 {cycleInfo.levels.map((level) => (
 <LevelButton
 key={level}
 level={level}
 isSelected={selectedLevel === level}
 onLevelChange={onLevelChange}
 disabled={disabled}
 />
 ))}
 </div>
 </div>
 ))}
 </div>
);

export const LevelSelector: React.FC<ILevelSelectorProps> = ({
 selectedLevel,
 onLevelChange,
 className = '',
 showCycles = true,
 disabled = false
}) => {
 if (showCycles) {
 return (
 <CyclesView
 selectedLevel={selectedLevel}
 onLevelChange={onLevelChange}
 disabled={disabled}
 className={className}
 />
 );
 }

 // Version simple avec Select shadcn/ui moderne
 return (
 <div className={cn("space-y-2", className)}>
 <Label htmlFor="school-level" className="text-sm font-medium text-foreground">
 Niveau scolaire
 </Label>
 <Select
 value={selectedLevel ?? ''}
 onValueChange={onLevelChange}
 disabled={disabled}
 >
 <SelectTrigger id="school-level" className="w-full">
 <SelectValue placeholder="Sélectionner un niveau" />
 </SelectTrigger>
 <SelectContent>
 {Object.entries(SCHOOL_LEVELS).map(([level, info]) => (
 <SelectItem key={level} value={level}>
 <div className="flex items-center gap-2">
 <span className="font-medium text-base uppercase">{level}</span>
 <span className="text-xs text-muted-foreground">— {info.description}</span>
 </div>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 );
};

// Composant pour afficher le niveau actuel
interface ICurrentLevelDisplayProps {
 level: EducationLevelType;
 className?: string;
}

export const CurrentLevelDisplay: React.FC<ICurrentLevelDisplayProps> = ({
 level,
 className = ''
}) => {

 return (
 <div className={cn("inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm bg-primary/10 text-primary", className)}>
 <span className="font-medium">{level}</span>
 <span className="ml-1 sm:ml-2 text-primary/80 ">({SCHOOL_LEVELS[level].cycle})</span>
 </div>
 );
};

export type { EducationLevelType, ILevelInfo };
