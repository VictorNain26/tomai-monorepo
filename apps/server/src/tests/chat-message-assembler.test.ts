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
});
