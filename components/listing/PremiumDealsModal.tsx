"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Tag,
  Percent,
  CreditCard,
  Calendar,
  Clock,
  Filter,
  Building2,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BankCardShowcase } from "@/components/bank-cards/BankCardShowcase";
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
  metadata?: {
    card_associations?: Array<{
      name?: string;
      image?: string;
      typeId?: number;
    }>;
    [key: string]: unknown;
  } | null;
}

interface PremiumDealsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deals: Deal[];
  businessName: string;
}

// Helper functions
const formatDate = (dateString: string) => {
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

export function PremiumDealsModal({
  isOpen,
  onClose,
  deals,
  businessName,
}: PremiumDealsModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "expiring" | "discount">(
    "newest",
  );
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [selectedCardType, setSelectedCardType] = useState<string>("");
  const [expandedDeals, setExpandedDeals] = useState<Set<number>>(new Set());

  const toggleDealExpansion = (dealId: number) => {
    setExpandedDeals((prev) => {
      const next = new Set(prev);
      if (next.has(dealId)) {
        next.delete(dealId);
      } else {
        next.add(dealId);
      }
      return next;
    });
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      const timer = setTimeout(() => {
        setActiveTab(0);
        setSearchQuery("");
        setDebouncedSearchQuery("");
        setSortBy("newest");
        setSelectedBank("");
        setSelectedCardType("");
      }, 300);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Debounce search query to prevent excessive filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Memoize active deals filtering
  const activeDeals = useMemo(
    () =>
      deals.filter(
        (deal) =>
          deal.is_active &&
          (!deal.end_date || new Date(deal.end_date) > new Date()),
      ),
    [deals],
  );

  // Memoize deal categorization
  const dealSections = useMemo(() => {
    const bankDeals = activeDeals.filter(
      (deal) => deal.deal_type === "bank_discount",
    );
    const restaurantDeals = activeDeals.filter(
      (deal) => deal.deal_type !== "bank_discount",
    );

    return [
      { name: "All Deals", deals: activeDeals, icon: Tag },
      { name: "Bank Offers", deals: bankDeals, icon: CreditCard },
      { name: "Restaurant Offers", deals: restaurantDeals, icon: Building2 },
    ];
  }, [activeDeals]);

  // Memoize available card types for selected bank
  const availableCardTypes = useMemo(() => {
    const types = new Set<string>();
    const bankDeals = selectedBank
      ? deals.filter((d) => d.banks?.name === selectedBank)
      : deals;

    for (const deal of bankDeals) {
      const assocs = deal.metadata?.card_associations;
      if (Array.isArray(assocs)) {
        for (const assoc of assocs) {
          const name = assoc.name?.toLowerCase() || "";
          if (name.includes("visa")) types.add("visa");
          if (name.includes("mastercard")) types.add("mastercard");
          if (name.includes("paypak")) types.add("paypak");
          if (name.includes("unionpay")) types.add("unionpay");
        }
      }
      const titleDesc = `${deal.title} ${deal.description || ""}`.toLowerCase();
      if (titleDesc.includes("visa")) types.add("visa");
      if (titleDesc.includes("mastercard")) types.add("mastercard");
      if (titleDesc.includes("paypak")) types.add("paypak");
      if (titleDesc.includes("unionpay")) types.add("unionpay");
    }

    if (types.size === 0) {
      types.add("visa");
      types.add("mastercard");
    }

    return Array.from(types).sort();
  }, [deals, selectedBank]);

  // Memoize filtering operation
  const filteredSections = useMemo(() => {
    const hasSearch = !!debouncedSearchQuery.trim();
    const hasBank = !!selectedBank;
    const hasCardType = !!selectedCardType;

    if (!hasSearch && !hasBank && !hasCardType) return dealSections;

    const query = debouncedSearchQuery.toLowerCase().trim();
    const targetCardType = selectedCardType.toLowerCase().trim();

    return dealSections.map((section) => ({
      ...section,
      deals: section.deals.filter((deal) => {
        // Search filter
        const matchesSearch =
          !hasSearch ||
          deal.title.toLowerCase().includes(query) ||
          deal.description?.toLowerCase().includes(query) ||
          deal.banks?.name?.toLowerCase().includes(query);

        // Bank filter
        const matchesBank =
          !hasBank || deal.banks?.name === selectedBank;

        // Card type filter (for bank deals)
        let matchesCardType = !hasCardType;
        if (hasCardType) {
          const assocs = deal.metadata?.card_associations;
          if (Array.isArray(assocs) && assocs.length > 0) {
            matchesCardType = assocs.some((assoc) =>
              assoc.name?.toLowerCase().includes(targetCardType),
            );
          } else {
            const combinedText = `${deal.title} ${deal.description || ""}`.toLowerCase();
            matchesCardType = combinedText.includes(targetCardType);
          }
        }

        return matchesSearch && matchesBank && matchesCardType;
      }),
    }));
  }, [dealSections, debouncedSearchQuery, selectedBank, selectedCardType]);

  // Memoize available banks
  const availableBanks = useMemo(
    () =>
      [
        ...new Set(
          deals
            .filter((deal) => deal.banks?.name)
            .map((deal) => deal.banks!.name),
        ),
      ].sort(),
    [deals],
  );

  // Memoize sorting function
  const sortDeals = useMemo(
    () => (deals: Deal[]) => {
      switch (sortBy) {
        case "expiring":
          return [...deals].sort((a, b) => {
            if (!a.end_date || !b.end_date) return 0;
            return (
              new Date(a.end_date).getTime() - new Date(b.end_date).getTime()
            );
          });
        case "discount":
          return [...deals].sort((a, b) => {
            const aVal = parseInt(a.discount_value?.replace(/\D/g, "") || "0");
            const bVal = parseInt(b.discount_value?.replace(/\D/g, "") || "0");
            return bVal - aVal;
          });
        case "newest":
        default:
          return [...deals].sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          );
      }
    },
    [sortBy],
  );

  const activeSection = filteredSections[activeTab];
  const sortedDeals = sortDeals(activeSection?.deals || []);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[9999] bg-black/60"
          />

          {/* Main Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: 0.15,
              ease: "easeOut",
            }}
            className="fixed inset-x-4 top-20 bottom-4 md:inset-x-8 md:top-24 md:bottom-8 lg:inset-x-16 lg:top-28 lg:bottom-12 xl:inset-x-32 xl:top-32 xl:bottom-16 z-[10000] flex overflow-hidden rounded-2xl md:rounded-3xl border border-border/20 bg-background shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            {/* Left Sidebar for Categories */}
            <div className="hidden h-full w-[260px] lg:w-[280px] flex-col bg-background/70 p-4 md:p-6 lg:flex border-r border-border/30">
              <div className="mb-4 md:mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                  <Tag className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground">
                    Deals & Offers
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {businessName}
                  </p>
                </div>
              </div>

              {/* Category Navigation */}
              <nav className="flex-1 space-y-1">
                {dealSections.map((section, index) => {
                  const IconComponent = section.icon;
                  const isActive = activeTab === index;
                  const isFiltered = !!(
                    debouncedSearchQuery.trim() ||
                    selectedBank ||
                    selectedCardType
                  );
                  const sectionDeals = isFiltered
                    ? filteredSections[index]?.deals
                    : section.deals;

                  return (
                    <button
                      key={section.name}
                      onClick={() => setActiveTab(index)}
                      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200 ${
                        isActive
                          ? "bg-primary/10 text-primary shadow-md border border-primary/20"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                          isActive
                            ? "bg-primary/20"
                            : "bg-muted/50 group-hover:bg-accent"
                        }`}
                      >
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{section.name}</div>
                        <div className="text-xs opacity-70">
                          {sectionDeals?.length || 0} deal
                          {(sectionDeals?.length || 0) !== 1 ? "s" : ""}
                        </div>
                      </div>
                      {isActive && (
                        <div className="absolute inset-0 rounded-xl bg-primary/5 border border-primary/20" />
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Stats */}
              <div className="mt-4 rounded-xl bg-muted/30 p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {activeDeals.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Active Deals
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-1 flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/30 bg-background/50 p-4 md:p-6">
                <div className="flex items-center gap-4">
                  <div className="lg:hidden">
                    <select
                      value={activeTab}
                      onChange={(e) => setActiveTab(Number(e.target.value))}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      {dealSections.map((section, index) => {
                        const isFiltered = !!(
                          debouncedSearchQuery.trim() ||
                          selectedBank ||
                          selectedCardType
                        );
                        return (
                          <option key={index} value={index}>
                            {section.name} (
                            {isFiltered
                              ? (filteredSections[index]?.deals?.length ?? 0)
                              : section.deals.length}
                            )
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="hidden lg:block">
                    <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
                      {activeSection?.name || "Deals"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {sortedDeals.length} deal
                      {sortedDeals.length !== 1 ? "s" : ""} available
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 rounded-lg p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Search and Filters */}
              <div className="border-b border-border/30 bg-background/30 p-4 md:p-6">
                <div className="flex flex-col gap-4">
                  {/* Search Bar */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search deals, banks, or offers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-background/50 border-border/50 focus:border-primary/50"
                    />
                  </div>

                  {/* Filter Row */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Filter className="h-4 w-4" />
                      <span className="font-medium">Filters:</span>
                    </div>

                    {/* Bank Filter */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-foreground">
                        Bank:
                      </label>
                      <select
                        value={selectedBank}
                        onChange={(e) => {
                          setSelectedBank(e.target.value);
                          setSelectedCardType(""); // Reset card type when bank changes
                        }}
                        className="rounded-lg border border-border bg-background/80 px-3 py-1.5 text-sm font-medium focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">All Banks</option>
                        {availableBanks.map((bank) => (
                          <option key={bank} value={bank}>
                            {bank}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Card Type Filter */}
                    {selectedBank && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground">
                          Card:
                        </label>
                        <select
                          value={selectedCardType}
                          onChange={(e) => setSelectedCardType(e.target.value)}
                          className="rounded-lg border border-border bg-background/80 px-3 py-1.5 text-sm font-medium focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="">All Cards</option>
                          {availableCardTypes.map((card) => (
                            <option key={card} value={card}>
                              {card === "mastercard"
                                ? "Mastercard"
                                : card === "visa"
                                  ? "Visa"
                                  : card === "paypak"
                                    ? "PayPak"
                                    : card === "unionpay"
                                      ? "UnionPay"
                                      : card.charAt(0).toUpperCase() + card.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Sort Filter */}
                    <div className="flex items-center gap-2 ml-auto">
                      <label className="text-sm font-medium text-foreground">
                        Sort:
                      </label>
                      <select
                        value={sortBy}
                        onChange={(e) =>
                          setSortBy(
                            e.target.value as
                              | "newest"
                              | "expiring"
                              | "discount",
                          )
                        }
                        className="rounded-lg border border-border bg-background/80 px-3 py-1.5 text-sm font-medium focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="newest">Newest First</option>
                        <option value="expiring">Expiring Soon</option>
                        <option value="discount">Highest Discount</option>
                      </select>
                    </div>
                  </div>

                  {/* Active Filters Display */}
                  {(selectedBank || selectedCardType || searchQuery) && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Active filters:
                      </span>
                      {selectedBank && (
                        <Badge
                          variant="secondary"
                          className="text-xs px-2 py-1 bg-primary/10 text-primary border border-primary/20"
                        >
                          Bank: {selectedBank}
                          <button
                            onClick={() => setSelectedBank("")}
                            className="ml-1 hover:text-primary/70"
                          >
                            ×
                          </button>
                        </Badge>
                      )}
                      {selectedCardType && (
                        <Badge
                          variant="secondary"
                          className="text-xs px-2 py-1 bg-primary/10 text-primary border border-primary/20"
                        >
                          Card:{" "}
                          {selectedCardType === "mastercard"
                            ? "Mastercard"
                            : selectedCardType === "visa"
                              ? "Visa"
                              : selectedCardType === "paypak"
                                ? "PayPak"
                                : selectedCardType === "unionpay"
                                  ? "UnionPay"
                                  : selectedCardType.charAt(0).toUpperCase() +
                                    selectedCardType.slice(1)}
                          <button
                            onClick={() => setSelectedCardType("")}
                            className="ml-1 hover:text-primary/70"
                          >
                            ×
                          </button>
                        </Badge>
                      )}
                      {searchQuery && (
                        <Badge
                          variant="secondary"
                          className="text-xs px-2 py-1 bg-primary/10 text-primary border border-primary/20"
                        >
                          Search: &ldquo;{searchQuery}&rdquo;
                          <button
                            onClick={() => setSearchQuery("")}
                            className="ml-1 hover:text-primary/70"
                          >
                            ×
                          </button>
                        </Badge>
                      )}
                      <button
                        onClick={() => {
                          setSelectedBank("");
                          setSelectedCardType("");
                          setSearchQuery("");
                          setDebouncedSearchQuery("");
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground underline ml-2 transition-colors"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Deals Content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                {sortedDeals.length === 0 ? (
                  <div className="flex h-64 items-center justify-center text-center">
                    <div>
                      <Tag className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <h3 className="mt-4 text-base sm:text-lg font-medium">
                        No deals found
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {searchQuery
                          ? "Try adjusting your search terms"
                          : "No active deals in this category"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:gap-6">
                    {sortedDeals
                      .slice(0, 30) // Limit to 30 deals for performance
                      .map((deal) => {
                        const IconComponent = getDealIcon(deal.deal_type);
                        const expiringSoon = isExpiringSoon(deal.end_date);
                        const parsedTerms = parseDealTerms(deal.description);
                        const showExpandable = hasSubstantialTerms(
                          deal.description,
                        );
                        const isExpanded = expandedDeals.has(deal.id);

                        return (
                          <div
                            key={deal.id}
                            className="group relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/10 border-2 md:border rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 hover:border-primary/40 hover:scale-[1.01]"
                          >
                            {/* Background Effects */}
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-50 group-hover:opacity-70 transition-opacity duration-300" />
                            <div className="absolute top-4 right-4 w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-primary/10 to-transparent rounded-full group-hover:from-primary/20 group-hover:scale-110 transition-all duration-300" />
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            <div className="relative">
                              {/* Deal Header */}
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 flex-shrink-0 overflow-hidden relative">
                                    {deal.deal_type === "bank_discount" &&
                                    deal.banks?.logo_url ? (
                                      <Image
                                        src={deal.banks.logo_url}
                                        alt={deal.banks.name}
                                        fill
                                        sizes="(max-width: 768px) 32px, 48px"
                                        className="object-cover"
                                      />
                                    ) : (
                                      <IconComponent className="h-5 w-5 md:w-6 md:h-6 text-primary" />
                                    )}
                                  </div>
                                  <div>
                                    <h4 className="text-lg md:text-xl font-bold text-foreground">
                                      {deal.title}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge
                                        variant="secondary"
                                        className="text-xs px-2 py-1"
                                      >
                                        {getDealTypeLabel(deal.deal_type)}
                                      </Badge>
                                      {deal.banks && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs px-2 py-1 border-primary/30 text-foreground bg-primary/10 gap-1.5"
                                        >
                                          {deal.banks.logo_url ? (
                                            <div className="relative w-3.5 h-3.5 rounded-full overflow-hidden flex-shrink-0">
                                              <Image
                                                src={deal.banks.logo_url}
                                                alt={deal.banks.name}
                                                fill
                                                sizes="14px"
                                                className="object-cover"
                                              />
                                            </div>
                                          ) : (
                                            <CreditCard className="h-3 w-3" />
                                          )}
                                          <span className="truncate max-w-[120px] font-medium">
                                            {deal.banks.name}
                                          </span>
                                        </Badge>
                                      )}
                                      {expiringSoon && (
                                        <Badge
                                          variant="destructive"
                                          className="text-xs px-2 py-1 animate-pulse"
                                        >
                                          ⚡ Ending Soon
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className="text-2xl md:text-3xl font-black text-primary mb-1">
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

                              {/* Deal Content */}
                              <div className="mb-4">
                                {/* Smart Summary */}
                                <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-3">
                                  {parsedTerms.summary}
                                </p>

                                {/* Highlights */}
                                {parsedTerms.highlights.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mb-3">
                                    {parsedTerms.highlights.map(
                                      (highlight, idx) => (
                                        <Badge
                                          key={idx}
                                          variant="outline"
                                          className="text-xs px-2 py-0.5 bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300"
                                        >
                                          {highlight}
                                        </Badge>
                                      ),
                                    )}
                                  </div>
                                )}

                                {/* Bank Card Showcase */}
                                {deal.deal_type === "bank_discount" &&
                                  deal.banks && (
                                    <div className="flex items-center gap-2 mb-3">
                                      <span className="text-xs text-muted-foreground">
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

                                {/* Expandable Terms */}
                                {showExpandable && (
                                  <div className="mt-3">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        toggleDealExpansion(deal.id)
                                      }
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
                                          animate={{
                                            height: "auto",
                                            opacity: 1,
                                          }}
                                          exit={{ height: 0, opacity: 0 }}
                                          transition={{
                                            duration: 0.3,
                                            ease: "easeInOut",
                                          }}
                                          className="overflow-hidden"
                                        >
                                          <div className="mt-3 p-4 bg-black/20 rounded-xl border border-primary/10 space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
                                            {parsedTerms.sections.map(
                                              (section, idx) => (
                                                <div key={idx}>
                                                  <h5 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                                                    <div className="w-1 h-1 rounded-full bg-primary" />
                                                    {section.title}
                                                  </h5>
                                                  <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
                                                    {section.items.map(
                                                      (item, itemIdx) => (
                                                        <li
                                                          key={itemIdx}
                                                          className="flex gap-2"
                                                        >
                                                          <span className="text-primary/50 flex-shrink-0">
                                                            •
                                                          </span>
                                                          <span>{item}</span>
                                                        </li>
                                                      ),
                                                    )}
                                                  </ul>
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                )}

                                {/* Short Preview (if not expandable) */}
                                {!showExpandable && (
                                  <div className="text-xs text-muted-foreground">
                                    <span className="font-medium">
                                      Details:
                                    </span>{" "}
                                    {getTermsPreview(deal.description)}
                                  </div>
                                )}
                              </div>

                              {/* Deal Footer */}
                              <div className="flex items-center justify-between pt-4 border-t border-border/30">
                                <div className="flex items-center gap-4 text-xs md:text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    <span>
                                      Valid until{" "}
                                      {deal.end_date
                                        ? formatDate(deal.end_date)
                                        : "TBD"}
                                    </span>
                                  </div>
                                </div>

                                <Badge
                                  variant="outline"
                                  className={`text-xs px-3 py-1 ${
                                    expiringSoon
                                      ? "border-orange-500/30 text-orange-600 bg-orange-500/10"
                                      : "border-green-500/30 text-green-600 bg-green-500/10"
                                  }`}
                                >
                                  <Clock className="h-3 w-3 mr-1" />
                                  {expiringSoon ? "Ending Soon" : "Active"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default memo(PremiumDealsModal);
