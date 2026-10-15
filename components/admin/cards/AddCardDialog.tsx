"use client";

import * as React from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard,
  UploadCloud,
  Loader2,
  X,
  Sparkles,
  Link as LinkIcon,
  Check,
} from "lucide-react";
import { BankCardImage } from "@/components/bank-cards/BankCardImage";

export type CardVariantRow = {
  id: number;
  bank_id: number;
  card_name: string;
  card_type: string;
  card_network: string;
  card_tier: string | null;
  image_filename: string | null;
  is_active: boolean;
  bank_name?: string;
  bank_code?: string;
  bank_logo_url?: string | null;
};

interface BankOption {
  id: number;
  name: string;
  logo_url?: string | null;
  code?: string | null;
}

interface AddCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBankId?: number | string;
  defaultBankName?: string;
  banks?: BankOption[];
  onSuccess?: (createdCard: CardVariantRow) => void;
}

const CARD_TYPES = ["Debit", "Credit", "Charge", "Prepaid"] as const;
const CARD_NETWORKS = ["Visa", "Mastercard", "PayPak", "UnionPay"] as const;
const COMMON_TIERS = [
  "Charge",
  "Classic",
  "Gold",
  "Platinum",
  "Titanium",
  "Infinite",
  "World",
  "Signature",
  "Standard",
  "Student",
  "Corporate",
] as const;

