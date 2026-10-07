import * as React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { inputVariants } from './input';

// shadcn's native-select (https://ui.shadcn.com/docs/components/native-select) on the input's own
// look: the phone's picker, the field's border and focus ring.
type NativeSelectProps = React.ComponentProps<'select'> & VariantProps<typeof inputVariants>;

function NativeSelect({ className, variant, ...props }: NativeSelectProps) {
  return (
    <div className="relative w-full has-[select:disabled]:opacity-50">
      <select className={cn(inputVariants({ variant }), 'appearance-none pr-10', className)} {...props} />
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}

function NativeSelectOption(props: React.ComponentProps<'option'>) {
  return <option {...props} />;
}

export { NativeSelect, NativeSelectOption };
