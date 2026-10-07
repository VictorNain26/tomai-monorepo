import { Input } from '@repo/ui';
import { useId, type ComponentProps } from 'react';

type FieldProps = ComponentProps<typeof Input> & { label: string; error?: string | undefined };

/** A labelled input, its error read out with it. */
export function Field({ label, error, ...input }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-bold text-foreground">
        {label}
      </label>
      <Input
        id={id}
        variant={error ? 'error' : 'default'}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...input}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
