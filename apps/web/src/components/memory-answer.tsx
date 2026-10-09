import { Button } from '@repo/ui';
import { memoryMessage, useMemoryAnswer } from '../lib/memory';
import { Notice } from './notice';

/** What the memory is, and the student's yes or no, which `onAnswered` hears once taken. */
export function MemoryAnswer({ onAnswered }: { onAnswered?: (answer: 'accepted' | 'declined') => void }) {
  const answer = useMemoryAnswer();
  const reply = (given: 'accepted' | 'declined') => {
    answer.mutate(given, { onSuccess: () => onAnswered?.(given) });
  };

  return (
    <section aria-labelledby="memory-offer" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
      <h2 id="memory-offer" className="text-lg font-bold">
        Tom peut retenir ce qui a résisté
      </h2>
      <p className="text-sm">
        D’une séance à l’autre, Tom se souviendrait des notions que tu as travaillées et de ce qui a été difficile, pour mieux t’aider. Il ne garde
        rien de ce que tu écris, et tu pourras tout voir et tout effacer.
      </p>
      {answer.error && <Notice tone="error">{memoryMessage(answer.error)}</Notice>}
      <div className="flex gap-2">
        <Button
          disabled={answer.isPending}
          onClick={() => {
            reply('accepted');
          }}
        >
          D’accord
        </Button>
        <Button
          variant="outline"
          disabled={answer.isPending}
          onClick={() => {
            reply('declined');
          }}
        >
          Non merci
        </Button>
      </div>
    </section>
  );
}
