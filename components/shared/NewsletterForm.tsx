"use client";

import { useRef } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useRecaptcha } from "@/hooks/useRecaptcha";

type NewsletterFormProps = {
  buttonLabel: string;
  /** Toast shown once the address is on the list. */
  successTitle: string;
  /** Defaults to the server's message ("already subscribed", etc.). */
  successDescription?: string;
  className?: string;
};

/** Email sign-up for the newsletter list (`/api/newsletter`). */
export function NewsletterForm({
  buttonLabel,
  successTitle,
  successDescription,
  className,
}: NewsletterFormProps) {
  const { toast } = useToast();
  const { executeRecaptcha, loadRecaptcha } = useRecaptcha(
    process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY,
  );
  const recaptchaPreloaded = useRef(false);
  const honeyRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const input = e.currentTarget.querySelector(
        'input[type="email"]',
      ) as HTMLInputElement | null;
      const email = input?.value?.trim() || "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast({
          variant: "destructive",
          title: "Invalid email",
          description: "Please enter a valid email address.",
        });
        input?.focus();
        return;
      }
      const website_confirm = honeyRef.current?.value || "";
      let recaptcha_token: string | undefined;
      try {
        const t = await executeRecaptcha("newsletter_subscribe");
        if (t) recaptcha_token = t as string;
      } catch {
        /* ignore */
      }
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website_confirm, recaptcha_token }),
      });
      const j = await res.json();
      if (res.ok) {
        toast({ title: successTitle, description: successDescription ?? j.message });
        if (input) input.value = "";
        if (honeyRef.current) honeyRef.current.value = "";
      } else {
        toast({
          variant: "destructive",
          title: "Subscription failed",
          description: j.error || "Could not subscribe.",
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Network error",
        description: "Could not subscribe right now.",
      });
    }
  };

  return (
    <form className={className} onSubmit={handleSubmit}>
      <div className="flex overflow-hidden rounded-xl border border-border bg-card">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="email"
            placeholder="Your email address"
            aria-label="Email address"
            className="h-11 border-0 bg-transparent pl-9 pr-3 text-sm placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0"
            onFocus={() => {
              if (!recaptchaPreloaded.current) {
                recaptchaPreloaded.current = true;
                loadRecaptcha();
              }
            }}
          />
          {/* Honeypot field - hidden from users */}
          <input
            ref={honeyRef}
            type="text"
            name="website_confirm"
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
        <Button
          type="submit"
          className="group h-11 rounded-none bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90 active:opacity-80"
        >
          <span className="mr-1.5">{buttonLabel}</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Button>
      </div>
    </form>
  );
}
