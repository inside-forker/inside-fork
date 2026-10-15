"use client";

import { useEffect, useState } from "react";
import { BankCardImage, BankCardFallback } from "./BankCardImage";
import { Database } from "@/types/database";

// Use real Supabase types
type CardVariant = Database["public"]["Tables"]["card_variants"]["Row"];

interface BankCardShowcaseProps {
  bankName: string;
  bankId?: number | null;
  dealId?: number;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  maxCards?: number;
}

export function BankCardShowcase({
  bankName,
  bankId,
  dealId,
  size = "sm",
  className = "",
  maxCards = 24,
}: BankCardShowcaseProps) {
  const [cardVariants, setCardVariants] = useState<CardVariant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCardVariants = async () => {
      try {
        const params = new URLSearchParams();
        if (bankId) params.set("bankId", String(bankId));
        if (bankName) params.set("bankName", bankName);
        if (dealId) params.set("dealId", String(dealId));
        params.set("maxCards", String(maxCards));

        const res = await fetch(`/api/bank-cards?${params.toString()}`);
        const result = await res.json();
        const cards = (result.cards || []) as CardVariant[];

        setCardVariants(cards);
      } catch (error) {
        console.error("Error in fetchCardVariants:", error);
        setCardVariants([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCardVariants();
  }, [bankName, bankId, dealId, maxCards]);

  if (loading) {
    return (
      <div className={`flex gap-2 ${className}`}>
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="w-15 h-9 bg-muted/50 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (cardVariants.length === 0) {
    return <BankCardFallback size={size} className={className} />;
  }

  return (
    <div className={`flex gap-2 flex-wrap ${className}`}>
      {cardVariants.map((variant) => (
        <BankCardImage
          key={variant.id}
          cardVariant={variant}
          bankName={bankName}
          size={size}
          className="transition-transform hover:scale-105"
        />
      ))}
    </div>
  );
}
