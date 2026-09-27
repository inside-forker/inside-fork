"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeAwareLogo } from "@/components/layout/ThemeAwareLogo";
import {
  Mail,
  AlertCircle,
  Loader2,
  ArrowRight,
  CheckCircle,
  ArrowLeft,
  User,
  UserCheck,
} from "lucide-react";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { AuthFormPanel, WelcomePanel } from "@/components/auth/GlassPanel";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { AppleSignInButton } from "@/components/auth/AppleSignInButton";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { SignupRequest, UsernameCheckResponse } from "@/types/auth.types";

function SignupContent() {
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite");
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null,
  );
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [isNewsletterLoading, setIsNewsletterLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const { executeRecaptcha } = useRecaptcha(
    process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY,
  );

  // Debounced username check
  const debouncedUsername = useDebounce(username, 500);

  // Check username availability
  const checkUsernameAvailability = useCallback(
    async (usernameToCheck: string) => {
      if (!usernameToCheck.trim()) {
        setUsernameAvailable(null);
        return;
      }

      setCheckingUsername(true);
      try {
        const response = await fetch("/api/auth/username-check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username: usernameToCheck }),
        });

        const data: UsernameCheckResponse = await response.json();

        if (response.ok) {
          setUsernameAvailable(data.available);
          if (!data.available) {
            setFieldErrors((prev) => ({
              ...prev,
              username: data.message || "Username is already taken",
            }));
          } else {
            setFieldErrors((prev) => {
              const { username: _, ...rest } = prev;
              return rest;
            });
          }
        } else {
          setUsernameAvailable(false);
          setFieldErrors((prev) => ({
            ...prev,
            username: data.message || "Unable to check username availability",
          }));
        }
      } catch (error) {
        console.error("Username check error:", error);
        setUsernameAvailable(false);
        setFieldErrors((prev) => ({
          ...prev,
          username: "Unable to check username availability",
        }));
      } finally {
        setCheckingUsername(false);
      }
    },
    [],
  );

  // Effect to check username availability when debounced value changes
  React.useEffect(() => {
    if (debouncedUsername) {
      checkUsernameAvailability(debouncedUsername);
    } else {
      setUsernameAvailable(null);
    }
  }, [debouncedUsername, checkUsernameAvailability]);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setFieldErrors({});

    // Read honeypot field value from the form (bots may fill it)
    const form = e.currentTarget as HTMLFormElement;
    const hpInput = form.elements.namedItem(
      "website_confirm",
    ) as HTMLInputElement | null;
    const websiteConfirm = hpInput?.value || "";

    // Client-side validation
    if (!username.trim()) {
      setFieldErrors({ username: "Username is required" });
      setIsLoading(false);
      return;
    }

    if (usernameAvailable === false) {
      setFieldErrors({ username: "Username is already taken" });
      setIsLoading(false);
      return;
    }

    if (usernameAvailable === null && username.trim()) {
      setFieldErrors({
        username: "Please wait while we check username availability",
      });
      setIsLoading(false);
      return;
    }

    // Password validation
    if (!password) {
      setFieldErrors({ password: "Password is required" });
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setFieldErrors({
        password: "Password must be at least 8 characters long",
      });
      setIsLoading(false);
      return;
    }

    // Confirm password validation
    if (!confirmPassword) {
      setFieldErrors({ confirmPassword: "Please confirm your password" });
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords do not match" });
      setIsLoading(false);
      return;
    }

    let recaptcha_token: string | undefined;
    try {
      const t = await executeRecaptcha("signup");
      if (t) recaptcha_token = t;
    } catch (err) {
      console.warn("reCAPTCHA token fetch failed", err);
    }

    // If a site key is configured but we still have no token (blocked script,
    // network, etc.), fail here with a clear message instead of a cryptic
    // "reCAPTCHA token missing" from the API.
    if (
      !recaptcha_token &&
      typeof window !== "undefined" &&
      window.__recaptchaSiteKey
    ) {
      const message =
        "Security check failed to load. Please refresh the page or disable ad blockers and try again.";
      setError(message);
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: message,
      });
      setIsLoading(false);
      return;
    }

    const signupData: SignupRequest & {
      website_confirm?: string;
      recaptcha_token?: string;
    } = {
      email: email.trim(),
      password,
      confirmPassword,
      username: username.trim().toLowerCase(),
      full_name: fullName.trim() || undefined,
      // honeypot
      website_confirm: websiteConfirm,
      invite_code: inviteCode || undefined,
      recaptcha_token,
    };

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(signupData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.field) {
          setFieldErrors({ [data.field]: data.error });
        } else {
          setError(data.error);
        }
        toast({
          variant: "destructive",
          title: "Signup Failed",
          description: data.error,
        });
        return;
      }

      // Show success message and redirect
      toast({
        title: "Account Created!",
        description: data.requiresVerification
          ? "Check your email for a verification code."
          : "Welcome to Inside Karachi!",
      });
      window.location.href = data.redirectTo;
    } catch (error) {
      console.error("Signup error:", error);
      setError("An unexpected error occurred. Please try again.");
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewsletterSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;

    setIsNewsletterLoading(true);
    try {
      let recaptcha_token: string | undefined;
      try {
        const t = await executeRecaptcha("newsletter_subscribe");
        if (t) recaptcha_token = t;
      } catch {
        /* loading/exec failures fall through; server will reject in production */
      }

      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newsletterEmail.trim(),
          source: "signup_page",
          recaptcha_token,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast({
          variant: "destructive",
          title: "Subscription Failed",
          description: data.error || "An unexpected error occurred.",
        });
        return;
      }

      toast({
        title: "Subscribed",
        description: data.message || "You have been added to our newsletter.",
      });
      setNewsletterEmail("");
    } catch {
      toast({
        variant: "destructive",
        title: "Subscription Failed",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsNewsletterLoading(false);
    }
  };

  return (
    <AuthBackground>
      <div className="min-h-screen flex flex-col">
        {/* Header with back button and logo */}
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
          <div className="w-20"></div> {/* Spacer for centering logo */}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md space-y-6">
            {/* Welcome Message */}
            <WelcomePanel className="mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-white"
              >
                <h1 className="text-3xl font-bold mb-2">Create an Account</h1>
                <p className="text-white/80 text-sm">
                  Join the Inside Karachi community with your unique username
                </p>
              </motion.div>
            </WelcomePanel>

            {/* Signup Form */}
            <AuthFormPanel>
              <motion.form
                onSubmit={handleSignUp}
                className="space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                {/* Honeypot field - should remain hidden from real users */}
                <input
                  type="text"
                  name="website_confirm"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                  defaultValue=""
                />
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/90 font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      name="email"
                      placeholder="name@example.com"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                        if (fieldErrors.email) {
                          setFieldErrors((prev) => {
                            const { email: _, ...rest } = prev;
                            return rest;
                          });
                        }
                      }}
                      className="pl-10 bg-white/15 border-white/30 text-white placeholder:text-white/60 focus:border-white/50 focus:ring-white/30"
                      disabled={isLoading}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="text-red-400 text-sm">{fieldErrors.email}</p>
                  )}
                </div>

                {/* Username Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="username"
                    className="text-white/90 font-medium"
                  >
                    Username *
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    <Input
                      id="username"
                      type="text"
                      name="username"
                      placeholder="johndoe"
                      required
                      value={username}
                      onChange={(e) => {
                        const value = e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_]/g, "");
                        setUsername(value);
                        if (error) setError(null);
                        if (fieldErrors.username) {
                          setFieldErrors((prev) => {
                            const { username: _, ...rest } = prev;
                            return rest;
                          });
                        }
                      }}
                      className="pl-10 bg-white/15 border-white/30 text-white placeholder:text-white/60 focus:border-white/50 focus:ring-white/30"
                      disabled={isLoading}
                      maxLength={30}
                    />
                    {checkingUsername && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 animate-spin" />
                    )}
                    {!checkingUsername &&
                      username &&
                      usernameAvailable !== null && (
                        <UserCheck
                          className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 ${
                            usernameAvailable
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        />
                      )}
                  </div>
                  {fieldErrors.username && (
                    <p className="text-red-400 text-sm">
                      {fieldErrors.username}
                    </p>
                  )}
                  {username && !fieldErrors.username && (
                    <p className="text-white/60 text-xs">
                      Username must be 3-30 characters, letters, numbers, and
                      underscores only
                    </p>
                  )}
                </div>

                {/* Full Name Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="fullName"
                    className="text-white/90 font-medium"
                  >
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    <Input
                      id="fullName"
                      type="text"
                      name="fullName"
                      placeholder="Your full name"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (error) setError(null);
                        if (fieldErrors.full_name) {
                          setFieldErrors((prev) => {
                            const { full_name: _, ...rest } = prev;
                            return rest;
                          });
                        }
                      }}
                      className="pl-10 bg-white/15 border-white/30 text-white placeholder:text-white/60 focus:border-white/50 focus:ring-white/30"
                      disabled={isLoading}
                      maxLength={100}
                    />
                  </div>
                  {fieldErrors.full_name && (
                    <p className="text-red-400 text-sm">
                      {fieldErrors.full_name}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-white/90 font-medium"
                  >
                    Password
                  </Label>
                  <PasswordInput
                    id="password"
                    name="password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => {
                          const { password: _, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    disabled={isLoading}
                    placeholder="Must be at least 8 characters"
                    className="bg-white/15 border-white/30 text-white placeholder:text-white/60 focus:border-white/50 focus:ring-white/30"
                  />
                  {fieldErrors.password && (
                    <p className="text-red-400 text-sm">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-white/90 font-medium"
                  >
                    Confirm Password
                  </Label>
                  <PasswordInput
                    id="confirmPassword"
                    name="confirmPassword"
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError(null);
                      if (fieldErrors.confirmPassword) {
                        setFieldErrors((prev) => {
                          const { confirmPassword: _, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    disabled={isLoading}
                    placeholder="Re-enter your password"
                    className="bg-white/15 border-white/30 text-white placeholder:text-white/60 focus:border-white/50 focus:ring-white/30"
                  />
                  {fieldErrors.confirmPassword && (
                    <p className="text-red-400 text-sm">
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>

                {/* Benefits List */}
                <div className="space-y-3">
                  <p className="text-white/90 text-sm font-medium">
                    What you&apos;ll get:
                  </p>
                  <div className="space-y-2">
                    {[
                      "Exclusive access to Karachi's best spots",
                      "Early booking for popular events",
                      "Personalized recommendations",
                      "Member-only deals and discounts",
                    ].map((benefit, index) => (
                      <motion.div
                        key={index}
                        className="flex items-center gap-2 text-white/80 text-sm"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
                      >
                        <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                        <span>{benefit}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <motion.div
                    className="flex items-center gap-x-2 rounded-lg bg-red-500/20 border border-red-500/30 p-3 text-sm text-red-200"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <p>{error}</p>
                  </motion.div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </motion.form>

              {/* Divider */}
              <motion.div
                className="my-6 flex items-center gap-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <div className="h-px flex-1 bg-white/20" />
                <span className="text-xs text-white/60">OR</span>
                <div className="h-px flex-1 bg-white/20" />
              </motion.div>

              {/* Google Sign In */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.55 }}
              >
                <GoogleSignInButton
                  invite={inviteCode || undefined}
                  label="Sign up with Google"
                />
              </motion.div>

              {/* Apple Sign In */}
              <motion.div
                className="mt-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <AppleSignInButton
                  invite={inviteCode || undefined}
                  label="Sign up with Apple"
                />
              </motion.div>

              {/* Login Link */}
              <motion.div
                className="mt-6 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <p className="text-white/70 text-sm">
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="text-white font-semibold hover:text-white/80 transition-colors underline"
                  >
                    Sign in
                  </Link>
                </p>
              </motion.div>
            </AuthFormPanel>

            {/* Newsletter Section */}
            <WelcomePanel className="mt-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="text-white text-center"
              >
                <h3 className="font-semibold mb-2">Become an Insider</h3>
                <p className="text-white/70 text-sm mb-4">
                  Join our newsletter to get exclusive deals, early access to
                  events, and the best of Karachi delivered to you.
                </p>
                <form
                  className="flex gap-2"
                  onSubmit={handleNewsletterSubmit}
                >
                  <Input
                    type="email"
                    placeholder="Your best email address"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    disabled={isNewsletterLoading}
                    className="bg-white/15 border-white/30 text-white placeholder:text-white/60 focus:border-white/50 focus:ring-white/30 text-sm"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isNewsletterLoading || !newsletterEmail.trim()}
                    className="bg-primary hover:bg-primary/90 text-white px-4 whitespace-nowrap disabled:opacity-50"
                  >
                    {isNewsletterLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Sign Me Up"
                    )}
                  </Button>
                </form>
              </motion.div>
            </WelcomePanel>
          </div>
        </div>
      </div>
    </AuthBackground>
  );
}

export default function SignupPage() {
  return (
    <React.Suspense
      fallback={
        <AuthBackground>
          <div className="min-h-screen flex flex-col items-center justify-center">
            <Loader2 className="h-10 w-10 text-white animate-spin" />
          </div>
        </AuthBackground>
      }
    >
      <SignupContent />
    </React.Suspense>
  );
}
