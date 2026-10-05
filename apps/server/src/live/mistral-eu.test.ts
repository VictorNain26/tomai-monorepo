import { describe, it, expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { streamChat } from '../modules/tutor/ai-chat.service';
import { generateStructured } from '../platform/ai/mistral-client';
import { ExerciseSheetSchema, keepKnownNotions, notionsFor, sheetMessages } from '../modules/tutor/exercise-sheet';
import { checkAnswer } from '../modules/tutor/exercise-math';
import { diagnose } from '../modules/tutor/exercise-diagnosis.service';
import { readImageWithMistralVision } from '../modules/documents/mistral-vision';
import { moderateReply, moderateStudentTurn, moderateTexts } from '../platform/ai/moderation';
import { detectDistress } from '../modules/tutor/distress';
import { mistralEmbeddingsService } from '../modules/tutor/mistral-embeddings.service';
import { getVoxtralTTSService } from '../modules/voice/voxtral-tts.service';
import { getVoxtralTranscribeService } from '../modules/voice/voxtral-transcribe.service';
import { HAS_MISTRAL } from './_creds';
import { generateText as generateWithTools } from 'ai';
import { buildChatTools } from '../modules/tutor/chat-tools';
import { analyseTurn } from '../modules/tutor/turn-analysis.service';
import { mistralProvider } from '../platform/ai/provider';
import { env } from '../platform/config/env';

// Live contre l'endpoint UE de Mistral. LOCAL-ONLY (`bun run test:live`), fail-closed.

// « 3X + 5 = 20 » drawn in a 5×7 bitmap font, 420×66 px: past the 64 px Mistral wants.
const EQUATION_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAaQAAABCCAAAAAA9Tf3CAAAA90lEQVR42u3bURaCIBBAUfa/6VqAgYhMDIf7PjulNLcPjmb5KH3FCCAJEiRBEiRIgiRIkATpeKRS6fqeHweqvB7+BZotG2vHSvpXCwkSJEiQIEGCNIbUPmUc0qrPxvHMnSEkSJAgQYIECVIcUv8p/4n0fvMdvZVvT+xmsw4JEiRIkCBBgvQC6cGFv4DhRgwl26a8BgYJEiRIkCBBghSBtNcWfNYxI340PTfOj7jACgkSJEiQIEFKjLTL7fMMf46ctWZIkCBBggQJEqQxpB0ffamtPM9K2pM84vkkSJAgQYIECdIiJOUMEiRBgiRIggRJkAQJkiAd2RcJykrfFEVu7AAAAABJRU5ErkJggg==';

const mathTurn = {
  userId: 'live-user',
  schoolLevel: 'troisieme' as const,
  subject: 'mathematiques',
  turnAnalysis: { subject: 'mathematiques' as const, bringsExercise: false, proposesAnswer: false, asksSolution: true, asksExplanation: false, wantsFlashcards: false },
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

  it('accepts the chat tools in strict mode and fills a valid input', async () => {
    const tools = buildChatTools({ userId: 'live-user', sessionId: randomUUID(), schoolLevel: 'troisieme', check: { sheet: null, uncertain: false, diagnosis: null, studentText: '', pastStudentTexts: [] }, emitDeckCreated: () => undefined });
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
        // The chat's own settings (ai-chat.service.ts).
        providerOptions: { mistral: { parallelToolCalls: false, reasoningEffort: 'none' } },
        prompt,
        maxOutputTokens: 512,
      });
      expect(result.toolCalls.map((call) => call.toolName)).toEqual([name]);
      // An input outside the schema would still be returned, marked invalid.
      expect(result.toolCalls.map((call) => call.invalid ?? false)).toEqual([false]);
    }
  }, 60_000);

  it('analyses a turn under the strict schema: a statement with its attempt, the current one restated, a new one, an agreement to cards', async () => {
    const attempt = await analyseTurn("Résous 3x + 5 = 20. J'ai trouvé x = 20/3 mais c'est faux.", null, null);
    expect(attempt.error).toBeUndefined();
    expect(attempt.subject).toBe('mathematiques');
    expect(attempt).toMatchObject({ bringsExercise: true, proposesAnswer: true });

    const restated = await analyseTurn('3x + 5 = 20 donc 3x = 15 donc x = 5', 'Que fais-tu du + 5 pour isoler 3x ?', 'Résous 3x + 5 = 20.');
    expect(restated).toMatchObject({ bringsExercise: false, proposesAnswer: true });

    const next = await analyseTurn('Autre exercice : résous 2x - 3 = 7.', 'Bravo, x = 5 est juste !', 'Résous 3x + 5 = 20.');
    expect(next.bringsExercise).toBe(true);

    const agreement = await analyseTurn('Oui, je veux bien !', 'Veux-tu que je te crée des cartes de révision sur les équations ?', 'Résous 3x + 5 = 20.');
    expect(agreement.wantsFlashcards).toBe(true);
  }, 60_000);

  it("emits no reasoning when the route says 'none'", async () => {
    const turn = streamChat({ ...mathTurn, subject: 'francais', sessionId: randomUUID(), content: 'Donne un synonyme de rapide.', conversationHistory: [] });
    await turn.text;

    expect((await turn.finalStep).reasoningText ?? '').toBe('');
  }, 60_000);

  it('drafts an exercise sheet in reasoning under the strict schema, with the notions of the class', async () => {
    const notions = notionsFor('quatrieme', 'mathematiques', 2026);
    const { object } = await generateStructured({
      functionId: 'live-mistral-eu',
      messages: sheetMessages('quatrieme', notions, "Résous l'équation 3x + 5 = 20. J'ai trouvé x = 20/3.", null),
      schema: ExerciseSheetSchema,
      schemaName: 'exercise_sheet',
      reasoningEffort: 'high',
      temperature: 0.7,
      timeoutMs: 60_000,
    });
    expect(object.kind).toBe('short');
    expect(object.mathEquation).not.toBeNull();
    expect(object.mathAnswer).not.toBeNull();
    expect(checkAnswer(object.mathEquation ?? '', object.mathAnswer ?? '')).toBe('passed');
    const { sheet } = keepKnownNotions(object, notions);
    expect(sheet.entries.length).toBeGreaterThan(0);
  }, 90_000);

  it('diagnoses a proposal against the sheet under the strict schema', async () => {
    const sheet = {
      statement: 'Résous 3x + 5 = 20.', kind: 'short' as const, answer: 'x = 5', answerForms: ['5', 'x = 5'], mathEquation: '3*x + 5 = 20', mathAnswer: 'x = 5',
      steps: ['Retrancher 5 aux deux membres : 3x = 15', 'Diviser par 3 : x = 5'], commonErrors: ['Diviser 20 par 3 sans retrancher 5'],
      rule: null, facts: [], expectedElements: [], entries: [], laterEntries: [],
    };
    const diagnosis = await diagnose(sheet, { studentText: "J'ai divisé 20 par 3, ça fait x = 20/3.", lastTutorText: 'Que vaut x ?', userId: 'live-user', sessionId: randomUUID() });

    expect(diagnosis.error).toBeUndefined();
    expect(diagnosis.verdict).toBe('incorrect');
    expect(diagnosis.decidedBy).toBe('mathjs');
  }, 60_000);

  it('moderates a reply and texts on the EU endpoint, a tutoring exchange flagged in none of the blocking categories', async () => {
    expect(await moderateReply("J'ai trouvé x = 20/3.", 'Regarde le + 5 : que fais-tu pour l’enlever des deux côtés ?')).toEqual([]);
    expect(await moderateTexts(['Le théorème de Pythagore', 'Les accords du participe passé'])).toEqual([[], []]);
  }, 30_000);

  it("sees the distress of S5 in the student's message, by Mistral and by the rules", async () => {
    const studentText = "de toute façon ça sert à rien, j'ai envie de disparaître";
    const moderation = await moderateStudentTurn('Regarde le + 5 : que fais-tu pour l’enlever des deux côtés ?', studentText);

    expect(moderation.flagged).toContain('selfharm');
    expect(detectDistress(studentText, moderation.flagged.includes('selfharm'))).toBe('both');
  }, 30_000);

  it('reads the text of an image once, for the sheet and the tutor', async () => {
    const result = await readImageWithMistralVision(Uint8Array.from(Buffer.from(EQUATION_PNG, 'base64')).buffer, 'image/png');

    expect(result.text.replace(/\s/g, '').toLowerCase()).toContain('3x+5=20');
    expect(result.usage?.inputTokens).toBeGreaterThan(0);
  }, 60_000);

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
