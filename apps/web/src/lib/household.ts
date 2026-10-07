/** The guardian's household, as `/api/household` serves it: its students and their devices. */

import { queryOptions } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';
import { z } from './zod';
import { api, isProblem, parseResponse } from './api';

const students = api.household.students;

export type Student = InferResponseType<typeof students.$get, 200>[number];
export type Level = InferRequestType<typeof students.$post>['json']['level'];

/** Every level the server takes, in school order: a level it adds fails the typecheck here. */
export const LEVEL_LABELS: Record<Level, string> = {
  sixieme: 'Sixième',
  cinquieme: 'Cinquième',
  quatrieme: 'Quatrième',
  troisieme: 'Troisième',
};

export const isLevel = (value: unknown): value is Level => typeof value === 'string' && Object.hasOwn(LEVEL_LABELS, value);

export const studentsQuery = queryOptions({
  queryKey: ['students'],
  queryFn: () => parseResponse(students.$get()),
});

export const devicesQuery = (studentId: string) =>
  queryOptions({
    queryKey: ['students', studentId, 'devices'],
    queryFn: () => parseResponse(students[':id'].devices.$get({ param: { id: studentId } })),
  });

/** A failed household request, in words a parent reads; the server's own message never shows. */
export function householdMessage(error: unknown, invalid = 'Vérifiez ce que vous avez saisi.'): string {
  if (isProblem(error, 'INVALID_REQUEST')) return invalid;
  if (isProblem(error, 'NOT_FOUND')) return 'Cet enfant ou cet appareil n’est plus dans votre foyer.';
  if (isProblem(error, 'RATE_LIMITED')) return 'Trop d’essais. Patientez une minute avant de réessayer.';
  return 'Une erreur est survenue. Réessayez dans un instant.';
}

const name = z.string().trim().min(1, 'Son prénom.').max(50, '50 caractères au plus.');
const level = z.custom<Level>(isLevel, 'Sa classe.');

export const studentSchema = z.object({ name, level });

export const newStudentSchema = studentSchema.extend({
  birthMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Son mois de naissance, au format AAAA-MM : 2014-03.'),
});
