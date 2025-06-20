
"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check, Minus } from "lucide-react" // Import Minus icon

import { cn } from "@/lib/utils"

// Radix's 'checked' prop is boolean | 'indeterminate'
// Radix's 'onCheckedChange' prop is (checked: boolean | 'indeterminate') => void
// Our Checkbox component will accept `checked` (boolean, optional) and `indeterminate` (boolean, optional)
interface CheckboxProps extends Omit<React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>, 'checked'> {
  checked?: boolean; // The "main" checked state from the parent's perspective
  indeterminate?: boolean; // A separate prop to signal indeterminate state
  // onCheckedChange from Radix will be passed through via ...props
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, checked, indeterminate, ...props }, ref) => {
  // Determine the state for the Radix primitive's 'checked' prop
  const radixCheckedState = indeterminate ? 'indeterminate' : (checked ?? false);

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
        className
      )}
      checked={radixCheckedState} // Pass the combined state here
      {...props} // Pass other props like onCheckedChange, disabled, etc.
                  // Our boolean `indeterminate` prop is destructured and NOT in `...props`
    >
      <CheckboxPrimitive.Indicator
        className={cn("flex items-center justify-center text-current")}
      >
        {/* Show Minus icon when indeterminate, Check icon when checked */}
        {radixCheckedState === 'indeterminate' && <Minus className="h-4 w-4" />}
        {radixCheckedState === true && <Check className="h-4 w-4" />}
        {/* No icon is rendered by default if radixCheckedState is false, which is standard */}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
