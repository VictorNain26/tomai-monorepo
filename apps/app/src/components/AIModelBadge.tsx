import type { ReactElement } from 'react';
import type { UserRoleType } from '@/types';
import { Badge } from './ui/badge';

interface IAIModelBadgeProps {
  model: string;
  isFallback?: boolean;
  _userRole?: UserRoleType;
}

function AIModelBadge({ model, isFallback, _userRole = 'student' }: IAIModelBadgeProps): ReactElement {
  const getModelDisplayName = (): string => {
    if (model.includes('Gemini')) {
      return 'Gemini';
    }
    if (model.includes('Llama')) {
      return 'Llama';
    }
    const [firstPart] = model.split(' ');
    return firstPart !== undefined && firstPart.length > 0 ? firstPart : model;
  };

  return (
    <Badge variant="secondary" className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className="w-1.5 h-1.5 bg-primary/60 rounded-full" />
      {getModelDisplayName()}
      {isFallback === true && <span className="text-warning">*</span>}
    </Badge>
  );
}

export default AIModelBadge;
