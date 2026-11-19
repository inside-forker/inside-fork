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
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  UploadCloud,
  Loader2,
  X,
  Sparkles,
  Link as LinkIcon,
  Check,
  Wallet,
} from "lucide-react";

export interface BankItem {
  id: number;
  name: string;
  code?: string | null;
  logo_url?: string | null;
  is_active?: boolean;
}

interface CreateBankDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (createdBank: BankItem) => void;
}

const PRESET_WALLETS = [
  {
    name: "Easypaisa",
    code: "EP",
    color: "#00A859",
    suggestedLogo: "https://insidekhi.sgp1.cdn.digitaloceanspaces.com/banks/easypaisa.png",
  },
  {
    name: "JazzCash",
    code: "JC",
    color: "#E31B23",
    suggestedLogo: "https://insidekhi.sgp1.cdn.digitaloceanspaces.com/banks/jazzcash.png",
  },
  {
    name: "SadaPay",
    code: "SADA",
    color: "#FF5E3A",
    suggestedLogo: "https://insidekhi.sgp1.cdn.digitaloceanspaces.com/banks/sadapay.png",
  },
  {
    name: "NayaPay",
    code: "NAYA",
    color: "#0055FF",
    suggestedLogo: "https://insidekhi.sgp1.cdn.digitaloceanspaces.com/banks/nayapay.png",
  },
];

export function CreateBankDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateBankDialogProps) {
  const { toast } = useToast();
  const [bankName, setBankName] = React.useState("");
  const [bankCode, setBankCode] = React.useState("");
  const [uploadMode, setUploadMode] = React.useState<"file" | "url">("file");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [imageUrl, setImageUrl] = React.useState<string>("");
  const [isDragging, setIsDragging] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  const handleResetForm = () => {
    setBankName("");
    setBankCode("");
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageUrl("");
    setUploadMode("file");
  };

  const applyPreset = (preset: (typeof PRESET_WALLETS)[0]) => {
    setBankName(preset.name);
    setBankCode(preset.code);
    setImageUrl(preset.suggestedLogo);
    setUploadMode("url");
  };

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
        description: "Please select an image file (PNG, JPG, SVG, WebP).",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image size must be under 5MB.",
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);
    setImageUrl("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bankName.trim()) {
      toast({
        title: "Bank name is required",
        description: "Please enter a name for the bank or digital wallet.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append("name", bankName.trim());
      if (bankCode.trim()) {
        formData.append("code", bankCode.trim().toUpperCase());
      }
      if (uploadMode === "file" && selectedFile) {
        formData.append("logo", selectedFile);
      } else if (imageUrl.trim()) {
        formData.append("logo_url", imageUrl.trim());
      }

      const res = await fetch("/api/admin/banks", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create bank");
      }

      toast({
        title: "Bank / Wallet Created",
        description: `"${data.bank.name}" has been successfully added to the system.`,
      });

      const created: BankItem = {
        id: data.bank.id,
        name: data.bank.name,
        code: data.bank.code,
        logo_url: data.bank.logo_url,
        is_active: data.bank.is_active,
      };

      handleResetForm();
      onOpenChange(false);

      if (onSuccess) {
        onSuccess(created);
      }
    } catch (err) {
      console.error("Bank creation error:", err);
      toast({
        title: "Error Creating Bank",
        description: err instanceof Error ? err.message : "Failed to create bank",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const effectiveLogoUrl = uploadMode === "file" ? previewUrl : (imageUrl || null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Add Bank / Digital Wallet
              </DialogTitle>
              <DialogDescription>
                Create a bank, microfinance provider, or digital wallet (Easypaisa, JazzCash, etc.)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Quick 1-click Presets */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
              <Sparkles className="size-3 text-primary" /> Popular Pakistani Wallets:
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_WALLETS.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-muted/50 hover:bg-muted text-foreground transition-all hover:scale-105"
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="p-3.5 bg-muted/40 rounded-xl border flex items-center gap-3">
            <div className="size-10 rounded-lg bg-background border flex items-center justify-center shrink-0 overflow-hidden relative shadow-sm">
              {effectiveLogoUrl ? (
                <Image
                  src={effectiveLogoUrl}
                  alt={bankName || "Bank Logo"}
                  width={36}
                  height={36}
                  className="object-contain size-8"
                  unoptimized
                />
              ) : (
                <Wallet className="size-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">
                {bankName.trim() || "Bank / Wallet Name"}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                Code: {bankCode.trim().toUpperCase() || "AUTO"}
              </div>
            </div>
          </div>

          {/* Bank Name */}
          <div className="space-y-1.5">
            <Label htmlFor="create-bank-name" className="text-xs font-semibold">
              Bank / Wallet Name *
            </Label>
            <Input
              id="create-bank-name"
              value={bankName}
              onChange={(e) => {
                setBankName(e.target.value);
                if (!bankCode) {
                  // Auto-suggest code
                  const words = e.target.value.trim().split(/\s+/);
                  if (words.length > 1) {
                    setBankCode(words.map((w) => w[0]).join("").toUpperCase());
                  }
                }
              }}
              placeholder="e.g. Easypaisa, JazzCash, Meezan Bank"
              className="h-9"
              required
            />
          </div>

          {/* Short Code */}
          <div className="space-y-1.5">
            <Label htmlFor="create-bank-code" className="text-xs font-semibold">
              Short Code
            </Label>
            <Input
              id="create-bank-code"
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value.toUpperCase())}
              placeholder="e.g. EP, JC, MEBL"
              maxLength={10}
              className="h-9 font-mono uppercase"
            />
          </div>

          {/* Logo Uploader */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Logo (Optional)</Label>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setUploadMode("file")}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    uploadMode === "file"
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Upload File
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setUploadMode("url")}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    uploadMode === "url"
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Image URL
                </button>
              </div>
            </div>

            {uploadMode === "file" ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelected(file);
                  }}
                />

                {selectedFile && previewUrl ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-8 rounded bg-background border flex items-center justify-center shrink-0 overflow-hidden">
                        <Image
                          src={previewUrl}
                          alt="Preview"
                          width={28}
                          height={28}
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">
                          {selectedFile.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="h-7 w-7 p-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 bg-muted/20"
                    }`}
                  >
                    <UploadCloud className="size-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs font-medium">Click or drag logo image here</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      PNG, JPG, WebP, or SVG up to 5MB
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="pl-8 h-9 text-xs"
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !bankName.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="mr-1.5 h-4 w-4" />
                  Create Bank / Wallet
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

