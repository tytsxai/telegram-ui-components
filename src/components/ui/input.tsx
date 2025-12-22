import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  "aria-label"?: string;
  "aria-describedby"?: string;
}

const normalizeLabel = (value?: string): string | undefined => {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    const { "aria-label": ariaLabelProp, "aria-describedby": ariaDescribedBy, ...rest } = props;
    const derivedLabel =
      normalizeLabel(ariaLabelProp) ??
      (props["aria-labelledby"] ? undefined : normalizeLabel(props.placeholder ?? props.name));
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        aria-label={derivedLabel}
        aria-describedby={ariaDescribedBy}
        ref={ref}
        {...rest}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
