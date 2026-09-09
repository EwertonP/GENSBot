import React from 'react';
import { cn } from '@/lib/utils';
import { fieldInputClass, fieldLabelClass } from '@/lib/form-styles';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const selectEl = (
      <select id={id} ref={ref} className={cn(fieldInputClass, className)} {...props}>
        {children}
      </select>
    );

    if (!label) return selectEl;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className={fieldLabelClass}>
          {label}
        </label>
        {selectEl}
        {error && <p className="text-xs text-destructive font-medium">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
