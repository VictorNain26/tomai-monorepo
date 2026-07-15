import { describe, it, expect } from 'bun:test';
import { assembleChatMessages } from '../services/chat/chat-message-assembler.js';

describe('subject memory block placement', () => {
  it('keeps <subject_memory> in a user message, never in the system prompt', () => {
    const subjectMemory = '<subject_memory>\nMathématiques — 3 erreurs récentes sur les fractions.\n</subject_memory>';
    const studentContextBlock = `<student_context>\n${subjectMemory}\n</student_context>`;

    const out = assembleChatMessages({
      systemPrompt: 'SYS_PROMPT',
      historyMessages: [],
      studentContextBlock,
      userContent: 'Comment simplifier 3/6 ?',
    });

    expect(out[0]).toEqual({ role: 'system', content: 'SYS_PROMPT' });
    expect(out[0]?.content).not.toContain('<subject_memory>');

    const userMessages = out.filter(m => m.role === 'user');
    const hasSubjectMemory = userMessages.some(
      m => typeof m.content === 'string' && m.content.includes('<subject_memory>'),
    );
    expect(hasSubjectMemory).toBe(true);
  });

  it('omits subject memory from the system prompt even when cognitiveProfile is also present', () => {
    const subjectMemory = '<subject_memory>\nPhysique — concepts de base acquis.\n</subject_memory>';
    const studentContextBlock = `<student_context>\nProfil: visuel.\n${subjectMemory}\n</student_context>`;

    const out = assembleChatMessages({
      systemPrompt: 'SYS_PROMPT',
      historyMessages: [{ role: 'user', content: 'hist' }],
      studentContextBlock,
      userContent: 'question',
    });

    expect(out[0]?.role).toBe('system');
    expect(out[0]?.content).not.toContain('subject_memory');
    expect(out[0]?.content).not.toContain('Physique');
  });
});
