import type { ICreateChildData } from "@/lib/hooks/use-parent-dashboard";

/** Derived from the Eden Treaty contract — single source of truth. */
export type SchoolLevelKey = ICreateChildData["schoolLevel"];

export const LEVEL_LABELS: Record<string, string> = {
  cp: "CP",
  ce1: "CE1",
  ce2: "CE2",
  cm1: "CM1",
  cm2: "CM2",
  sixieme: "6ème",
  cinquieme: "5ème",
  quatrieme: "4ème",
  troisieme: "3ème",
  seconde: "Seconde",
  premiere: "Première",
  terminale: "Terminale",
};

export function getLevelLabel(key: string): string {
  return LEVEL_LABELS[key] ?? key;
}

export type ChildFormInput = {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  dateOfBirth: string;
  schoolLevel: string;
};

export type ValidatedChildData = Omit<ChildFormInput, "schoolLevel"> & {
  schoolLevel: SchoolLevelKey;
};

export type ChildFormResult =
  | { ok: true; data: ValidatedChildData }
  | { ok: false; errors: Record<string, string> };

export function validatePassword(value: string): string | undefined {
  if (value.length < 8) return "Minimum 8 caractères";
  if (!/[a-z]/.test(value)) return "Doit contenir une minuscule";
  if (!/[A-Z]/.test(value)) return "Doit contenir une majuscule";
  if (!/\d/.test(value)) return "Doit contenir un chiffre";
  return undefined;
}

function validateUsername(value: string): string | undefined {
  if (value.length < 3) return "Minimum 3 caractères";
  if (value.length > 30) return "Maximum 30 caractères";
  if (!/^[a-zA-Z0-9_.]+$/.test(value))
    return "Lettres, chiffres, points et underscores uniquement";
  return undefined;
}

function validateDateOfBirth(value: string): string | undefined {
  if (!value) return "Date de naissance requise";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Format : AAAA-MM-JJ";
  const parsed = new Date(value + "T00:00:00Z");
  if (isNaN(parsed.getTime())) return "Date invalide";
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const m = now.getMonth() - parsed.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < parsed.getDate())) age--;
  if (age < 5 || age > 19) return "L'âge doit être entre 5 et 19 ans";
  return undefined;
}

export function validateChildForm(
  input: ChildFormInput,
  levelKeys: string[]
): ChildFormResult {
  const errors: Record<string, string> = {};

  if (!input.firstName.trim()) errors.firstName = "Prénom requis";
  if (!input.lastName.trim()) errors.lastName = "Nom requis";

  const usernameError = validateUsername(input.username.trim());
  if (usernameError) errors.username = usernameError;

  const passwordError = validatePassword(input.password);
  if (passwordError) errors.password = passwordError;

  const dobError = validateDateOfBirth(input.dateOfBirth);
  if (dobError) errors.dateOfBirth = dobError;

  if (!levelKeys.includes(input.schoolLevel))
    errors.schoolLevel = "Niveau scolaire invalide";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      username: input.username.trim().toLowerCase(),
      password: input.password,
      dateOfBirth: input.dateOfBirth,
      // levelKeys.includes check above guarantees the value is a valid SchoolLevelKey.
      schoolLevel: input.schoolLevel as SchoolLevelKey,
    },
  };
}
