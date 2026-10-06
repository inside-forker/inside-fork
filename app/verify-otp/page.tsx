"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeAwareLogo } from "@/components/layout/ThemeAwareLogo";
import { AlertCircle, ArrowLeft, Loader2, ArrowRight } from "lucide-react";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { AuthFormPanel, WelcomePanel } from "@/components/auth/GlassPanel";
import { useToast } from "@/hooks/use-toast";
import { safeNextPath } from "@/lib/auth/return-to";

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const email = searchParams.get("email") || "";
  // Set by signup when the visitor started from a page (e.g. an event).
  const next = safeNextPath(searchParams.get("next"));

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "An unexpected error occurred.");
        setIsLoading(false);
        return;
      }

      toast({
        title: "Email Verified",
        description: "Welcome to Inside Karachi!",
      });
      window.location.href = next || data.redirectTo || "/dashboard";
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setError(null);
    try {
      await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      toast({
        title: "Code Sent",
        description: "Check your email for a new verification code.",
      });
    } catch {
      setError("Failed to resend code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthBackground>
      <div className="min-h-screen flex flex-col">
        <div className="flex justify-between items-center pt-8 pb-4 px-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link
              href="/"
              className="group flex items-center space-x-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all duration-300 text-white/80 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <span className="text-sm font-medium">Home</span>
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <ThemeAwareLogo />
          </motion.div>
          <div className="w-20"></div>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md space-y-6">
            <WelcomePanel className="mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-white"
              >
                <h1 className="text-3xl font-bold mb-2">Verify Your Email</h1>
                <p className="text-white/80 text-sm">
                  Enter the 6-digit code we sent to{" "}
                  {email || "your email address"}
                </p>
              </motion.div>
            </WelcomePanel>

            <AuthFormPanel>
              <motion.form
                onSubmit={handleSubmit}
                className="space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-white/90 font-medium">
                    Verification Code
                  </Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    required
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                      if (error) setError(null);
                    }}
                    className="text-center text-2xl tracking-[0.5em] bg-white/15 border-white/30 text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/30"
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center space-x-2 p-3 rounded-lg bg-red-500/20 border border-red-500/30"
                  >
                    <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                    <p className="text-red-400 text-sm">{error}</p>
                  </motion.div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading || code.length !== 6}
                  className="w-full bg-white/20 hover:bg-white/30 border border-white/30 text-white font-medium py-3 rounded-lg transition-all duration-300 hover:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify Email
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                <div className="text-center space-y-3">
                  <p className="text-white/80 text-sm">
                    Didn&apos;t receive a code?{" "}
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isResending}
                      className="text-white hover:text-white/80 underline disabled:opacity-50"
                    >
                      {isResending ? "Sending..." : "Resend code"}
                    </button>
                  </p>
                  <Link
                    href="/login"
                    className="inline-flex items-center space-x-2 text-white/70 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Login</span>
                  </Link>
                </div>
              </motion.form>
            </AuthFormPanel>
          </div>
        </div>
      </div>
    </AuthBackground>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <AuthBackground>
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </AuthBackground>
      }
    >
      <VerifyOtpContent />
    </Suspense>
  );
}
