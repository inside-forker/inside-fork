"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Mail,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { AuthImmersiveBackground } from "@/components/auth/AuthImmersiveBackground";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { AppleSignInButton } from "@/components/auth/AppleSignInButton";
import { useToast } from "@/hooks/use-toast";

function LoginForm() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationSuccess, setShowVerificationSuccess] = useState(false);
  const [showResendForm, setShowResendForm] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [isResending, setIsResending] = useState(false);

  // Handle URL parameters on component mount
  useEffect(() => {
    const verified = searchParams.get("verified");
    const errorParam = searchParams.get("error");
    const message = searchParams.get("message");

    if (verified === "true") {
      setShowVerificationSuccess(true);
      toast({
        title: "✅ Email Verified!",
        description:
          "Your account has been successfully verified. You can now log in.",
      });
    }

    if (errorParam) {
      setError(errorParam);
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: errorParam,
      });
    }

    if (message) {
      toast({
        title: "Notice",
        description: message,
      });
    }
  }, [searchParams, toast]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        const message = data.error || "An unexpected error occurred.";
        setError(message);

        if (data.code === "email_not_confirmed") {
          // Pre-fill the resend form with the address the user just typed and
          // open it immediately so they can act without any extra steps.
          setResendEmail(email);
          setShowResendForm(true);
          toast({
            variant: "destructive",
            title: "Email Not Verified",
            description:
              "Check your inbox for the confirmation link, or resend it below.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Login Failed",
            description: message,
          });
        }
        return;
      }

      toast({
        title: "Welcome back!",
        description: "You have been successfully logged in.",
      });

      const data = await response.json().catch(() => ({}));
      const role =
        data && typeof data === "object" && "role" in data
          ? String(data.role)
          : null;

      // Prefer next, then returnUrl (middleware uses returnUrl for admin intercepts).
      const nextUrl = searchParams.get("next") || searchParams.get("returnUrl");
      let destination =
        nextUrl && nextUrl.startsWith("/") && !nextUrl.startsWith("//")
          ? nextUrl
          : "/dashboard";

      // data_entry accounts may only use listing capacity
      if (role === "data_entry") {
        destination = "/admin/listing-capacity";
      }

      window.location.href = destination;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    setIsResending(true);

    const response = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resendEmail }),
    });

    const data = await response.json();

    if (!response.ok) {
      toast({
        variant: "destructive",
        title: "Resend Failed",
        description:
          data.message || data.error || "Failed to resend verification email.",
      });
    } else {
      toast({
        title: "Email Sent",
        description: data.message || "Verification email sent successfully.",
      });
      setShowResendForm(false);
      setResendEmail("");
    }

    setIsResending(false);
  };

  const nextParam =
    searchParams.get("next") || searchParams.get("returnUrl") || undefined;

  return (
    <AuthImmersiveBackground>
      <div className="flex min-h-screen flex-col">
        {/* Header: back link + wordmark */}
        <div className="flex items-center justify-between px-6 pt-8 md:px-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link
              href="/"
              className="group flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition-all duration-300 hover:border-white/30 hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Home
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Link href="/" className="block transition-opacity hover:opacity-80">
              <Image
                src="/assets/logo-white.png"
                alt="Inside Karachi"
                width={116}
                height={38}
                className="h-auto w-auto"
                priority
              />
            </Link>
          </motion.div>
        </div>

        {/* Main content — anchored left, vertically centered */}
        <div className="flex flex-1 items-center px-6 py-10 md:px-16">
          <div className="w-full max-w-md">
            {/* Verification success banner */}
            {showVerificationSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.45 }}
                className="mb-5 rounded-xl border border-green-400/30 bg-green-500/15 p-4 backdrop-blur-md"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-400" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-green-300">
                      Email verified successfully
                    </h3>
                    <p className="mt-1 text-xs text-green-200/80">
                      Your account is verified. Sign in below to access
                      everything.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowVerificationSuccess(false)}
                    className="text-green-300/60 transition-colors hover:text-green-300"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </div>
              </motion.div>
            )}

            {/* Eyebrow + headline */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="font-mono-label mb-3 text-[11px] uppercase tracking-[0.22em] text-white/70"
            >
              Karachi &middot; City Guide
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.22 }}
              className="font-display mb-6 text-4xl font-medium tracking-tight text-white md:text-[2.75rem]"
            >
              Welcome back
            </motion.h1>

            {/* Glass auth card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="rounded-2xl border border-white/15 bg-white/[0.08] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl md:p-7"
            >
              <form onSubmit={handleSignIn} className="space-y-5">
                {/* Email */}
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="font-mono-label text-[11px] uppercase tracking-[0.16em] text-white/70"
                  >
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" />
                    <Input
                      id="email"
                      type="email"
                      name="email"
                      placeholder="you@example.com"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      className="border-white/20 bg-white/10 pl-10 text-white placeholder:text-white/50 focus-visible:border-white/40 focus-visible:ring-white/30"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="password"
                      className="font-mono-label text-[11px] uppercase tracking-[0.16em] text-white/70"
                    >
                      Password
                    </Label>
                    <Link
                      href="/forgot-password"
                      className="font-mono-label text-[11px] uppercase tracking-wide text-white/60 transition-colors hover:text-white"
                    >
                      Forgot?
                    </Link>
                  </div>
                  <div className="[&_button:hover]:text-white [&_button]:text-white/55 [&_svg]:text-white/55">
                    <PasswordInput
                      id="password"
                      name="password"
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      disabled={isLoading}
                      showStrength={false}
                      className="border-white/20 bg-white/10 text-white placeholder:text-white/50 focus-visible:border-white/40 focus-visible:ring-white/30"
                    />
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <motion.div
                    className="flex items-center gap-x-2 rounded-lg border border-red-400/30 bg-red-500/15 p-3 text-sm text-red-200"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <p>{error}</p>
                  </motion.div>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full rounded-lg bg-primary py-3 font-medium text-white transition-all duration-200 hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.99]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/15" />
                <span className="font-mono-label text-[10px] uppercase tracking-[0.18em] text-white/45">
                  or continue with
                </span>
                <div className="h-px flex-1 bg-white/15" />
              </div>

              {/* Social */}
              <div className="grid grid-cols-2 gap-3">
                <GoogleSignInButton next={nextParam} label="Google" />
                <AppleSignInButton next={nextParam} label="Apple" />
              </div>

              {/* Sign up */}
              <p className="mt-5 text-center text-sm text-white/70">
                Don&apos;t have an account?{" "}
                <Link
                  href={
                    nextParam
                      ? `/signup?next=${encodeURIComponent(nextParam)}`
                      : "/signup"
                  }
                  className="font-semibold text-white underline transition-colors hover:text-white/80"
                >
                  Sign up
                </Link>
              </p>
            </motion.div>

            {/* Resend verification */}
            {showResendForm ? (
              <motion.form
                onSubmit={handleResendVerification}
                className="mt-4 space-y-4 rounded-2xl border border-white/15 bg-white/[0.08] p-6 backdrop-blur-xl"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-white">
                    Resend verification email
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowResendForm(false)}
                    className="text-white/60 transition-colors hover:text-white"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="resendEmail"
                    className="font-mono-label text-[11px] uppercase tracking-[0.16em] text-white/70"
                  >
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" />
                    <Input
                      id="resendEmail"
                      type="email"
                      placeholder="you@example.com"
                      required
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      className="border-white/20 bg-white/10 pl-10 text-white placeholder:text-white/50 focus-visible:border-white/40 focus-visible:ring-white/30"
                      disabled={isResending}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full rounded-lg border-0 bg-gradient-to-r from-[#ff184d] to-[#ff477e] text-base font-medium text-white hover:from-[#ff477e] hover:to-[#ff184d]"
                  disabled={isResending}
                >
                  {isResending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Resend verification email
                    </>
                  )}
                </Button>
              </motion.form>
            ) : (
              <motion.div
                className="mt-4 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <button
                  type="button"
                  onClick={() => setShowResendForm(true)}
                  className="text-sm text-white/60 underline transition-colors hover:text-white"
                >
                  Didn&apos;t receive verification email?
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </AuthImmersiveBackground>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthImmersiveBackground>
          <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
          </div>
        </AuthImmersiveBackground>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
