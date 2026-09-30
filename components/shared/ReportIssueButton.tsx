"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportIssueModal } from "./ReportIssueModal";

interface ReportIssueButtonProps {
  reportType: "listing" | "event";
  itemId: number;
  itemName: string;
  itemSlug: string;
}

export function ReportIssueButton({
  reportType,
  itemId,
  itemName,
  itemSlug,
}: ReportIssueButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsModalOpen(true)}
        className="text-muted-foreground hover:text-foreground transition-all duration-300 rounded-xl px-4 py-3 text-xs md:text-sm"
      >
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded-md bg-muted/50 border border-border/50">
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <span>Report incorrect information</span>
          <ExternalLink className="w-3 h-3" />
        </div>
      </Button>

      <ReportIssueModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        reportType={reportType}
        itemId={itemId}
        itemName={itemName}
        itemSlug={itemSlug}
      />
    </>
  );
}
