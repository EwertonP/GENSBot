import React from 'react';
import { cn } from '@/lib/utils';
import { fieldInputClass, fieldLabelClass } from '@/lib/form-styles';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputEl = (
      <input id={id} ref={ref} className={cn(fieldInputClass, className)} {...props} />
    );

    if (!label) return inputEl;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className={fieldLabelClass}>
          {label}
        </label>
        {inputEl}
        {error && <p className="text-xs text-destructive font-medium">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
