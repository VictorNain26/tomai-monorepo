import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind CSS support.
 * Same utility as shadcn/ui for consistency.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
