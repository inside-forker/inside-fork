import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-border bg-background text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-background/50 dark:border-border dark:hover:bg-accent/50 dark:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 dark:bg-secondary/80 dark:text-secondary-foreground dark:hover:bg-secondary/60",
        ghost:
          "text-foreground hover:bg-accent hover:text-accent-foreground dark:text-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        // Admin primary action: ink fill (17.97:1), pink stays for key state only
        solid:
          "bg-foreground text-background hover:bg-foreground/90 active:bg-foreground/80",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        // Admin 28px controls: row actions, chips, segmented toolbars
        xs: "h-7 rounded-md gap-2 px-3 text-data has-[>svg]:px-2",
        "icon-xs": "size-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Shows a spinner in place of the leading icon, keeps the label, and disables the button. */
    loading?: boolean
  }) {
  const Comp = asChild ? Slot : "button"
  const showSpinner = loading && !asChild

  return (
    <Comp
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size, className }),
        showSpinner && "[&>svg:not([data-spinner])]:hidden",
      )}
      disabled={loading ? true : disabled}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      {...props}
    >
      {/* Slot (asChild) needs exactly one child, so the spinner is only added for real buttons. */}
      {showSpinner ? (
        <>
          <Loader2 data-spinner="" aria-hidden="true" className="animate-spin" />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
