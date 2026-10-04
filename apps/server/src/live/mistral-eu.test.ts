import { describe, it, expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { streamChat } from '../modules/tutor/ai-chat.service';
import { generateText } from '../platform/ai/mistral-client';
import { mistralEmbeddingsService } from '../modules/tutor/mistral-embeddings.service';
import { getVoxtralTTSService } from '../modules/voice/voxtral-tts.service';
import { getVoxtralTranscribeService } from '../modules/voice/voxtral-transcribe.service';
import { HAS_MISTRAL } from './_creds';
import { generateText as generateWithTools } from 'ai';
import { buildChatTools } from '../modules/tutor/chat-tools';
import { mistralProvider } from '../platform/ai/provider';
import { env } from '../platform/config/env';

// Live contre l'endpoint UE de Mistral. LOCAL-ONLY (`bun run test:live`), fail-closed.

const RED_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAS0lEQVR42u3PQQkAAAgAsetfWiP4FgYrsKZeS0BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEDgsqnc8OJg6Ln3AAAAAElFTkSuQmCC';

const mathTurn = {
  userId: 'live-user',
  schoolLevel: 'troisieme' as const,
  subject: 'mathematiques',
  classifiedIntent: { intent: 'solve-this-for-me', confidence: 'high' as const },
  tools: {},
};

describe('Mistral Small 4 on the EU endpoint (real API)', () => {
  it('MISTRAL_API_KEY is configured (fail-closed, no silent skip)', () => {
    expect(HAS_MISTRAL).toBe(true);
  });

  it('streams a reasoning turn with usage, replays it with its reasoning on turn 2, read from cache', async () => {
    const sessionId = randomUUID();
    const first = streamChat({ ...mathTurn, sessionId, content: 'Résous 2x + 3 = 11.', conversationHistory: [] });
    const firstText = await first.text;
    const firstUsage = await first.usage;

    expect(firstText.length).toBeGreaterThan(0);
    expect(((await first.finalStep).reasoningText ?? '').length).toBeGreaterThan(0);
    expect(firstUsage.inputTokens ?? 0).toBeGreaterThan(0);
    expect(firstUsage.outputTokens ?? 0).toBeGreaterThan(0);

    // Turn 1 replayed as the model produced it: Mistral must accept its thinking chunk in history.
    const modelMessages = await first.responseMessages;
    expect(JSON.stringify(modelMessages)).toContain('"type":"reasoning"');
    const now = new Date().toISOString();
    const second = streamChat({
      ...mathTurn,
      sessionId,
      content: "Je trouve x = 4, c'est juste ?",
      conversationHistory: [
        { role: 'user', content: 'Résous 2x + 3 = 11.', timestamp: now },
        { role: 'assistant', content: firstText, timestamp: now, modelMessages },
      ],
    });
    expect((await second.text).length).toBeGreaterThan(0);

    expect((await second.usage).inputTokenDetails.cacheReadTokens ?? 0).toBeGreaterThan(0);
  }, 180_000);

  it('accepts the chat tools in strict mode and fills their input', async () => {
    const tools = buildChatTools({ userId: 'live-user', sessionId: randomUUID(), schoolLevel: 'troisieme', emitDeckCreated: () => undefined });
    const asks: [string, string][] = [
      ['generate_flashcards', 'Crée-moi 5 cartes de révision sur le théorème de Pythagore, en mathématiques.'],
      ['update_student_profile', "Note dans mon profil que je confonds l'aire et le périmètre, en mathématiques."],
    ];
    for (const [name, prompt] of asks) {
      const result = await generateWithTools({
        model: mistralProvider()(env.MISTRAL_MODEL),
        tools,
        activeTools: [name],
        toolChoice: 'required',
        // The call is returned, never run: no database is touched.
        toolApproval: { generate_flashcards: 'denied', update_student_profile: 'denied' },
        prompt,
        maxOutputTokens: 512,
      });
      expect(result.toolCalls.map((call) => call.toolName)).toEqual([name]);
    }
  }, 60_000);

  it("emits no reasoning when the route says 'none'", async () => {
    const turn = streamChat({ ...mathTurn, subject: 'francais', sessionId: randomUUID(), content: 'Donne un synonyme de rapide.', conversationHistory: [] });
    await turn.text;

    expect((await turn.finalStep).reasoningText ?? '').toBe('');
  }, 60_000);

  it('reads an image (Small 4 is multimodal)', async () => {
    const out = await generateText({
      functionId: 'live-mistral-eu',
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'De quelle couleur est cette image ? Réponds en un seul mot.' },
        { type: 'image_url', imageUrl: RED_PNG },
      ] }],
      maxTokens: 10,
      temperature: 0,
    });

    expect(out.toLowerCase()).toContain('rouge');
  }, 30_000);

  it('embeds text in 1024 dimensions', async () => {
    expect((await mistralEmbeddingsService.embed('bonjour')).length).toBe(1024);
  }, 30_000);

  it('synthesises then transcribes French speech', async () => {
    const tts = await getVoxtralTTSService().synthesize('Bonjour, je suis Tom.');
    expect(tts.success).toBe(true);

    const audio = new Uint8Array(Buffer.from(tts.audioData ?? '', 'base64'));
    const stt = await getVoxtralTranscribeService().transcribe(audio.buffer, 'audio/mpeg');

    expect(stt.transcription?.toLowerCase()).toContain('bonjour');
  }, 60_000);
});
