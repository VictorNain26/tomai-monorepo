import { describe, it, expect } from 'bun:test';
import type { LanguageModelUsage } from 'ai';
import { TurnUsage } from '../modules/tutor/turn-usage';

const call = (input: number, cached: number, output: number, reasoning: number): LanguageModelUsage => ({
  inputTokens: input,
  inputTokenDetails: { noCacheTokens: input - cached, cacheReadTokens: cached, cacheWriteTokens: undefined },
  outputTokens: output,
  outputTokenDetails: { textTokens: output - reasoning, reasoningTokens: reasoning },
  totalTokens: input + output,
});

describe('TurnUsage', () => {
  it('sums every model call that ended, exactly as reported', () => {
    const usage = new TurnUsage();
    usage.prompt('x'.repeat(400));
    usage.callStarted();
    usage.callEnded(call(100, 64, 3, 0));
    usage.callStarted();
    usage.delta('Bonjour');
    usage.callEnded(call(120, 100, 900, 880));

    expect(usage.read()).toEqual({
      cut: false,
      usage: {
        inputTokens: 220,
        inputTokenDetails: { noCacheTokens: 56, cacheReadTokens: 164, cacheWriteTokens: 0 },
        outputTokens: 903,
        outputTokenDetails: { textTokens: 23, reasoningTokens: 880 },
        totalTokens: 1123,
      },
    });
  });

  it('estimates a call cut after it streamed: its output from the deltas, its input from the call before', () => {
    const usage = new TurnUsage();
    usage.callStarted();
    usage.callEnded(call(100, 0, 3, 0));
    usage.callStarted();
    usage.delta('a'.repeat(4000));

    const { usage: total, cut } = usage.read();
    expect(cut).toBe(true);
    // 4 000 characters at 4 characters a token, and the previous call's 100 input tokens.
    expect(total).toMatchObject({ inputTokens: 200, outputTokens: 1003, totalTokens: 1203 });
  });

  it("estimates a first call cut while reasoning from the turn's prompt", () => {
    const usage = new TurnUsage();
    usage.prompt('p'.repeat(2000));
    usage.callStarted();
    usage.delta('r'.repeat(400));

    expect(usage.read()).toMatchObject({ cut: true, usage: { inputTokens: 500, outputTokens: 100, totalTokens: 600 } });
  });

  it('counts nothing for a call cut before it streamed anything, which was not billed', () => {
    const usage = new TurnUsage();
    usage.callStarted();
    usage.callEnded(call(100, 0, 3, 0));
    usage.callStarted();

    expect(usage.read()).toMatchObject({ cut: true, usage: { totalTokens: 103 } });
  });
});
