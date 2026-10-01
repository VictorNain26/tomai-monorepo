import { describe, it, expect } from 'bun:test';
import { assembleChatMessages } from '../services/chat/chat-message-assembler.js';

describe('assembleChatMessages', () => {
  it('injects the summary as a user block right after system when conversationSummary is provided', () => {
    const out = assembleChatMessages({
      systemPrompt: 'SYS',
      conversationSummary: 'résumé du passé',
      historyMessages: [{ role: 'user', content: 'hist' }],
      userContent: 'question',
    });

    expect(out[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(out[1]?.role).toBe('user');
    expect(out[1]?.content).toContain('<conversation_summary>');
    expect(out[1]?.content).toContain('résumé du passé');
    expect(out[2]).toEqual({ role: 'user', content: 'hist' });
    expect(out[out.length - 1]).toEqual({ role: 'user', content: 'question' });
  });

  it('omits the summary block when conversationSummary is absent', () => {
    const out = assembleChatMessages({
      systemPrompt: 'SYS',
      historyMessages: [{ role: 'user', content: 'hist' }],
      userContent: 'question',
    });

    expect(out[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(out[1]).toEqual({ role: 'user', content: 'hist' });
    expect(out[out.length - 1]).toEqual({ role: 'user', content: 'question' });
    const hasSummaryBlock = out.some(
      (m) => typeof m.content === 'string' && m.content.includes('<conversation_summary>'),
    );
    expect(hasSummaryBlock).toBe(false);
  });

  it('orders every block: system, summary, history, student context, files, turn hint, voice marker, message', () => {
    const out = assembleChatMessages({
      systemPrompt: 'SYS',
      conversationSummary: 'SUM',
      historyMessages: [{ role: 'assistant', content: 'HIST' }],
      studentContextBlock: 'CTX',
      attachedFilesBlock: 'FILES',
      intentReinforcement: 'HINT',
      inputMode: 'voice',
      userContent: 'MSG',
    });

    const contents = out.map((m) => (typeof m.content === 'string' ? m.content : ''));
    expect(contents[0]).toBe('SYS');
    expect(contents[1]).toContain('SUM');
    expect(contents.slice(2, 5)).toEqual(['HIST', 'CTX', 'FILES']);
    expect(contents[5]).toContain('HINT');
    expect(contents[6]).toContain('[VOCAL]');
    expect(contents[7]).toBe('MSG');
    expect(out).toHaveLength(8);
  });
});
