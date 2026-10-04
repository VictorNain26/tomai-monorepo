import type { LanguageModelUsage } from 'ai';
import { estimateTokens } from './token-budget.service.js';

const NO_USAGE: LanguageModelUsage = {
  inputTokens: 0,
  inputTokenDetails: { noCacheTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  outputTokens: 0,
  outputTokenDetails: { textTokens: 0, reasoningTokens: 0 },
  totalTokens: 0,
};

const add = (a: number | undefined, b: number | undefined) => (a ?? 0) + (b ?? 0);

function sum(a: LanguageModelUsage, b: LanguageModelUsage): LanguageModelUsage {
  return {
    inputTokens: add(a.inputTokens, b.inputTokens),
    inputTokenDetails: {
      noCacheTokens: add(a.inputTokenDetails.noCacheTokens, b.inputTokenDetails.noCacheTokens),
      cacheReadTokens: add(a.inputTokenDetails.cacheReadTokens, b.inputTokenDetails.cacheReadTokens),
      cacheWriteTokens: add(a.inputTokenDetails.cacheWriteTokens, b.inputTokenDetails.cacheWriteTokens),
    },
    outputTokens: add(a.outputTokens, b.outputTokens),
    outputTokenDetails: {
      textTokens: add(a.outputTokenDetails.textTokens, b.outputTokenDetails.textTokens),
      reasoningTokens: add(a.outputTokenDetails.reasoningTokens, b.outputTokenDetails.reasoningTokens),
    },
    totalTokens: add(a.totalTokens, b.totalTokens),
  };
}

/**
 * A turn's usage, whatever ends it. Every model call that ended counts as Mistral reported it
 * (`onLanguageModelCallEnd`), even when a timeout cuts the turn afterwards, during a tool. A
 * call cut in flight never reports its usage: when it streamed something, it was billed, so
 * its output is estimated from what it streamed and its input from the previous call's, or
 * from the prompt.
 */
export class TurnUsage {
  private ended = NO_USAGE;
  private lastInput = 0;
  private inFlight = false;
  private streamed = '';

  /** The prompt of the turn's first call, whose input is estimated if it is cut. */
  prompt(text: string): void {
    this.lastInput = estimateTokens(text);
  }

  callStarted(): void {
    this.inFlight = true;
    this.streamed = '';
  }

  delta(text: string): void {
    this.streamed += text;
  }

  callEnded(usage: LanguageModelUsage): void {
    this.ended = sum(this.ended, usage);
    this.lastInput = usage.inputTokens ?? this.lastInput;
    this.inFlight = false;
    this.streamed = '';
  }

  /** The usage so far; `cut` when a call was cut in flight, its share then estimated. */
  read(): { usage: LanguageModelUsage; cut: boolean } {
    if (!this.inFlight) return { usage: this.ended, cut: false };
    if (this.streamed === '') return { usage: this.ended, cut: true };
    const output = estimateTokens(this.streamed);
    return {
      usage: sum(this.ended, {
        inputTokens: this.lastInput,
        inputTokenDetails: { noCacheTokens: this.lastInput, cacheReadTokens: 0, cacheWriteTokens: 0 },
        outputTokens: output,
        outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
        totalTokens: this.lastInput + output,
      }),
      cut: true,
    };
  }
}
