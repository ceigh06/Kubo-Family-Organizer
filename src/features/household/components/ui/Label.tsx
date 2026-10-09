import * as React from 'react';
import { cn } from './cn';

export const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<'label'>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('block text-[15px] font-semibold text-foreground mb-1.5', className)}
      {...props}
    />
  ),
);
Label.displayName = 'Label';
