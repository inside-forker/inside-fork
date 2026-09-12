"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Building,
  Globe,
  BadgeCheck,
  Calendar,
  Sparkles,
  User,
  Shield,
  Phone,
  Mail,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EOProfilePreviewCardProps {
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  company?: string;
  bio?: string;
  website?: string;
  isVerified?: boolean;
  role?: "organizer" | "eo_gate_pass";
  linkedOrganizerName?: string;
}

export function EOProfilePreviewCard({
  fullName,
  username,
  email,
  phone,
  company,
  bio,
  website,
  isVerified = true,
  role = "organizer",
  linkedOrganizerName,
}: EOProfilePreviewCardProps) {
  const isEO = role === "organizer";

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Live Profile Preview
        </span>
        <Badge
          variant="outline"
          className="text-[10px] uppercase font-bold tracking-wider border-primary/30 text-primary bg-primary/5"
        >
          {isEO ? "Event Organizer" : "Gate Pass Operator"}
        </Badge>
      </div>

      <motion.div
        layout
        className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card/90 via-card/50 to-primary/5 p-5 shadow-xl backdrop-blur-xl"
      >
        {/* Glow ambient background */}
        <div className="absolute -top-16 -right-16 h-36 w-36 rounded-full bg-primary/15 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-36 w-36 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          {/* Header row: Avatar + Identity */}
          <div className="flex items-start gap-3.5">
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-primary/10 border border-primary/20 text-primary font-bold text-xl shadow-inner">
                {fullName?.trim() ? fullName.trim()[0].toUpperCase() : <User className="h-6 w-6" />}
              </div>
              {isEO && isVerified && (
                <div
                  className="absolute -bottom-1 -right-1 rounded-full bg-background p-0.5 shadow"
                  title="Verified Event Organizer"
                >
                  <BadgeCheck className="h-4 w-4 text-emerald-500 fill-emerald-500/20" />
                </div>
              )}
              {!isEO && (
                <div
                  className="absolute -bottom-1 -right-1 rounded-full bg-background p-0.5 shadow"
                  title="Gate Pass Security Scanner"
                >
                  <Shield className="h-4 w-4 text-amber-500 fill-amber-500/20" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-base font-bold text-foreground truncate">
                  {fullName?.trim() || "Full Name"}
                </h3>
                {isEO && isVerified && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                    <BadgeCheck className="h-3 w-3" /> Verified
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground font-mono truncate">
                @{username?.trim() || "username"}
              </p>

              {company?.trim() && (
                <p className="text-xs font-medium text-primary flex items-center gap-1 mt-0.5 truncate">
                  <Building className="h-3 w-3 flex-shrink-0" />
                  {company.trim()}
                </p>
              )}
            </div>
          </div>

          {/* Bio section (EO only) */}
          {isEO && (
            <div className="rounded-xl bg-background/50 border border-border/40 p-3 text-xs text-muted-foreground/90 leading-relaxed min-h-[52px]">
              {bio?.trim() ? (
                bio.trim()
              ) : (
                <span className="italic text-muted-foreground/50">
                  Organizer bio & showcase will appear here...
                </span>
              )}
            </div>
          )}

          {/* Linked Organizer Banner (Gate Pass only) */}
          {!isEO && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs flex items-center gap-2.5">
              <Shield className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <div>
                <span className="text-[11px] font-semibold uppercase text-amber-600 dark:text-amber-400 tracking-wider">
                  Linked Event Organizer
                </span>
                <p className="font-semibold text-foreground truncate">
                  {linkedOrganizerName || "Select an Event Organizer..."}
                </p>
              </div>
            </div>
          )}

          {/* Contact Details chips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-2 truncate bg-background/40 rounded-lg px-2.5 py-1.5 border border-border/30">
              <Mail className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span className="truncate">{email?.trim() || "email@insidekhi.com"}</span>
            </div>

            {phone?.trim() && (
              <div className="flex items-center gap-2 truncate bg-background/40 rounded-lg px-2.5 py-1.5 border border-border/30">
                <Phone className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span className="truncate">{phone.trim()}</span>
              </div>
            )}

            {website?.trim() && (
              <div className="flex items-center gap-2 truncate bg-background/40 rounded-lg px-2.5 py-1.5 border border-border/30 sm:col-span-2">
                <Globe className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span className="truncate font-mono text-[11px]">{website.trim()}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
