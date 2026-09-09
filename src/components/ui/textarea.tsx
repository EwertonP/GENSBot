import React from 'react';
import { cn } from '@/lib/utils';
import { fieldInputClass, fieldLabelClass } from '@/lib/form-styles';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const textareaEl = (
      <textarea id={id} ref={ref} className={cn(fieldInputClass, className)} {...props} />
    );

    if (!label) return textareaEl;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className={fieldLabelClass}>
          {label}
        </label>
        {textareaEl}
        {error && <p className="text-xs text-destructive font-medium">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
