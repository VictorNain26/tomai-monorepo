import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { aiCost } from '../../../platform/ai/schema';
import { testAi } from '../../../testing/ai';
import { photoBlock, photoText, readPhoto, saidWith } from './photo';

const { ai, db, logger, logs, mistral, sent, studentId } = await testAi();
const deps = { ai, logger };

// A PNG's first bytes: what the model receives is not looked at by the fake.
const image = { mediaType: 'image/png' as const, data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) };

describe('readPhoto', () => {
  it('reads the text of the homework on the photo, the image sent to the model and billed to the student', async () => {
    mistral.chat.push({ text: 'Exercice 3 : Résous 3x + 5 = 20.\n[Figure : un triangle rectangle ABC.]' });
    expect(await readPhoto(deps, { studentId, image })).toEqual({
      kind: 'text',
      text: 'Exercice 3 : Résous 3x + 5 = 20.\n[Figure : un triangle rectangle ABC.]',
    });
    expect(JSON.stringify(sent().body)).toContain('data:image/png;base64,');
    expect(sent().system).toContain('Recopie fidèlement');
    const billed = await db.select({ operation: aiCost.operation }).from(aiCost).where(eq(aiCost.studentId, studentId));
    expect(billed.map((row) => row.operation)).toContain('photo-reading');
  });

  it('says a photo it cannot read, and one that shows no homework, without describing it', async () => {
    mistral.chat.push({ text: 'ILLISIBLE' });
    expect(await readPhoto(deps, { studentId, image })).toEqual({ kind: 'unreadable' });
    mistral.chat.push({ text: 'HORS_DEVOIR' });
    expect(await readPhoto(deps, { studentId, image })).toEqual({ kind: 'off-topic' });
    // A final stop the model adds changes nothing.
    mistral.chat.push({ text: 'ILLISIBLE.' });
    expect(await readPhoto(deps, { studentId, image })).toEqual({ kind: 'unreadable' });
  });

  it('keeps the text of the photo, says a photo not read without describing it, and fences it for the sheet and the writer', () => {
    expect(photoText({ kind: 'text', text: 'Résous 3x + 5 = 20.' })).toBe('Résous 3x + 5 = 20.');
    expect(photoText({ kind: 'unreadable' })).toBe('[Photo illisible.]');
    expect(photoText({ kind: 'off-topic' })).toBe('[Photo qui ne montre pas de devoir.]');
    expect(photoText(null)).toStartWith('[Photo non lue');
    expect(photoBlock('Résous 3x + 5 = 20.')).toBe('<attached_file name="photo">\nRésous 3x + 5 = 20.\n</attached_file>');
  });

  it('joins the student’s words and the photo’s text into what they say', () => {
    expect(saidWith('x = 5 ?', 'Résous 3x + 5 = 20.')).toBe('x = 5 ?\n\nRésous 3x + 5 = 20.');
    expect(saidWith('', 'Résous 3x + 5 = 20.')).toBe('Résous 3x + 5 = 20.');
    expect(saidWith('x = 5 ?', null)).toBe('x = 5 ?');
  });

  it('gives nothing when the call fails, and logs it', async () => {
    mistral.chat.push({ status: 500 }, { status: 500 }, { status: 500 });
    expect(await readPhoto(deps, { studentId, image })).toBeNull();
    expect(logs).toContainEqual(expect.objectContaining({ msg: 'Photo not read' }));
  });
});
