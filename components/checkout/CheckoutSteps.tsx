"use client";

import { Check, CreditCard, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CheckoutStepsProps {
  currentStep: "cart" | "details" | "payment" | "complete";
}

export function CheckoutSteps({ currentStep }: CheckoutStepsProps) {
  const steps = [
    { id: "cart", label: "Cart", icon: ShoppingBag },
    { id: "details", label: "Details", icon: User },
    { id: "payment", label: "Payment", icon: CreditCard },
    { id: "complete", label: "Complete", icon: Check },
  ] as const;

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="w-full py-8 mb-6">
      <div className="relative w-full mx-auto px-4 sm:px-6">
        <div className="relative flex items-center justify-between">
          {/* Progress Bar Background */}
          {/* We position absolute with left/right based on the half-width of the circle to ensure it starts/ends at centers */}
          <div className="absolute top-1/2 -translate-y-1/2 left-[20px] right-[20px] h-1 bg-muted/50 rounded-full overflow-hidden" />

          {/* Active Progress Bar */}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 h-1 bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{
              width: `${(currentStepIndex / (steps.length - 1)) * 100}%`,
              left: "20px",
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            style={{
              maxWidth: "calc(100% - 40px)", // 40px is approx 2 * half-width of circle (20px each side)
            }}
          />

          {steps.map((step, index) => {
            const isActive = index <= currentStepIndex;
            const isCurrent = step.id === currentStep;

            return (
              <div
                key={step.id}
                className="relative flex flex-col items-center gap-3 z-10"
              >
                <motion.div
                  initial={false}
                  animate={{
                    scale: isCurrent ? 1.1 : 1,
                    // y: isCurrent ? -5 : 0, // removed bounce for simpler premium feel or keep singular visual pop
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={cn(
                    "flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 transition-all duration-300",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]"
                      : "border-muted bg-background text-muted-foreground",
                    isCurrent && "ring-4 ring-primary/20 ring-offset-2 ring-offset-background"
                  )}
                >
                  <motion.div
                    animate={isCurrent ? { rotate: [0, 10, -10, 0] } : {}}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    <step.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </motion.div>
                </motion.div>

                <span
                  className={cn(
                    "absolute top-full mt-2 text-xs sm:text-sm font-medium transition-all duration-300 whitespace-nowrap",
                    isActive ? "text-primary" : "text-muted-foreground",
                    isCurrent ? "font-bold translate-y-0 opacity-100" : "opacity-70"
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