export function AddCardDialog({
  open,
  onOpenChange,
  defaultBankId,
  defaultBankName,
  banks: propBanks,
  onSuccess,
}: AddCardDialogProps) {
  const { toast } = useToast();
  const [banks, setBanks] = React.useState<BankOption[]>(propBanks || []);
  const [selectedBankId, setSelectedBankId] = React.useState<string>(
    defaultBankId ? String(defaultBankId) : "",
  );
  const [cardName, setCardName] = React.useState("");
  const [cardType, setCardType] = React.useState<string>("Debit");
  const [cardNetwork, setCardNetwork] = React.useState<string>("Visa");
  const [cardTier, setCardTier] = React.useState<string>("Classic");
  const [customTier, setCustomTier] = React.useState("");
  const [isCustomTier, setIsCustomTier] = React.useState(false);

  // Image upload state
  const [uploadMode, setUploadMode] = React.useState<"file" | "url">("file");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [imageUrl, setImageUrl] = React.useState<string>("");
  const [isDragging, setIsDragging] = React.useState(false);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync propBanks or fetch if needed
  React.useEffect(() => {
    if (propBanks && propBanks.length > 0) {
      setBanks(propBanks);
    } else if (open && banks.length === 0) {
      fetch("/api/banks")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.banks)) {
            setBanks(
              data.banks.map((b: { value: string; label: string; logoUrl?: string; code?: string }) => ({
                id: parseInt(b.value, 10),
                name: b.label,
                logo_url: b.logoUrl,
                code: b.code,
              })),
            );
          }
        })
        .catch((err) => console.error("Error loading banks:", err));
    }
  }, [open, propBanks, banks.length]);

  // Sync default bank when opened
  React.useEffect(() => {
    if (defaultBankId) {
      setSelectedBankId(String(defaultBankId));
    }
  }, [defaultBankId, open]);

  // Clean preview URL when file changes
  React.useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const activeBank = React.useMemo(() => {
    if (!selectedBankId) return null;
    return banks.find((b) => String(b.id) === selectedBankId);
  }, [banks, selectedBankId]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelected(files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file (PNG, JPG, or WebP).",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image size must be less than 10MB.",
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);
  };

  const handleResetForm = () => {
    if (!defaultBankId) setSelectedBankId("");
    setCardName("");
    setCardType("Debit");
    setCardNetwork("Visa");
    setCardTier("Classic");
    setCustomTier("");
    setIsCustomTier(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageUrl("");
    setUploadMode("file");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBankId) {
      toast({
        title: "Bank required",
        description: "Please select a bank for this card.",
        variant: "destructive",
      });
      return;
    }

    if (!cardName.trim()) {
      toast({
        title: "Card Name required",
        description: "Please provide a name for this card (e.g. Visa Charge Card).",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("bank_id", selectedBankId);
      formData.append("card_name", cardName.trim());
      formData.append("card_type", cardType);
      formData.append("card_network", cardNetwork);

      const finalTier = isCustomTier ? customTier.trim() : cardTier;
      if (finalTier) {
        formData.append("card_tier", finalTier);
      }

      if (uploadMode === "file" && selectedFile) {
        formData.append("file", selectedFile);
      } else if (uploadMode === "url" && imageUrl.trim()) {
        formData.append("image_url", imageUrl.trim());
      }

      const res = await fetch("/api/admin/cards", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create card");
      }

      toast({
        title: "Card Added Successfully",
        description: `"${cardName}" has been added and associated with ${activeBank?.name || defaultBankName || "the bank"}.`,
      });

      handleResetForm();
      onOpenChange(false);

      if (onSuccess && data.card) {
        onSuccess(data.card);
      }
    } catch (err) {
      console.error("Card creation error:", err);
      toast({
        title: "Error Creating Card",
        description: err instanceof Error ? err.message : "Failed to create card",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const effectiveImageUrl = uploadMode === "file" ? previewUrl : (imageUrl || null);
  const effectiveTier = isCustomTier ? customTier : cardTier;
  const currentBankDisplayName = activeBank?.name || defaultBankName || "Bank";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Add New Bank Card</DialogTitle>
              <DialogDescription>
                Create a card variant, associate it with a bank, and upload its picture.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Card Live Preview */}
          <div className="p-4 bg-muted/40 rounded-xl border flex flex-col items-center justify-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Live Card Preview
            </span>
            <div className="transform hover:scale-105 transition-transform duration-200">
              <BankCardImage
                cardVariant={{
                  id: 0,
                  bank_id: parseInt(selectedBankId || "0", 10),
                  card_name: cardName.trim() || "Card Name",
                  card_type: cardType,
                  card_network: cardNetwork,
                  card_tier: effectiveTier || null,
                  image_filename: effectiveImageUrl,
                  is_active: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }}
                bankName={currentBankDisplayName}
                size="md"
                showName={false}
              />
            </div>
            <p className="text-xs text-muted-foreground font-medium text-center">
              {cardName.trim() || "Card Name"} • {currentBankDisplayName}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Bank Select */}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label htmlFor="card-bank" className="text-xs font-semibold">
                Bank *
              </Label>
              <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                <SelectTrigger id="card-bank" className="h-9">
                  <SelectValue placeholder="Select bank" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      <div className="flex items-center gap-2">
                        {b.logo_url && (
                          <Image
                            src={b.logo_url}
                            alt=""
                            width={16}
                            height={16}
                            className="w-4 h-4 object-contain"
                          />
                        )}
                        <span>{b.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Card Name */}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label htmlFor="card-name" className="text-xs font-semibold">
                Card Name *
              </Label>
              <Input
                id="card-name"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="e.g. Visa Charge Card"
                className="h-9"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Card Type */}
            <div className="space-y-1.5">
              <Label htmlFor="card-type" className="text-xs font-semibold">
                Card Type *
              </Label>
              <Select value={cardType} onValueChange={setCardType}>
                <SelectTrigger id="card-type" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Network */}
            <div className="space-y-1.5">
              <Label htmlFor="card-network" className="text-xs font-semibold">
                Network *
              </Label>
              <Select value={cardNetwork} onValueChange={setCardNetwork}>
                <SelectTrigger id="card-network" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARD_NETWORKS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tier */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="card-tier" className="text-xs font-semibold">
                  Tier
                </Label>
                <button
                  type="button"
                  onClick={() => setIsCustomTier(!isCustomTier)}
                  className="text-[10px] text-primary hover:underline"
                >
                  {isCustomTier ? "Select" : "Custom"}
                </button>
              </div>
              {isCustomTier ? (
                <Input
                  value={customTier}
                  onChange={(e) => setCustomTier(e.target.value)}
                  placeholder="e.g. Infinite"
                  className="h-9 text-xs"
                />
              ) : (
                <Select value={cardTier} onValueChange={setCardTier}>
                  <SelectTrigger id="card-tier" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_TIERS.map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {tier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Picture Upload Section */}
          <div className="space-y-2 pt-1 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">
                Card Picture / Artwork
              </Label>
              <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setUploadMode("file")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    uploadMode === "file"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <UploadCloud className="h-3 w-3 inline mr-1" />
                  Upload Image
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode("url")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    uploadMode === "url"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LinkIcon className="h-3 w-3 inline mr-1" />
                  Image URL
                </button>
              </div>
            </div>

            {uploadMode === "file" ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  cursor-pointer relative border-2 border-dashed rounded-xl p-5 text-center transition-all duration-200
                  ${
                    isDragging
                      ? "border-primary bg-primary/5 scale-[0.99]"
                      : "border-border/80 hover:border-primary/50 hover:bg-muted/30"
                  }
                  ${selectedFile ? "bg-primary/5 border-primary/40" : ""}
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                />

                {selectedFile ? (
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3 text-left">
                      <div className="p-2 bg-primary/10 text-primary rounded-lg">
                        <Check className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground truncate max-w-[260px]">
                          {selectedFile.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {(selectedFile.size / 1024).toFixed(1)} KB • Click to change
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-1.5 py-2">
                    <div className="p-2.5 rounded-full bg-primary/10 text-primary mb-1">
                      <UploadCloud className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-medium text-foreground">
                      Click to upload or drag & drop card picture
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      PNG, JPG, or WebP (Card ratio 1.58:1 recommended, max 10MB)
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://.../card-image.png"
                  className="h-9 text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Direct public URL to the card image (CDN or hosting).
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !cardName.trim() || !selectedBankId}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving Card...</span>
                </>
              ) : (
                <>
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Save & Add Card</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
