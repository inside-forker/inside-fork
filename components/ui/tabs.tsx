"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

type TabsVariant = "default" | "underline" | "segmented";

// TabsList passes its variant to its triggers, so callers set it once.
const TabsVariantContext = React.createContext<TabsVariant>("default");

const crispFocus =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const tabsListVariants = cva("", {
  variants: {
    variant: {
      default:
        "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      // Admin page and drawer sections: text tabs over a hairline, 2px pink marker
      underline: "inline-flex items-center gap-6 border-b border-border",
      // Admin view switches: quiet track, active segment raised by a hairline
      segmented: "inline-flex items-center gap-1 rounded-lg bg-muted p-1",
    },
  },
  defaultVariants: { variant: "default" },
});

const tabsTriggerVariants = cva("", {
  variants: {
    variant: {
      default:
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      underline: cn(
        "relative inline-flex items-center gap-2 whitespace-nowrap pb-3 pt-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-60 data-[state=active]:text-foreground",
        "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:after:bg-primary",
        crispFocus,
      ),
      segmented: cn(
        "inline-flex h-7 items-center gap-2 whitespace-nowrap rounded-sm border border-transparent px-3 text-data font-medium text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-60 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground",
        crispFocus,
      ),
    },
  },
  defaultVariants: { variant: "default" },
});

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
    variant?: TabsVariant;
  }
>(({ className, variant = "default", ...props }, ref) => (
  <TabsVariantContext.Provider value={variant}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  </TabsVariantContext.Provider>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
