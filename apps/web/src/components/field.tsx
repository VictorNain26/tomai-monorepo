import { Input, cn } from '@repo/ui';
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

type SelectFieldProps = ComponentProps<'select'> & { label: string; options: Record<string, string>; error?: string | undefined };

/** A labelled native select, which a phone shows as its own picker. */
export function SelectField({ label, options, error, className, ...select }: SelectFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-bold text-foreground">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-11 w-full rounded-full border bg-background px-4 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:text-sm',
          error && 'border-destructive',
          className,
        )}
        {...select}
      >
        <option value="">Choisir</option>
        {Object.entries(options).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
