import React from 'react';
import { Eye, Edit, Trash2, User, GraduationCap } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import type { IChild } from '@/types';
import { cn } from '@/lib/utils';

interface ChildrenTableProps {
  data: IChild[];
  onEdit?: (child: IChild) => void;
  onDelete?: (child: IChild) => void;
  onView?: (child: IChild) => void;
}

const getSchoolLevelDisplay = (level: string) => {
  const levelMap: Record<string, string> = {
    'cp': 'CP',
    'ce1': 'CE1',
    'ce2': 'CE2',
    'cm1': 'CM1',
    'cm2': 'CM2',
    'sixieme': '6ème',
    'cinquieme': '5ème',
    'quatrieme': '4ème',
    'troisieme': '3ème',
    'seconde': 'Seconde',
    'premiere': 'Première',
    'terminale': 'Terminale'
  };
  return levelMap[level] ?? level;
};

const calculateAge = (dateOfBirth: string) => {
  if (!dateOfBirth) return '—';
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear() -
    (today.getMonth() < birthDate.getMonth() ||
     (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0);
  return `${age} ans`;
};

const ChildCard: React.FC<{
  child: IChild;
  onEdit?: (child: IChild) => void;
  onDelete?: (child: IChild) => void;
  onView?: (child: IChild) => void;
}> = ({ child, onEdit, onDelete, onView }) => {
  return (
    <Card className="group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer" onClick={() => onView?.(child)}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <Avatar className="w-14 h-14 ring-2 ring-background shadow-lg">
            <AvatarFallback className="bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground">
              <User className="w-6 h-6" />
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-foreground leading-tight">
              {child.firstName} {child.lastName}
            </h3>
            <p className="text-sm text-muted-foreground font-mono mt-1">
              @{child.username}
            </p>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="secondary" className="gap-1">
                <GraduationCap className="w-3 h-3" />
                {getSchoolLevelDisplay(child.schoolLevel ?? '')}
              </Badge>
              <Badge variant="outline">
                {calculateAge(child.dateOfBirth ?? '')}
              </Badge>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onView && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onView(child);
                }}
                className="hover:bg-primary/10 hover:text-primary"
              >
                <Eye className="w-4 h-4" />
              </Button>
            )}
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(child);
                }}
                className="hover:bg-primary/10 hover:text-primary"
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(child);
                }}
                className="hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const ChildrenTable: React.FC<ChildrenTableProps> = ({
  data,
  onEdit,
  onDelete,
  onView
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-xl flex items-center justify-center">
          <User className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2 text-foreground">
          Aucun enfant inscrit
        </h3>
        <p className="text-sm text-muted-foreground">
          Ajoutez votre premier enfant pour commencer
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      "grid gap-4 p-6",
      "grid-cols-1 md:grid-cols-2"
    )}>
      {data.map((child) => (
        <ChildCard
          key={child.id}
          child={child}
          {...(onEdit && { onEdit })}
          {...(onDelete && { onDelete })}
          {...(onView && { onView })}
        />
      ))}
    </div>
  );
};

export default ChildrenTable;
