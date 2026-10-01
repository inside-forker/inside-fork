"use client";

import Link from "next/link";
import { ThemeAwareLogo } from "./ThemeAwareLogo";
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";
import { useRef, useEffect } from "react";
import { CurrentYear } from "@/components/ui/CurrentYear";
import { useScroll } from "@/lib/context/scroll-context";
import { useInView } from "@/lib/hooks/use-in-view";
import { NewsletterForm } from "@/components/shared/NewsletterForm";

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
const footerLinks = [
  { title: "Explore", links: curatedExploreLinks },
  {
    title: "For Businesses",
    links: [
      { name: "Get Listed", href: "/get-listed" },
      { name: "Membership", href: "/membership" },
    ],
  },
  {
    title: "Company",
    links: [
      { name: "About Us", href: "/about" },
      { name: "Contact Us", href: "/contact" },
      { name: "Privacy Policy", href: "/privacy-policy" },
      { name: "Terms & Conditions", href: "/terms-and-conditions" },
      { name: "Refund Policy", href: "/refund-policy" },
      { name: "Service Policy", href: "/service-policy" },
      { name: "Delete Account", href: "/delete-account" },
    ],
  },
];

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

  // When isInView changes, update the global state
  useEffect(() => {
    setIsFooterInView(isInView);
  }, [isInView, setIsFooterInView]);

  return (
    <footer ref={footerRef} className="border-t border-border bg-cream">
      <div className="container mx-auto px-5 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-12 md:gap-10">
          {/* Brand, newsletter and socials */}
          <div className="space-y-4 md:col-span-5">
            <div className="w-fit">
              <ThemeAwareLogo />
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              The definitive guide to unlocking the best experiences in{" "}
              <span className="font-semibold text-primary">Karachi</span>.
            </p>
            <div className="max-w-sm space-y-2">
              <h2 className="text-sm font-semibold text-foreground">
                Become an <span className="text-primary">Insider</span>
              </h2>
              <NewsletterForm buttonLabel="Sign me up" successTitle="Subscribed" />
            </div>
            <div className="flex gap-2">
              {socialLinks.map((social) => (
                <Link
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary active:opacity-80"
                >
                  <social.icon className="h-4 w-4" />
                  <span className="sr-only">{social.name}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:col-span-7">
            {footerLinks.map((group) => (
              <div key={group.title}>
                <h2 className="text-sm font-semibold text-foreground">{group.title}</h2>
                <ul className="mt-3 space-y-2">
                  {group.links.map((link) => (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 flex flex-col gap-1 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>
            © <CurrentYear /> Inside Karachi. All Rights Reserved.
          </p>
          <p>
            Managed by CITY GUIDE NETWORK (PRIVATE) LIMITED.
          </p>
        </div>
      </div>
    </footer>
  );
}
