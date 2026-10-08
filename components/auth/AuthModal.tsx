"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { AppleSignInButton } from "@/components/auth/AppleSignInButton";
import { useToast } from "@/hooks/use-toast";
import { notifyAuthChanged } from "@/lib/auth/client-events";
import { AlertCircle, Loader2 } from "lucide-react";

type AuthTab = "login" | "signup";

export function AuthModal({
  open,
  onOpenChange,
  onSuccess,
  nextPath,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Where Google/Apple should return after OAuth. */
  nextPath: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState<AuthTab>("login");

  const finishAuth = () => {
    notifyAuthChanged();
    router.refresh();
    onOpenChange(false);
    onSuccess();
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const resetErrors = () => setError(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    resetErrors();
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : "Could not log in. Please try again.";
        setError(message);
        toast({
          variant: "destructive",
          title: "Login failed",
          description: message,
        });
        return;
      }
      toast({ title: "Welcome back!", description: "You are signed in." });
      finishAuth();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    resetErrors();
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          username: username.trim() || email.split("@")[0],
          fullName: fullName.trim() || username.trim() || "Student",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : "Could not create your account.";
        setError(message);
        toast({
          variant: "destructive",
          title: "Signup failed",
          description: message,
        });
        return;
      }
      // Many signups need email verify before a session exists.
      if (data.requiresVerification || data.needsVerification) {
        toast({
          title: "Check your email",
          description: "Confirm your address, then come back and log in.",
        });
        setTab("login");
        return;
      }
      toast({ title: "Account created", description: "You are signed in." });
      finishAuth();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {tab === "login" ? "Log in to continue" : "Create an account"}
          </DialogTitle>
          <DialogDescription>
            {tab === "login"
              ? "Sign in to Inside Karachi, then verify your Parchi ID at checkout for the student discount."
              : "Create an Inside Karachi account to continue to checkout."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 rounded-lg bg-muted p-1">
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              tab === "login"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
            onClick={() => {
              setTab("login");
              resetErrors();
            }}
          >
            Log in
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              tab === "signup"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
            onClick={() => {
              setTab("signup");
              resetErrors();
            }}
          >
            Sign up
          </button>
        </div>

        <div className="space-y-2">
          <GoogleSignInButton
            next={nextPath}
            label="Continue with Google"
            className="w-full font-medium"
          />
          <AppleSignInButton
            next={nextPath}
            label="Continue with Apple"
            className="w-full font-medium"
          />
        </div>

        <div className="relative py-1 text-center text-xs text-muted-foreground">
          <span className="bg-background px-2">or use email</span>
        </div>

        <form
          onSubmit={tab === "login" ? handleLogin : handleSignup}
          className="space-y-3"
        >
          {tab === "signup" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="auth-fullname">Full name</Label>
                <Input
                  id="auth-fullname"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-username">Username</Label>
                <Input
                  id="auth-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-password">Password</Label>
            <PasswordInput
              id="auth-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              showStrength={tab === "signup"}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : tab === "login" ? (
              "Log in & continue"
            ) : (
              "Sign up & continue"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
