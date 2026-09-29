"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeAwareLogo } from "./ThemeAwareLogo";
import {
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Mail,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { FooterLinkTabs } from "./FooterLinkTabs";
import { useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { CurrentYear } from "@/components/ui/CurrentYear";
import { useScroll } from "@/lib/context/scroll-context";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { useInView } from "@/lib/hooks/use-in-view";

// Define the type for the categories prop
type Category = { name: string; slug: string };

interface FooterProps {
  serverCategories?: Category[];
}

// Curated Explore links for footer (static)
const curatedExploreLinks = [
  { name: "Eat & Drink", href: "/listings" },
  { name: "Events", href: "/events" },
  { name: "Where to Stay", href: "/listings/where-to-stay" },
  { name: "Things to do", href: "/listings/things-to-do" },
];

// Footer links configuration
const footerLinks = {
  explore: curatedExploreLinks,
  forBusinesses: [
    { name: "Get Listed", href: "/get-listed" },
    { name: "Membership", href: "/membership" },
  ],
  company: [
    { name: "About Us", href: "/about" },
    { name: "Contact Us", href: "/contact" },
    { name: "Privacy Policy", href: "/privacy-policy" },
    { name: "Terms & Conditions", href: "/terms-and-conditions" },
    { name: "Refund Policy", href: "/refund-policy" },
    { name: "Service Policy", href: "/service-policy" },
    { name: "Delete Account", href: "/delete-account" },
  ],
};

const socialLinks = [
  {
    name: "Facebook",
    icon: Facebook,
    href: "https://www.facebook.com/people/Inside-Karachi/61578236395665",
  },
  {
    name: "Instagram",
    icon: Instagram,
    href: "https://www.instagram.com/insidekhi/",
  },
  { name: "Twitter", icon: Twitter, href: "https://x.com/insideKHI" },
  {
    name: "Youtube",
    icon: Youtube,
    href: "https://www.youtube.com/@insideKHI",
  },
];

export function Footer({ serverCategories: _serverCategories }: FooterProps) {
  const footerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(footerRef, { threshold: 0.2 });
  const { setIsFooterInView } = useScroll();
  const { toast } = useToast();
  const { executeRecaptcha, loadRecaptcha } = useRecaptcha(
    process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY,
  );
  const recaptchaPreloaded = useRef(false);
  const honeyRef = useRef<HTMLInputElement>(null);

  // When isInView changes, update the global state
  useEffect(() => {
    setIsFooterInView(isInView);
  }, [isInView, setIsFooterInView]);

  const handleNewsletterSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    try {
      const target = e.currentTarget as HTMLFormElement;
      const input = target.querySelector(
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
        body: JSON.stringify({
          email,
          website_confirm,
          recaptcha_token,
        }),
      });
      const j = await res.json();
      if (res.ok) {
        toast({
          title: "Subscribed",
          description: j.message || "You have been added to our newsletter.",
        });
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
    <footer ref={footerRef} className="relative overflow-hidden">
      {/* Background with Glassmorphism */}
      <div className="absolute inset-0 bg-background/95 backdrop-blur-xl" />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />

      {/* Floating Background Elements */}
      <div className="hidden sm:block absolute -top-32 -right-32 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="hidden sm:block absolute -bottom-32 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(var(--primary-rgb),0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--primary-rgb),0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />

      {/* Newsletter Section */}
      <div className="relative z-10 border-b border-border/50 animate-hero-fade-in">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <div className="relative container mx-auto px-6 lg:px-8 py-16 sm:py-20 text-center">
          {/* Newsletter Content */}
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 hover:scale-110 hover:rotate-180 transition-all duration-500">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight leading-tight">
                Become an <span className="gradient-text-primary">Insider</span>
              </h2>
            </div>

            <p className="max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed px-4 sm:px-0">
              Join our newsletter to get exclusive deals, early access to
              events, and the best of Karachi delivered to you.
            </p>

            {/* Newsletter Form */}
            <form
              className="mt-6 sm:mt-8 max-w-md mx-auto px-4 sm:px-0"
              onSubmit={handleNewsletterSubmit}
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                <div className="relative flex bg-background/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-premium-lg overflow-hidden">
                  <div className="relative flex-1">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="Your email address"
                      aria-label="newsletter-email"
                      className="h-14 pl-12 pr-4 text-base bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70"
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
                    className="h-14 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-l-none rounded-r-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group"
                  >
                    <span className="mr-2">Sign Me Up</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div
        className="relative z-10 container mx-auto px-6 lg:px-8 pt-20 pb-12 animate-hero-fade-in"
        style={{ animationDelay: "0.2s" }}
      >
        {/* Mobile Layout */}
        <div className="flex flex-col items-center text-center md:hidden space-y-8">
          {/* Clean Logo Section */}
          <div className="hover:scale-[1.02] transition-transform duration-300">
            <ThemeAwareLogo />
          </div>

          {/* Tagline */}
          <div className="space-y-4">
            <p className="text-muted-foreground text-base max-w-sm leading-relaxed">
              The definitive guide to unlocking the best experiences in{" "}
              <span className="text-primary font-semibold">Karachi</span>.
            </p>

            {/* Social Links */}
            <div className="flex justify-center space-x-3">
              {socialLinks.map((social, index) => (
                <Link
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group opacity-0 animate-hero-fade-in"
                  style={{ animationDelay: `${0.3 + index * 0.1}s` }}
                >
                  <div className="w-12 h-12 rounded-2xl bg-background/80 backdrop-blur-xl border border-border/50 shadow-premium flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300 hover:scale-110 hover:-translate-y-1">
                    <social.icon className="h-5 w-5" />
                  </div>
                  <span className="sr-only">{social.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Divider for Mobile */}
        <div className="my-16 md:hidden">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gradient-to-r from-transparent via-border to-transparent" />
            </div>
            <div className="relative flex justify-center">
              <div className="px-6 bg-background/80 backdrop-blur-xl">
                <div className="w-2 h-2 rounded-full bg-primary/50" />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden px-4">
          <FooterLinkTabs links={footerLinks} />
        </div>

        {/* Desktop Layout */}
        <div
          className="hidden md:grid md:grid-cols-12 md:gap-16 opacity-0 animate-hero-fade-in"
          style={{ animationDelay: "0.3s" }}
        >
          {/* Desktop: Logo and Brand Column */}
          <div className="md:col-span-4 space-y-8">
            {/* Clean Logo Presentation */}
            <div className="w-fit hover:scale-[1.02] transition-transform duration-300">
              <ThemeAwareLogo />
            </div>

            {/* Brand Description */}
            <div className="space-y-6">
              <p className="text-muted-foreground text-base max-w-sm leading-relaxed">
                The definitive guide to unlocking the best experiences in{" "}
                <span className="text-primary font-semibold">Karachi</span>.
              </p>

              {/* Clean Social Links - Horizontal Row */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Connect With Us
                </h4>
                <div className="flex space-x-3">
                  {socialLinks.map((social, index) => (
                    <Link
                      key={social.name}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group opacity-0 animate-hero-fade-in"
                      style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-background/60 backdrop-blur-xl border border-border/50 shadow-premium flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10 hover:shadow-premium-lg transition-all duration-300 hover:scale-105 hover:-translate-y-1">
                        <social.icon className="h-5 w-5" />
                      </div>
                      <span className="sr-only">{social.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Desktop: Navigation Columns */}
          <div className="md:col-span-8 grid grid-cols-3 gap-8">
            {/* Explore Column */}
            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <div className="w-1 h-6 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
                <h4 className="font-bold text-foreground text-lg">Explore</h4>
              </div>
              <ul className="space-y-4">
                {footerLinks.explore.map((link, index) => {
                  const href = link.href || "#";
                  return (
                    <li
                      key={link.name}
                      className="opacity-0 animate-hero-fade-in"
                      style={{ animationDelay: `${0.6 + index * 0.05}s` }}
                    >
                      <Link
                        href={href || "#"}
                        className="group relative inline-block py-2 text-muted-foreground hover:text-primary transition-colors duration-300"
                      >
                        <span className="text-sm font-medium relative">
                          {link.name}
                          <span className="absolute left-0 h-0.5 bg-primary/60 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out w-full bottom-[-3px]" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* For Businesses Column */}
            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <div className="w-1 h-6 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
                <h4 className="font-bold text-foreground text-lg">
                  For Businesses
                </h4>
              </div>
              <ul className="space-y-4">
                {footerLinks.forBusinesses.map((link, index) => (
                  <li
                    key={link.name}
                    className="opacity-0 animate-hero-fade-in"
                    style={{ animationDelay: `${0.7 + index * 0.05}s` }}
                  >
                    <Link
                      href={link.href}
                      className="group relative inline-block py-2 text-muted-foreground hover:text-primary transition-colors duration-300"
                    >
                      <span className="text-sm font-medium relative">
                        {link.name}
                        <span className="absolute left-0 h-0.5 bg-primary/60 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out w-full bottom-[-3px]" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company Column */}
            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <div className="w-1 h-6 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
                <h4 className="font-bold text-foreground text-lg">Company</h4>
              </div>
              <ul className="space-y-4">
                {footerLinks.company.map((link, index) => (
                  <li
                    key={link.name}
                    className="opacity-0 animate-hero-fade-in"
                    style={{ animationDelay: `${0.8 + index * 0.05}s` }}
                  >
                    <Link
                      href={link.href}
                      className="group relative inline-block py-2 text-muted-foreground hover:text-primary transition-colors duration-300"
                    >
                      <span className="text-sm font-medium relative">
                        {link.name}
                        <span className="absolute left-0 h-0.5 bg-primary/60 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out w-full bottom-[-3px]" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Copyright Section */}
        <div
          className="mt-20 pt-8 opacity-0 animate-hero-fade-in"
          style={{ animationDelay: "1s" }}
        >
          {/* Divider */}
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gradient-to-r from-transparent via-border to-transparent" />
            </div>
            <div className="relative flex justify-center">
              <div className="px-6 bg-background/80 backdrop-blur-xl">
                <div
                  className="w-3 h-3 rounded-full bg-gradient-to-r from-primary to-primary/50 animate-spin"
                  style={{ animationDuration: "20s" }}
                />
              </div>
            </div>
          </div>

          {/* Copyright Content */}
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground font-medium hover:scale-[1.02] transition-transform duration-300">
              © <CurrentYear />{" "}
              <span className="text-primary font-semibold">Inside Karachi</span>
              . All Rights Reserved.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Inside Karachi is managed by{" "}
              <span className="font-medium text-muted-foreground">
                CITY GUIDE NETWORK (PRIVATE) LIMITED
              </span>
              .
            </p>
            <p className="text-xs text-muted-foreground/70">
              Crafted with <span className="text-primary animate-pulse">♥</span>{" "}
              for the people of Karachi
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
