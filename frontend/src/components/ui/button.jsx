import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary/90 backdrop-blur-xl border border-primary/20 text-white shadow-sm hover:shadow-md hover:bg-primary",
        destructive:
          "bg-destructive/90 backdrop-blur-xl border border-destructive/20 text-white shadow-sm hover:shadow-md hover:bg-destructive",
        outline:
          "bg-white/80 backdrop-blur-xl border border-gray-200/50 text-gray-900 shadow-sm hover:shadow-md hover:bg-white/90",
        secondary:
          "bg-gray-100/80 backdrop-blur-xl border border-gray-200/50 text-gray-900 shadow-sm hover:shadow-md hover:bg-gray-100",
        warning:
          "bg-warning/20 backdrop-blur-xl border border-warning/30 text-warning-600 shadow-[0_4px_12px_rgba(90,200,250,0.3)] hover:shadow-[0_6px_20px_rgba(90,200,250,0.4)] hover:bg-warning/30 transition-all duration-200 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/20 before:to-transparent before:pointer-events-none",
        ghost: "text-gray-900 hover:bg-gray-100/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
