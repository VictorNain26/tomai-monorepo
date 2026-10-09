import { Button } from '@repo/ui';
import { memoryMessage, type useMemoryAnswer } from '../lib/memory';
import { Notice } from './notice';

/**
 * What the memory is, and the student's yes or no. The mutation belongs to the screen, which
 * outlives this offer: it says the answer back once the offer is gone.
 */
export function MemoryAnswer({ answer }: { answer: ReturnType<typeof useMemoryAnswer> }) {
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
            answer.mutate('accepted');
          }}
        >
          D’accord
        </Button>
        <Button
          variant="outline"
          disabled={answer.isPending}
          onClick={() => {
            answer.mutate('declined');
          }}
        >
          Non merci
        </Button>
      </div>
    </section>
  );
}
