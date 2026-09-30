"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  XCircle,
  AlertTriangle,
  Home,
  CreditCard,
  Shield,
  Mail,
  RefreshCw,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { ResumeBookingCard } from "./ResumeBookingCard";
import type {
  ResumableBookingDTO,
  ResumableResponse,
} from "@/types/checkout-resume.types";

interface CheckoutFailedContentProps {
  status: "failed" | "security_failed";
  basketId: string;
  transactionId?: string;
  errCode?: string;
  errMsg?: string;
}

export function CheckoutFailedContent({
  status,
  basketId,
  transactionId,
  errCode,
  errMsg,
}: CheckoutFailedContentProps) {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const [resumable, setResumable] = useState<ResumableBookingDTO | null>(null);
  const [resumeBlockedMessage, setResumeBlockedMessage] = useState<string | null>(
    null,
  );
  const [isResuming, setIsResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Look up the booking that just failed by its reference, so we can offer to
  // re-pay THAT booking. `basketId` here is PayFast's basket_id, which on the
  // web path equals the booking_reference.
  useEffect(() => {
    if (status === "security_failed" || !basketId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/checkout/resumable?bookingReference=${encodeURIComponent(basketId)}`,
        );
        const body = (await res.json()) as ResumableResponse;
        if (cancelled) return;
        if (body.booking) setResumable(body.booking);
        else if (body.message) setResumeBlockedMessage(body.message);
      } catch {
        // Non-fatal: the static failure actions below still apply.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, basketId]);

  const handleResume = async () => {
    if (!resumable) return;
    setIsResuming(true);
    setResumeError(null);
    try {
      const res = await fetch(
        `/api/bookings/${resumable.booking_id}/resume-payment`,
        { method: "POST" },
      );
      const body = await res.json();
      if (!res.ok) {
        setResumeError(body?.error ?? "Couldn't resume this booking.");
        return;
      }
      router.push(`/checkout/payment?bookingId=${resumable.booking_id}`);
    } catch {
      setResumeError("Couldn't resume this booking. Please try again.");
    } finally {
      setIsResuming(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const isSecurityFailed = status === "security_failed";


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
          {/* Error Icon */}
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
              {isSecurityFailed ? (
                <AlertTriangle className="w-12 h-12 text-red-500" />
              ) : (
                <XCircle className="w-12 h-12 text-red-500" />
              )}
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
              className="border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/10"
            >
              {isSecurityFailed ? (
                <>
                  <Shield className="w-3 h-3 mr-1.5" />
                  Security Issue
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 mr-1.5" />
                  Payment Failed
                </>
              )}
            </Badge>

            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              {isSecurityFailed
                ? "Security Validation Failed"
                : "Payment Unsuccessful"}
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-md mx-auto px-4">
              {isSecurityFailed
                ? "The payment callback could not be verified. This may indicate a security issue."
                : errMsg ||
                  "We couldn't process your payment. No charges have been made to your account."}
            </p>
          </motion.div>

          {/* Transaction Details Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="relative group"
          >

            <div className="relative rounded-2xl border border-red-500/20 bg-red-500/5 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Transaction Details
                </h3>
                <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30">
                  {isSecurityFailed ? "Security Error" : "Failed"}
                </Badge>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Booking Reference
                  </span>
                  <span className="font-mono font-medium text-right break-all">
                    {basketId || "N/A"}
                  </span>
                </div>

                {transactionId && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Transaction ID
                    </span>
                    <span className="font-mono font-medium text-right break-all">
                      {transactionId}
                    </span>
                  </div>
                )}

                {errCode && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Error Code
                    </span>
                    <span className="font-mono font-medium text-right break-all">
                      {errCode}
                    </span>
                  </div>
                )}

                <div className="pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Status
                    </span>
                    <span className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-red-500 rounded-full" />
                      {isSecurityFailed ? "Security Failed" : "Payment Failed"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Help Notice - Only for payment failures, not security issues */}
          {!isSecurityFailed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4"
            >
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-sm flex-1">
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    Common reasons for payment failure:
                  </p>
                  <ul className="list-disc list-inside text-amber-800 dark:text-amber-200 space-y-0.5">
                    <li>Insufficient funds in your account</li>
                    <li>Incorrect card details or PIN</li>
                    <li>Card expired or blocked by bank</li>
                    <li>Transaction declined by your bank</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {/* Support Message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-center px-4"
          >
            <p className="text-sm text-muted-foreground">
              {isSecurityFailed
                ? "Please contact our support team if you believe this is an error or if you were charged."
                : "You can try again with a different payment method or contact your bank for assistance."}
            </p>
          </motion.div>

          {/* Resume the exact booking that just failed, rather than sending the
              user back to a cart that no longer has anything in it. */}
          {!isSecurityFailed && resumable && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="w-full"
            >
              <ResumeBookingCard
                booking={resumable}
                onResume={handleResume}
                onDismiss={() => setResumable(null)}
                dismissLabel="Browse other events"
                isResuming={isResuming}
                error={resumeError}
              />
            </motion.div>
          )}

          {!isSecurityFailed && !resumable && resumeBlockedMessage && (
            <p className="text-sm text-muted-foreground text-center">
              {resumeBlockedMessage}
            </p>
          )}

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-3 items-stretch justify-center w-full sm:w-auto"
          >
            {!isSecurityFailed && !resumable && (
              <Button asChild size="lg" className="w-full sm:w-auto sm:px-8">
                <Link href="/events" className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Browse Events
                </Link>
              </Button>
            )}

            <Button
              asChild
              variant={isSecurityFailed ? "default" : "outline"}
              size="lg"
              className="w-full sm:w-auto sm:px-8"
            >
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
