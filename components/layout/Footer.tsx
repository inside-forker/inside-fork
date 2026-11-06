"use client";

import Image from "next/image";
import Link from "next/link";
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";
import { useRef, useEffect } from "react";
import { CurrentYear } from "@/components/ui/CurrentYear";
import { useScroll } from "@/lib/context/scroll-context";
import { useInView } from "@/lib/hooks/use-in-view";
import { NewsletterForm } from "@/components/shared/NewsletterForm";
import { Container, Heading, Section } from "@/components/ds";

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

// Shared focus ring for links on the ink band
const focusRing =
  "rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function Footer({ serverCategories: _serverCategories }: FooterProps) {
  const footerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(footerRef, { threshold: 0.2 });
  const { setIsFooterInView } = useScroll();

  // When isInView changes, update the global state
  useEffect(() => {
    setIsFooterInView(isInView);
  }, [isInView, setIsFooterInView]);

  return (
    <Section as="footer" tone="ink" size="sm" data-chrome="footer">
      <div ref={footerRef}>
        <Container>
          <div className="grid gap-12 md:grid-cols-12 md:gap-10">
            {/* Brand, newsletter and socials */}
            <div className="md:col-span-5">
              <Link href="/" className={`inline-flex min-h-11 items-center ${focusRing}`}>
                <Image
                  src="/assets/logo-white.png"
                  alt="Inside Karachi"
                  width={120}
                  height={40}
                  className="h-10 w-auto object-contain"
                />
              </Link>
              <p className="mt-4 max-w-sm font-ui text-body text-muted-foreground">
                The definitive guide to unlocking the best experiences in Karachi.
              </p>

              <div className="mt-10 max-w-md">
                <Heading as="h2" variant="title">
                  Become an Insider
                </Heading>
                <NewsletterForm
                  variant="band"
                  className="mt-4"
                  buttonLabel="Sign me up"
                  successTitle="Subscribed"
                />
              </div>

              <ul className="-ml-3 mt-8 flex gap-1">
                {socialLinks.map((social) => (
                  <li key={social.name}>
                    <Link
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.name}
                      className={`flex size-11 items-center justify-center text-muted-foreground transition-colors duration-fast ease-standard hover:text-foreground ${focusRing}`}
                    >
                      <social.icon aria-hidden="true" className="size-5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Link columns */}
            <div className="grid gap-10 sm:grid-cols-3 md:col-span-7">
              {footerLinks.map((group) => (
                <div key={group.title}>
                  <Heading as="h2" variant="title" className="text-body-lg">
                    {group.title}
                  </Heading>
                  <ul className="mt-3 md:mt-4 md:space-y-1">
                    {group.links.map((link) => (
                      <li key={link.name}>
                        <Link
                          href={link.href}
                          className={`flex min-h-11 items-center font-ui text-small text-muted-foreground transition-colors duration-fast ease-standard hover:text-foreground md:min-h-0 md:py-1 ${focusRing}`}
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

          {/* Bottom bar: the only divider */}
          <div className="mt-12 flex flex-col gap-1 border-t border-border pt-6 font-ui text-small text-muted-foreground sm:flex-row sm:justify-between">
            <p>
              © <CurrentYear /> Inside Karachi. All Rights Reserved.
            </p>
            <p>Managed by CITY GUIDE NETWORK (PRIVATE) LIMITED.</p>
          </div>
        </Container>
      </div>
    </Section>
  );
}
