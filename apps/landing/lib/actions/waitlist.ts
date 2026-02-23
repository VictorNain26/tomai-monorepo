"use server";

import { SERVER_URL } from "@/lib/urls";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function joinWaitlist(
  email: string,
  source: string
): Promise<{ success: boolean; error?: string }> {
  if (!email || !EMAIL_REGEX.test(email)) {
    return { success: false, error: "Adresse email invalide" };
  }

  try {
    const res = await fetch(`${SERVER_URL}/api/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source }),
    });

    const data = (await res.json()) as { success: boolean; error?: string };
    return data;
  } catch {
    return { success: false, error: "Erreur de connexion au serveur" };
  }
}
