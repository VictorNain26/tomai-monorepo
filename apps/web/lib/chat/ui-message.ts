/**
 * Chat UI Message helpers (web)
 *
 * Minimal mirror of `apps/mobile/src/hooks/chat/ui-message.ts` — web has no
 * attachments/decks, so only the text-only conversions needed by `useChat`
 * are kept here.
 */

import { isTextUIPart, isToolUIPart, getToolName } from "ai";
import type { TomChatMessage } from "@repo/api";

/** Concatenate every `text` part of a UIMessage, in order. */
export function extractText(parts: TomChatMessage["parts"]): string {
  return parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}

/** Seed `useChat({ messages })` from server history (text-only). */
export function toTomChatMessage(message: {
  id: string;
  role: "user" | "assistant";
  content: string;
}): TomChatMessage {
  return {
    id: message.id,
    role: message.role,
    parts: [{ type: "text", text: message.content }],
  };
}

/**
 * Parse the error thrown by `DefaultChatTransport` on a non-2xx response.
 * Pre-stream guards (429 `QUOTA_EXCEEDED`, 409 `CONCURRENT_STREAM`, ...) reply
 * with the `{ error: { code, message } }` JSON envelope (see
 * `apps/server/src/lib/errors.ts`); the transport surfaces the raw response
 * text as `Error.message`. Falls back to the raw message for network errors
 * (no JSON body).
 */
export function parseTransportErrorMessage(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { error?: { message?: string } };
    if (parsed.error?.message) return parsed.error.message;
  } catch {
    // Not JSON (network failure, timeout...) — fall through to raw message.
  }
  return error.message || "Erreur de connexion au serveur";
}

/** Same French labels the legacy SSE route used (`mistral-helpers.ts`'s `getToolStatusLabel`). */
function getToolStatusLabel(name: string): string {
  switch (name) {
    case "search_educational_content":
      return "Recherche dans les programmes...";
    case "generate_flashcards":
      return "Création de flashcards...";
    case "get_student_profile":
      return "Analyse du profil...";
    case "update_student_profile":
      return "Mémorisation...";
    case "get_app_help":
      return "Consultation du guide...";
    default:
      return "Traitement en cours...";
  }
}

const TOOL_STATES_WITHOUT_OUTPUT = new Set(["input-streaming", "input-available"]);

/**
 * Derive the "Recherche dans les programmes..."-style status from the
 * in-flight assistant message's tool parts. Empty string when no tool call
 * is active (the screen falls back to the generic "Tom réfléchit").
 */
export function deriveStreamStatus(message: TomChatMessage | undefined): string {
  if (!message || message.role !== "assistant") return "";

  const activeToolPart = [...message.parts]
    .reverse()
    .find((part) => isToolUIPart(part) && TOOL_STATES_WITHOUT_OUTPUT.has(part.state));

  if (!activeToolPart || !isToolUIPart(activeToolPart)) return "";
  return getToolStatusLabel(getToolName(activeToolPart));
}
