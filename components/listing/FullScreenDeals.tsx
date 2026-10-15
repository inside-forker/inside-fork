"use client";

import { useState, useEffect } from "react";
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
}

interface FullScreenDealsProps {
  isOpen: boolean;
  onClose: () => void;
  deals: Deal[];
  businessName: string;
}

// Helper functions (same as PremiumDealsModal)
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

export function FullScreenDeals({
  isOpen,
  onClose,
  deals,
  businessName,
}: FullScreenDealsProps) {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "expiring" | "discount">(
    "newest",
  );
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
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
        setActiveTab("all");
        setSearchQuery("");
        setSortBy("newest");
        setSelectedBank("");
        setShowFilters(false);
      }, 300);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Filter and categorize deals
  const activeDeals = deals.filter(
    (deal) =>
      deal.is_active && deal.end_date && new Date(deal.end_date) > new Date(),
  );

  const bankDeals = activeDeals.filter(
    (deal) => deal.deal_type === "bank_discount",
  );
  const restaurantDeals = activeDeals.filter(
    (deal) => deal.deal_type !== "bank_discount",
  );

  // Get unique banks for filter
  const availableBanks = [
    ...new Set(
      deals.filter((deal) => deal.banks?.name).map((deal) => deal.banks!.name),
    ),
  ].sort();

  // Filter deals based on active tab and filters
  const getFilteredDeals = () => {
    let filtered = activeDeals;

    // Tab filter
    if (activeTab === "bank") {
      filtered = bankDeals;
    } else if (activeTab === "restaurant") {
      filtered = restaurantDeals;
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (deal) =>
          deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          deal.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          deal.banks?.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Bank filter
    if (selectedBank) {
      filtered = filtered.filter((deal) => deal.banks?.name === selectedBank);
    }

    return filtered;
  };

  const sortDeals = (deals: Deal[]) => {
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
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
    }
  };

  const filteredDeals = sortDeals(getFilteredDeals());

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[10000] flex flex-col bg-background"
        >
          {/* Header - Styled to match FullScreenMenu */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
            <div className="relative flex items-center justify-between p-6 border-b border-border/50">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {businessName}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Deals & Offers
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="hover:bg-primary/10"
              >
                <X className="h-6 w-6" />
                <span className="sr-only">Close deals</span>
              </Button>
            </div>
          </div>

          {/* Search and Filter Section */}
          <div className="p-4 sm:p-6 space-y-4 border-b border-border/20 bg-background/30">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search deals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 w-full rounded-xl bg-muted/50 border-border/50 pl-10 pr-4"
              />
            </div>

            {/* Tabs - Styled like FullScreenMenu */}
            <div className="overflow-x-auto scrollbar-thin">
              <div className="flex gap-2 min-w-max pb-2">
                {[
                  {
                    id: "all",
                    label: "All Deals",
                    count: activeDeals.length,
                    icon: Tag,
                  },
                  {
                    id: "bank",
                    label: "Bank Offers",
                    count: bankDeals.length,
                    icon: CreditCard,
                  },
                  {
                    id: "restaurant",
                    label: "Restaurant",
                    count: restaurantDeals.length,
                    icon: Percent,
                  },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  const IconComponent = tab.icon;
                  return (
                    <motion.button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 whitespace-nowrap ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <IconComponent className="h-4 w-4" />
                      <span>{tab.label}</span>
                      <Badge
                        variant="secondary"
                        className={`h-5 text-xs px-2 ${
                          isActive
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-background/50"
                        }`}
                      >
                        {tab.count}
                      </Badge>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Collapsible Filters */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex w-full items-center justify-between rounded-xl bg-muted/50 border border-border/50 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span>Filters & Sort</span>
                {(selectedBank || sortBy !== "newest") && (
                  <Badge
                    variant="secondary"
                    className="h-5 text-xs px-2 bg-primary/10 text-primary"
                  >
                    {
                      [
                        selectedBank,
                        sortBy !== "newest" ? sortBy : null,
                      ].filter(Boolean).length
                    }
                  </Badge>
                )}
              </div>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  showFilters ? "rotate-180" : ""
                }`}
              />
            </button>

            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-3 overflow-hidden"
              >
                {/* Bank Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Filter by Bank:
                  </label>
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm"
                  >
                    <option value="">All Banks</option>
                    {availableBanks.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Sort by:
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(
                        e.target.value as "newest" | "expiring" | "discount",
                      )
                    }
                    className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm"
                  >
                    <option value="newest">Newest First</option>
                    <option value="expiring">Expiring Soon</option>
                    <option value="discount">Highest Discount</option>
                  </select>
                </div>
              </motion.div>
            )}
          </div>

          {/* Deals List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {filteredDeals.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-center p-6">
                <div>
                  <Tag className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-medium">No deals found</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {searchQuery
                      ? "Try adjusting your search terms"
                      : "No active deals in this category"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {filteredDeals.map((deal) => {
                  const IconComponent = getDealIcon(deal.deal_type);
                  const expiringSoon = isExpiringSoon(deal.end_date);
                  const parsedTerms = parseDealTerms(deal.description);
                  const showExpandable = hasSubstantialTerms(deal.description);
                  const isExpanded = expandedDeals.has(deal.id);

                  return (
                    <motion.div
                      key={deal.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 border border-border/50 rounded-xl p-4 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300"
                    >
                      {/* Deal Header - Optimized for mobile */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20 flex-shrink-0 overflow-hidden relative">
                          {deal.deal_type === "bank_discount" &&
                          deal.banks?.logo_url ? (
                            <Image
                              src={deal.banks.logo_url}
                              alt={deal.banks.name}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : (
                            <IconComponent className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-base leading-tight mb-1">
                            {deal.title}
                          </h4>
                          <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                            <Badge
                              variant="secondary"
                              className="text-xs px-1.5 py-0.5 md:px-2 md:py-0.5 h-5 md:h-auto"
                            >
                              {getDealTypeLabel(deal.deal_type)}
                            </Badge>
                            {deal.banks && (
                              <Badge
                                variant="outline"
                                className="text-xs px-1.5 py-0.5 md:px-2 md:py-0.5 h-5 md:h-auto border-primary/30 text-foreground bg-primary/10 gap-1.5"
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
                                  <CreditCard className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                )}
                                <span className="truncate max-w-20 md:max-w-none">
                                  {deal.banks.name}
                                </span>
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-lg font-black text-primary">
                            {deal.discount_value || "Special"}
                          </div>
                          {expiringSoon && (
                            <Badge
                              variant="destructive"
                              className="text-xs px-1.5 py-0.5 h-5 animate-pulse"
                            >
                              <span className="hidden sm:inline">⚡ </span>
                              Ending Soon
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Smart Summary */}
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                        {parsedTerms.summary}
                      </p>

                      {/* Highlights */}
                      {parsedTerms.highlights.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
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

                      {/* Card Types for Bank Deals */}
                      {deal.deal_type === "bank_discount" && deal.banks && (
                        <div className="flex items-start gap-2 mb-3">
                          <span className="text-xs text-muted-foreground flex-shrink-0 pt-1">
                            Valid on:
                          </span>
                          <div className="flex-1">
                            <BankCardShowcase
                              bankName={deal.banks.name}
                              bankId={deal.bank_id || undefined}
                              dealId={deal.id}
                              size="sm"
                              maxCards={24}
                            />
                          </div>
                        </div>
                      )}

                      {/* Expandable Terms */}
                      {showExpandable && (
                        <div className="mb-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleDealExpansion(deal.id)}
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
                                transition={{
                                  duration: 0.3,
                                  ease: "easeInOut",
                                }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 p-4 bg-black/20 rounded-xl border border-primary/10 space-y-3 max-h-64 overflow-y-auto">
                                  {parsedTerms.sections.map((section, idx) => (
                                    <div key={idx}>
                                      <h5 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                                        <div className="w-1 h-1 rounded-full bg-primary" />
                                        {section.title}
                                      </h5>
                                      <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
                                        {section.items.map((item, itemIdx) => (
                                          <li
                                            key={itemIdx}
                                            className="flex gap-2"
                                          >
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

                      {/* Short Preview (if not expandable) */}
                      {!showExpandable && (
                        <div className="text-xs text-muted-foreground mb-3">
                          <span className="font-medium">Details:</span>{" "}
                          {getTermsPreview(deal.description)}
                        </div>
                      )}

                      {/* Footer - Simplified for mobile */}
                      <div className="flex items-center justify-between pt-3 border-t border-border/30">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>
                            Until{" "}
                            {deal.end_date ? formatDate(deal.end_date) : "TBD"}
                          </span>
                        </div>

                        <Badge
                          variant="outline"
                          className={`text-xs px-2 py-0.5 md:px-3 md:py-1 h-6 md:h-auto flex-shrink-0 ${
                            expiringSoon
                              ? "border-orange-500/30 text-orange-600 bg-orange-500/10"
                              : "border-green-500/30 text-green-600 bg-green-500/10"
                          }`}
                        >
                          <Clock className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1" />
                          {expiringSoon ? "Ending Soon" : "Active"}
                        </Badge>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
