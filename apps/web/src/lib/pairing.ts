import { z } from './zod';

/** The code as the guardian reads it out: two groups of four. */
export const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** The code as the child types it: the server reads it with or without its dash and spaces. */
export const pairingSchema = z.object({ code: z.string().trim().min(8, 'Les 8 caractères du code.').max(32, 'Le code a 8 caractères.') });
