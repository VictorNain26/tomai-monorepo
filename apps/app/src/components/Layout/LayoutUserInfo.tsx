import type { ReactElement } from 'react';
import { GraduationCap } from 'lucide-react';
import { type IAppUser, isITomUser } from '@/types';
import { getUserDisplayName, getUserRoleLabel, hasSchoolLevel } from '@/utils/userUtils';
import { Avatar, AvatarFallback } from '../ui/avatar';

interface ILayoutUserInfoProps {
 user: IAppUser | null;
}

export const LayoutUserInfo = ({ user }: ILayoutUserInfoProps): ReactElement | null => {
 if (user == null) {
 return null;
 }

 return (
 <div className="space-y-3">
 {/* User Profile */}
 <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm">
 <Avatar className="h-10 w-10">
 <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
 {getUserDisplayName(user)?.charAt(0)?.toUpperCase() ?? 'U'}
 </AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <p className="font-medium text-sm truncate text-card-foreground">
 {getUserDisplayName(user)}
 </p>
 <p className="text-xs text-muted-foreground">
 {getUserRoleLabel(isITomUser(user) ? user.role : undefined)}
 </p>
 </div>
 </div>

 {/* Student Level Badge */}
 {isITomUser(user) && user.role === 'student' && (
 <div>
 {hasSchoolLevel(user) ? (
 <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2">
 <GraduationCap className="h-4 w-4 text-primary" />
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <span className="text-sm font-semibold uppercase text-primary">
 {user.schoolLevel ?? 'cp'}
 </span>
 <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
 Actuel
 </span>
 </div>
 </div>
 </div>
 ) : (
 <div className="flex items-center gap-2 rounded-md bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/30 px-3 py-2">
 <GraduationCap className="h-4 w-4 text-orange-600 dark:text-orange-400" />
 <div className="flex-1">
 <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
 Configurer le niveau
 </p>
 <p className="text-xs text-orange-600 dark:text-orange-400">
 Requis pour personnalisation
 </p>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 );
};

export default LayoutUserInfo;
