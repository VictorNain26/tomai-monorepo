"use server";

import { z } from "zod";
import { SERVER_URL } from "@/lib/urls";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const waitlistSuccessSchema = z.object({
  success: z.literal(true),
  alreadyExists: z.boolean(),
});

export type JoinWaitlistResult =
  | { success: true; alreadyExists: boolean }
  | { success: false; error: string };

export async function joinWaitlist(email: string, source: string): Promise<JoinWaitlistResult> {
  if (!email || !EMAIL_REGEX.test(email)) {
    return { success: false, error: "Adresse email invalide" };
  }

  let res: Response;
  try {
    res = await fetch(`${SERVER_URL}/api/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source }),
    });
  } catch {
    return { success: false, error: "Erreur de connexion au serveur" };
  }

  if (res.status === 400) {
    return { success: false, error: "Adresse email invalide" };
  }
  if (res.status === 429) {
    return { success: false, error: "Trop de tentatives, réessayez dans une minute." };
  }
  if (!res.ok) {
    return { success: false, error: "Inscription impossible pour le moment, réessayez plus tard." };
  }

  const parsed = waitlistSuccessSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) {
    return { success: false, error: "Inscription impossible pour le moment, réessayez plus tard." };
  }
  return parsed.data;
}
