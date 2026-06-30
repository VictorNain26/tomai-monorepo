import { describe, it, expect } from "bun:test";
import { optimizeConversationHistory } from "../utils/conversation/conversation-optimizer";

const mkMsgs = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: `m${i}`,
    timestamp: new Date().toISOString(),
  }));

describe("optimizeConversationHistory", () => {
  it("passes history through unchanged when there is no summary", () => {
    const msgs = mkMsgs(6);
    expect(optimizeConversationHistory(msgs)).toEqual(msgs);
  });

  it("returns only the recent verbatim window, with no role:system message, when a summary exists", () => {
    const msgs = mkMsgs(14);
    const out = optimizeConversationHistory(msgs, { conversationSummary: "résumé" });
    expect(out.some((m) => m.role === "system")).toBe(false);
    expect(out.length).toBeLessThanOrEqual(10);
    expect(out[out.length - 1].content).toBe("m13");
  });
});
