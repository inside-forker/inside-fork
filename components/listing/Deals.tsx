"use client";

import { useState } from "react";
import {
  Tag,
  Percent,
  CreditCard,
  Calendar,
  Clock,
  Eye,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { PremiumHeading } from "@/components/brand/Typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDealsModal } from "@/lib/context/DealsModalContext";
import { BankCardShowcase } from "@/components/bank-cards/BankCardShowcase";
import {
  sectionVariants,
  viewportSettings,
} from "@/lib/utils/listing-animations";
import {
  parseDealTerms,
  getTermsPreview,
  hasSubstantialTerms,
} from "@/lib/utils/deal-terms-parser";

interface Bank {
  name: string;
  logo_url: string | null;
}

interface Deal {
  id: number;
  listing_id: number;
  title: string;
  description: string | null;
  deal_type: string;
  bank_id: number | null;
  discount_value: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  banks?: Bank | null;
}

interface DealsProps {
  deals: Deal[];
  businessName?: string;
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
};

const getDealIcon = (dealType: string) => {
  switch (dealType) {
    case "bank_discount":
      return CreditCard;
    case "percentage":
      return Percent;
    case "general":
    default:
      return Tag;
  }
};

const getDealTypeLabel = (dealType: string) => {
  switch (dealType) {
    case "bank_discount":
      return "Bank Offer";
    case "percentage":
      return "Percentage Off";
    case "general":
    default:
      return "Special Deal";
  }
};

const isExpiringSoon = (endDate: string | null) => {
  if (!endDate) return false;
  const end = new Date(endDate);
  const now = new Date();
  const diffDays = Math.ceil(
    (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diffDays <= 7 && diffDays > 0;
};

// Individual Deal Card Component with Expandable Terms
interface DealCardProps {
  deal: Deal;
}

function DealCard({ deal }: DealCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const IconComponent = getDealIcon(deal.deal_type);
  const expiringSoon = isExpiringSoon(deal.end_date);
  const parsedTerms = parseDealTerms(deal.description);
  const showExpandable = hasSubstantialTerms(deal.description);

  return (
    <div className="group relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/10 border-2 md:border rounded-2xl p-6 md:p-6 hover:shadow-premium hover:shadow-primary/20 hover:border-primary/40 hover:scale-[1.02] transition-all duration-300">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-50 group-hover:opacity-70 transition-opacity duration-300" />
      <div className="absolute top-4 right-4 w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-primary/10 to-transparent rounded-full group-hover:from-primary/20 group-hover:scale-110 transition-all duration-300" />
      <div className="absolute -inset-1 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative">
        {/* Deal Header */}
        <div className="flex items-start justify-between mb-3 md:mb-4">
          <div className="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 md:w-12 md:h-12 bg-primary/10 rounded-lg md:rounded-xl flex items-center justify-center border border-primary/20 flex-shrink-0 overflow-hidden relative">
              {deal.deal_type === "bank_discount" && deal.banks?.logo_url ? (
                <Image
                  src={deal.banks.logo_url}
                  alt={deal.banks.name}
                  fill
                  sizes="(max-width: 768px) 32px, 48px"
                  className="object-cover"
                />
              ) : (
                <IconComponent className="h-4 w-4 md:w-6 md:h-6 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-base md:text-xl font-bold text-foreground leading-tight mb-1">
                {deal.title}
              </h4>
              <div className="flex flex-wrap items-center gap-1 md:gap-2">
                <Badge
                  variant="secondary"
                  className="text-xs px-1.5 py-0.5 md:px-2 md:py-1 h-5 md:h-auto"
                >
                  {getDealTypeLabel(deal.deal_type)}
                </Badge>
                {deal.banks && (
                  <Badge
                    variant="outline"
                    className="text-xs px-1.5 py-0.5 md:px-2 md:py-1 h-5 md:h-auto border-primary/30 text-foreground bg-primary/10 gap-1.5"
                  >
                    {deal.banks.logo_url ? (
                      <div className="relative w-3 h-3 md:w-3.5 md:h-3.5 rounded-full overflow-hidden flex-shrink-0">
                        <Image
                          src={deal.banks.logo_url}
                          alt={deal.banks.name}
                          fill
                          sizes="14px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <CreditCard className="h-2.5 w-2.5 md:h-3 md:w-3" />
                    )}
                    <span className="truncate max-w-20 md:max-w-none font-medium">
                      {deal.banks.name}
                    </span>
                  </Badge>
                )}
                {expiringSoon && (
                  <Badge
                    variant="destructive"
                    className="text-xs px-1.5 py-0.5 md:px-2 md:py-1 h-5 md:h-auto animate-pulse"
                  >
                    <span className="hidden md:inline">⚡ </span>Ending Soon
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="text-right flex-shrink-0 ml-2">
            <div className="text-xl md:text-3xl font-black text-primary mb-0.5 md:mb-1 leading-none">
              {deal.discount_value || "Special Offer"}
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              {deal.deal_type === "bank_discount"
                ? "Bank Discount"
                : deal.deal_type === "percentage"
                  ? "Percentage Off"
                  : "Special Deal"}
            </div>
          </div>
        </div>

        {/* Deal Summary */}
        <div className="mb-3 md:mb-4">
          {/* Smart Summary instead of full description */}
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-2 md:mb-3">
            {parsedTerms.summary}
          </p>

          {/* Highlights (Key Info Badges) */}
          {parsedTerms.highlights.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2 md:mb-3">
              {parsedTerms.highlights.map((highlight, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="text-xs px-2 py-0.5 bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300"
                >
                  {highlight}
                </Badge>
              ))}
            </div>
          )}

          {/* Bank Card Showcase */}
          {deal.deal_type === "bank_discount" && deal.banks && (
            <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
              <span className="text-xs text-muted-foreground flex-shrink-0">
                Valid on:
              </span>
              <BankCardShowcase
                bankName={deal.banks.name}
                bankId={deal.bank_id || undefined}
                dealId={deal.id}
                size="sm"
              />
            </div>
          )}

          {/* Expandable Full Terms */}
          {showExpandable && (
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className={`text-xs font-medium p-2 h-auto transition-colors ${
                  isExpanded
                    ? "!text-primary !bg-primary/10"
                    : "text-primary hover:!text-primary hover:!bg-primary/10"
                }`}
              >
                <FileText className="h-3 w-3 mr-1.5" />
                {isExpanded ? "Hide" : "View"} Full Terms
                {isExpanded ? (
                  <ChevronUp className="h-3 w-3 ml-1.5" />
                ) : (
                  <ChevronDown className="h-3 w-3 ml-1.5" />
                )}
              </Button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 p-4 bg-black/20 rounded-xl border border-primary/10 space-y-3">
                      {parsedTerms.sections.map((section, idx) => (
                        <div key={idx}>
                          <h5 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-primary" />
                            {section.title}
                          </h5>
                          <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
                            {section.items.map((item, itemIdx) => (
                              <li key={itemIdx} className="flex gap-2">
                                <span className="text-primary/50 flex-shrink-0">
                                  •
                                </span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Short Terms Preview (if no expandable needed) */}
          {!showExpandable && (
            <div className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium">Details:</span>{" "}
              {getTermsPreview(deal.description)}
            </div>
          )}
        </div>

        {/* Deal Footer */}
        <div className="flex items-center justify-between gap-2 md:gap-4 pt-3 md:pt-4 border-t border-border/30">
          <div className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground min-w-0 flex-1">
            <Calendar className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
            <span className="truncate">
              Valid until {deal.end_date ? formatDate(deal.end_date) : "TBD"}
            </span>
          </div>

          <Badge
            variant="outline"
            className={`text-xs px-2 py-1 md:px-3 md:py-1 h-6 md:h-auto flex-shrink-0 ${
              expiringSoon
                ? "border-orange-500/30 text-orange-600 bg-orange-500/10"
                : "border-green-500/30 text-green-600 bg-green-500/10"
            }`}
          >
            <Clock className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1" />
            {expiringSoon ? "Ending Soon" : "Active"}
          </Badge>
        </div>
      </div>
    </div>
  );
}

export function Deals({ deals, businessName = "Business" }: DealsProps) {
  const { openDeals } = useDealsModal();
  if (!deals || deals.length === 0) {
    return null;
  }

  // Filter active deals and sort by end date
  const activeDeals = deals
    .filter(
      (deal) =>
        deal.is_active &&
        (!deal.end_date || new Date(deal.end_date) > new Date()),
    )
    .sort((a, b) => {
      // Put deals with end dates separated from open-ended ones
      // Sort deals with end dates by earliest expiry first
      if (a.end_date && b.end_date) {
        return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
      }
      // If one has end date and other doesn't, put the one with end date first (urgent)
      if (a.end_date) return -1;
      if (b.end_date) return 1;
      // If neither has end date, sort by title or id
      return 0;
    });

  if (activeDeals.length === 0) {
    return null;
  }

  // Show only first 4 deals initially, similar to menu preview
  const previewDeals = activeDeals.slice(0, 4);
  const hasMoreDeals = activeDeals.length > 4;

  return (
    <motion.div
      id="deals-section"
      className="space-y-6 md:space-y-8"
      initial="hidden"
      whileInView="visible"
      viewport={viewportSettings}
      variants={sectionVariants}
    >
      {/* Mobile-First Header */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium flex-shrink-0">
              <Tag className="h-6 w-6 text-primary" />
            </div>
            <div>
              <PremiumHeading level={2} dense className="text-foreground">
                Deals & <span className="gradient-text-primary">Discounts</span>
              </PremiumHeading>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
                Save on your visit
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="px-3 py-1 text-xs font-medium bg-primary/5"
          >
            {activeDeals.length} Deal{activeDeals.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium flex-shrink-0">
            <Tag className="h-6 w-6 text-primary" />
          </div>
          <div>
            <PremiumHeading level={2} dense className="text-foreground">
              Deals & <span className="gradient-text-primary">Discounts</span>
            </PremiumHeading>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
              Save on your visit
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="px-4 py-2 font-semibold border-2 bg-primary/5"
        >
          {activeDeals.length} Active Deal{activeDeals.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="space-y-4">
        {previewDeals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
      </div>

      {/* View All Deals Button - matching menu's "View Full Menu" style */}
      {hasMoreDeals && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="text-center relative z-20"
        >
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="inline-block"
          >
            <Button
              onClick={() => openDeals({ deals: activeDeals, businessName })}
              size="lg"
              className="group relative bg-gradient-to-r from-primary via-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white px-6 md:px-8 py-5 md:py-6 rounded-2xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 overflow-hidden cursor-pointer"
            >
              <div className="relative z-10 flex items-center">
                <Eye className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
                <span className="text-base md:text-lg font-bold">
                  View All Deals
                </span>
                <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{
                  repeat: Infinity,
                  repeatType: "loop",
                  duration: 1.5,
                  ease: "easeInOut",
                  repeatDelay: 2,
                }}
                style={{ filter: "blur(8px)" }}
              />
            </Button>
          </motion.div>
          <p className="mt-3 text-sm text-muted-foreground">
            Explore all {activeDeals.length} deals •{" "}
            {activeDeals.filter((d) => d.deal_type === "bank_discount").length}{" "}
            bank offers • Interactive deals experience
          </p>
        </motion.div>
      )}

      {/* Call to action */}
      <div className="text-center p-4 bg-primary/5 rounded-xl border border-primary/20">
        <p className="text-sm text-muted-foreground">
          💡 <strong>Tip:</strong> Call ahead to confirm deal availability and
          any terms & conditions.
        </p>
      </div>
    </motion.div>
  );
}
