"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  Home,
  Ticket,
  Mail,
  Clock,
  CreditCard,
  Shield,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/lib/context/cartStore";

interface CheckoutSuccessContentProps {
  status: "paid" | "pending" | "security_failed";
  basketId: string;
  transactionId?: string;
  errCode?: string;
  errMsg?: string; // Used for security_failed status
  /** True only when fulfillment actually queued/sent the confirmation email. */
  emailSent?: boolean;
}

export function CheckoutSuccessContent({
  status,
  basketId,
  transactionId,
  errCode,
  errMsg: _errMsg, // Unused in paid/pending, but available for security_failed
  emailSent = false,
}: CheckoutSuccessContentProps) {
  const clearCart = useCartStore((s) => s.clearCart);

  // Clear the cart only once payment is actually confirmed.
  //
  // This used to happen back in `CheckoutClient` the moment the booking row was
  // created - i.e. before the user had even seen the payment page - which is
  // why a failed payment always dropped them back onto an empty cart. `status`
  // here is derived from a server-validated PayFast callback hash (an invalid
  // hash renders `security_failed` instead), so `paid` is trustworthy.
  useEffect(() => {
    if (status === "paid") {
      clearCart();
    }
  }, [status, clearCart]);

  // Trigger confetti for successful payment
  useEffect(() => {
    if (status === "paid") {
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ["#ef4444", "#f97316", "#f59e0b"],
          disableForReducedMotion: true,
          useWorker: false,
        } as unknown as undefined);

        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: ["#ef4444", "#f97316", "#f59e0b"],
          disableForReducedMotion: true,
          useWorker: false,
        } as unknown as undefined);

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();
    }
  }, [status]);



  // Success State (Paid)
  if (status === "paid") {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">





        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl w-full space-y-8"
          >
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 15,
                delay: 0.2,
              }}
              className="text-center"
            >
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-700/10">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
            </motion.div>

            {/* Heading */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-center space-y-3"
            >
              <Badge
                variant="outline"
                className="border-green-500/30 text-green-600 dark:text-green-400 bg-green-500/10"
              >
                <Sparkles className="w-3 h-3 mr-1.5" />
                Payment Successful
              </Badge>

              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                All Set!
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground max-w-md mx-auto">
                Your payment has been processed successfully. Get ready for an
                amazing experience!
              </p>
            </motion.div>

            {/* Transaction Details Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="relative group"
            >

              <div className="relative rounded-2xl border border-border/50 bg-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Transaction Details
                  </h3>
                  <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
                    Confirmed
                  </Badge>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Ticket className="w-4 h-4" />
                      Booking Reference
                    </span>
                    <span className="font-mono font-medium text-right break-all">
                      {basketId}
                    </span>
                  </div>

                  {transactionId && (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Transaction ID
                      </span>
                      <span className="font-mono font-medium text-right break-all">
                        {transactionId}
                      </span>
                    </div>
                  )}

                  <div className="pt-3 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Status
                      </span>
                      <span className="font-semibold text-green-600 dark:text-green-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Paid
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Email Confirmation Notice */}
            {emailSent ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="text-center space-y-2"
              >
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span className="text-center">
                    Confirmation email sent to your registered email address
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="text-center space-y-2"
              >
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span className="text-center">
                    Your tickets are ready in the app. If a confirmation email
                    does not arrive shortly, check spam or open View My Tickets.
                  </span>
                </div>
              </motion.div>
            )}

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-3 items-stretch justify-center w-full sm:w-auto"
            >
              <Button asChild size="lg" className="w-full sm:w-auto sm:px-8">
                <Link href="/dashboard/bookings" className="gap-2">
                  <Ticket className="w-4 h-4" />
                  View My Tickets
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full sm:w-auto sm:px-8"
              >
                <Link href="/" className="gap-2">
                  <Home className="w-4 h-4" />
                  Back to Home
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Pending State
  if (status === "pending") {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">

        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl w-full space-y-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 15,
                delay: 0.2,
              }}
              className="text-center"
            >
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-amber-500/10">
                <Clock className="w-12 h-12 text-amber-500 animate-pulse" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-center space-y-3"
            >
              <Badge
                variant="outline"
                className="border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
              >
                <Clock className="w-3 h-3 mr-1.5" />
                Processing Payment
              </Badge>

              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                Almost There...
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground max-w-md mx-auto">
                Your payment is being processed. This usually takes just a few
                minutes.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="rounded-2xl border border-border/50 bg-card p-6 space-y-4"
            >
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Transaction Details
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">
                    Booking Reference
                  </span>
                  <span className="font-mono font-medium text-right break-all">
                    {basketId}
                  </span>
                </div>

                {transactionId && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">
                      Transaction ID
                    </span>
                    <span className="font-mono font-medium text-right break-all">
                      {transactionId}
                    </span>
                  </div>
                )}

                <div className="pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                      Pending
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="text-center px-4"
            >
              <p className="text-sm text-muted-foreground">
                You&apos;ll receive a confirmation email once the payment is
                complete
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-3 items-stretch justify-center w-full sm:w-auto"
            >
              <Button asChild size="lg" className="w-full sm:w-auto sm:px-8">
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full sm:w-auto sm:px-8"
              >
                <Link href="/">Back to Home</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Security Failed State (only possible on success URL if hash validation fails)
  if (status === "security_failed") {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">

        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl w-full space-y-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 15,
                delay: 0.2,
              }}
              className="text-center"
            >
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-600/10">
                <AlertTriangle className="w-12 h-12 text-red-500" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-center space-y-3"
            >
              <Badge
                variant="outline"
                className="border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/10"
              >
                <Shield className="w-3 h-3 mr-1.5" />
                Security Issue
              </Badge>

              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                Security Validation Failed
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground max-w-md mx-auto px-4">
                The payment callback could not be verified. This may indicate a
                security issue.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 space-y-4"
            >
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Transaction Details
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">
                    Booking Reference
                  </span>
                  <span className="font-mono font-medium text-right break-all">
                    {basketId || "N/A"}
                  </span>
                </div>

                {transactionId && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">
                      Transaction ID
                    </span>
                    <span className="font-mono font-medium text-right break-all">
                      {transactionId}
                    </span>
                  </div>
                )}

                {errCode && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">Error Code</span>
                    <span className="font-mono font-medium text-right break-all">
                      {errCode}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="text-center px-4"
            >
              <p className="text-sm text-muted-foreground">
                Please contact support if you believe this is an error or if you
                were charged.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-3 items-stretch justify-center w-full sm:w-auto"
            >
              <Button asChild size="lg" className="w-full sm:w-auto sm:px-8">
                <Link href="/contact" className="gap-2">
                  <Mail className="w-4 h-4" />
                  Contact Support
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full sm:w-auto sm:px-8"
              >
                <Link href="/" className="gap-2">
                  <Home className="w-4 h-4" />
                  Back to Home
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  // If we get here, something went wrong - this shouldn't happen
  return null;
}
