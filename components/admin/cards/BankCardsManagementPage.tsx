"use client";

import * as React from "react";
import Image from "next/image";
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  Loader2,
  Sparkles,
  Edit2,
  Check,
  CheckCircle2,
  AlertCircle,
  Building2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BankCardImage } from "@/components/bank-cards/BankCardImage";
import { AddCardDialog, CardVariantRow } from "./AddCardDialog";

interface BankOption {
  id: number;
  name: string;
  logo_url?: string | null;
  code?: string | null;
}

export function BankCardsManagementPage() {
  const { toast } = useToast();
  const [cards, setCards] = React.useState<CardVariantRow[]>([]);
  const [banks, setBanks] = React.useState<BankOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filters
  const [selectedBankId, setSelectedBankId] = React.useState<string>("all");
  const [selectedNetwork, setSelectedNetwork] = React.useState<string>("all");
  const [selectedType, setSelectedType] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Dialogs
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [editingCard, setEditingCard] = React.useState<CardVariantRow | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = React.useState(false);

  // Edit form state
  const [editName, setEditName] = React.useState("");
  const [editType, setEditType] = React.useState("");
  const [editNetwork, setEditNetwork] = React.useState("");
  const [editTier, setEditTier] = React.useState("");
  const [editFile, setEditFile] = React.useState<File | null>(null);
  const [editFilePreview, setEditFilePreview] = React.useState<string | null>(null);

  const fetchBanks = React.useCallback(async () => {
    try {
      const res = await fetch("/api/banks");
      const data = await res.json();
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
    } catch (err) {
      console.error("Failed to load banks:", err);
    }
  }, []);

  const fetchCards = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBankId !== "all") {
        params.set("bank_id", selectedBankId);
      }
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }
      params.set("limit", "200");

      const res = await fetch(`/api/admin/cards?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setCards(data.cards || []);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to load cards",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error loading cards:", err);
      toast({
        title: "Error",
        description: "Failed to load cards",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedBankId, searchQuery, toast]);

  React.useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  React.useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Handle toggle active
  const handleToggleActive = async (card: CardVariantRow) => {
    try {
      const nextActive = !card.is_active;
      // Optimistic update
      setCards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, is_active: nextActive } : c)),
      );

      const res = await fetch(`/api/admin/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update status");
      }

      toast({
        title: nextActive ? "Card Activated" : "Card Deactivated",
        description: `"${card.card_name}" is now ${nextActive ? "active" : "inactive"}.`,
      });
    } catch (err) {
      console.error("Toggle active error:", err);
      // Revert
      setCards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, is_active: card.is_active } : c)),
      );
      toast({
        title: "Error",
        description: "Failed to update card status",
        variant: "destructive",
      });
    }
  };

  const handleOpenEdit = (card: CardVariantRow) => {
    setEditingCard(card);
    setEditName(card.card_name);
    setEditType(card.card_type);
    setEditNetwork(card.card_network);
    setEditTier(card.card_tier || "");
    setEditFile(null);
    setEditFilePreview(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;

    setIsEditSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("card_name", editName.trim());
      formData.append("card_type", editType.trim());
      formData.append("card_network", editNetwork.trim());
      formData.append("card_tier", editTier.trim());
      if (editFile) {
        formData.append("file", editFile);
      }

      const res = await fetch(`/api/admin/cards/${editingCard.id}`, {
        method: "PATCH",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update card");
      }

      toast({
        title: "Card Updated",
        description: `"${editName}" updated successfully.`,
      });
      setEditingCard(null);
      fetchCards();
    } catch (err) {
      console.error("Edit card error:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update card",
        variant: "destructive",
      });
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // Client-side filtering for network and type
  const filteredCards = React.useMemo(() => {
    return cards.filter((card) => {
      if (selectedNetwork !== "all" && card.card_network?.toLowerCase() !== selectedNetwork.toLowerCase()) {
        return false;
      }
      if (selectedType !== "all" && card.card_type?.toLowerCase() !== selectedType.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [cards, selectedNetwork, selectedType]);

  const activeBankCount = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cards) {
      counts[c.bank_id] = (counts[c.bank_id] || 0) + 1;
    }
    return counts;
  }, [cards]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Bank Cards Management
              </h1>
              <p className="text-sm text-muted-foreground">
                Create, organize, and upload card artwork for bank discount deals.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCards()}
            disabled={isLoading}
            className="h-9 gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            onClick={() => setIsAddOpen(true)}
            size="sm"
            className="h-9 gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Card</span>
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-card rounded-2xl border p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search card name, tier..."
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Bank Select */}
          <div>
            <Select value={selectedBankId} onValueChange={setSelectedBankId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All Banks" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="all">All Banks ({cards.length})</SelectItem>
                {banks.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    <div className="flex items-center gap-2">
                      {b.logo_url && (
                        <Image
                          src={b.logo_url}
                          alt=""
                          width={14}
                          height={14}
                          className="w-3.5 h-3.5 object-contain"
                        />
                      )}
                      <span>{b.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Network Select */}
          <div>
            <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All Networks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Networks</SelectItem>
                <SelectItem value="visa">Visa</SelectItem>
                <SelectItem value="mastercard">Mastercard</SelectItem>
                <SelectItem value="paypak">PayPak</SelectItem>
                <SelectItem value="unionpay">UnionPay</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Type Select */}
          <div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All Card Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="debit">Debit</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
                <SelectItem value="charge">Charge</SelectItem>
                <SelectItem value="prepaid">Prepaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quick Bank Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
          <span className="text-muted-foreground font-semibold whitespace-nowrap mr-1">
            Banks:
          </span>
          <button
            type="button"
            onClick={() => setSelectedBankId("all")}
            className={`px-3 py-1 rounded-full border transition-all whitespace-nowrap ${
              selectedBankId === "all"
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "bg-muted/50 hover:bg-muted text-muted-foreground"
            }`}
          >
            All Banks ({cards.length})
          </button>
          {banks.slice(0, 10).map((b) => {
            const isSelected = selectedBankId === String(b.id);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBankId(String(b.id))}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all whitespace-nowrap ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary font-medium shadow-sm"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground"
                }`}
              >
                {b.logo_url && (
                  <Image
                    src={b.logo_url}
                    alt=""
                    width={12}
                    height={12}
                    className="w-3 h-3 object-contain"
                  />
                )}
                <span>{b.name}</span>
                {activeBankCount[b.id] ? (
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-background text-foreground"
                    }`}
                  >
                    {activeBankCount[b.id]}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-dashed">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm font-medium text-foreground">Loading bank cards...</p>
          <p className="text-xs text-muted-foreground">Fetching card variants and images</p>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-dashed text-center p-6">
          <div className="p-4 rounded-full bg-primary/10 text-primary mb-3">
            <CreditCard className="h-8 w-8" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">No cards found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            No bank cards match your current filters. You can add a new card variant to this bank with uploaded artwork.
          </p>
          <Button
            onClick={() => setIsAddOpen(true)}
            size="sm"
            className="gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Card</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredCards.map((card) => {
            return (
              <div
                key={card.id}
                className={`
                  group relative bg-card rounded-2xl border p-4 transition-all duration-300 hover:shadow-lg flex flex-col justify-between
                  ${!card.is_active ? "opacity-75 bg-muted/20 border-dashed" : "border-border/60 hover:border-primary/40"}
                `}
              >
                {/* Header: Bank info & active switch */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {card.bank_logo_url ? (
                      <Image
                        src={card.bank_logo_url}
                        alt=""
                        width={18}
                        height={18}
                        className="w-4 h-4 object-contain flex-shrink-0"
                      />
                    ) : (
                      <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-foreground truncate">
                      {card.bank_name || "Unknown Bank"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-[10px] font-medium ${
                        card.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                      }`}
                    >
                      {card.is_active ? "Active" : "Off"}
                    </span>
                    <Switch
                      checked={card.is_active}
                      onCheckedChange={() => handleToggleActive(card)}
                      className="scale-75"
                    />
                  </div>
                </div>

                {/* Card Artwork Showcase */}
                <div className="my-3 flex items-center justify-center py-2 bg-muted/30 rounded-xl border border-border/40 group-hover:bg-muted/50 transition-colors">
                  <div className="transform group-hover:scale-105 transition-transform duration-300">
                    <BankCardImage
                      cardVariant={{
                        id: card.id,
                        bank_id: card.bank_id,
                        card_name: card.card_name,
                        card_type: card.card_type,
                        card_network: card.card_network,
                        card_tier: card.card_tier,
                        image_filename: card.image_filename,
                        is_active: card.is_active,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      }}
                      bankName={card.bank_name || "Bank"}
                      size="md"
                      showName={false}
                    />
                  </div>
                </div>

                {/* Card Name & Metadata */}
                <div className="space-y-2 mt-auto pt-2 border-t border-border/50">
                  <div>
                    <h4
                      className="text-sm font-semibold text-foreground truncate"
                      title={card.card_name}
                    >
                      {card.card_name}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      ID #{card.id}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {card.card_network}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {card.card_type}
                    </Badge>
                    {card.card_tier && (
                      <Badge
                        variant="default"
                        className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                      >
                        {card.card_tier}
                      </Badge>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(card)}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-primary gap-1"
                    >
                      <Edit2 className="h-3 w-3" />
                      <span>Edit</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Card Dialog */}
      <AddCardDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        defaultBankId={selectedBankId !== "all" ? selectedBankId : undefined}
        banks={banks}
        onSuccess={() => {
          fetchCards();
        }}
      />

      {/* Edit Card Dialog */}
      {editingCard && (
        <Dialog open={!!editingCard} onOpenChange={(open) => !open && setEditingCard(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Edit Bank Card</DialogTitle>
              <DialogDescription>
                Update card details or replace its image.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className="text-xs font-semibold">
                  Card Name *
                </Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="h-9"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-type" className="text-xs font-semibold">
                    Type
                  </Label>
                  <Select value={editType} onValueChange={setEditType}>
                    <SelectTrigger id="edit-type" className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Debit">Debit</SelectItem>
                      <SelectItem value="Credit">Credit</SelectItem>
                      <SelectItem value="Charge">Charge</SelectItem>
                      <SelectItem value="Prepaid">Prepaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-net" className="text-xs font-semibold">
                    Network
                  </Label>
                  <Select value={editNetwork} onValueChange={setEditNetwork}>
                    <SelectTrigger id="edit-net" className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Visa">Visa</SelectItem>
                      <SelectItem value="Mastercard">Mastercard</SelectItem>
                      <SelectItem value="PayPak">PayPak</SelectItem>
                      <SelectItem value="UnionPay">UnionPay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-tier" className="text-xs font-semibold">
                    Tier
                  </Label>
                  <Input
                    id="edit-tier"
                    value={editTier}
                    onChange={(e) => setEditTier(e.target.value)}
                    placeholder="e.g. Platinum"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Replace Image */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-semibold">Replace Card Image</Label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-10 rounded border overflow-hidden relative bg-muted flex-shrink-0">
                    <BankCardImage
                      cardVariant={{
                        id: editingCard.id,
                        bank_id: editingCard.bank_id,
                        card_name: editName,
                        card_type: editType,
                        card_network: editNetwork,
                        card_tier: editTier,
                        image_filename: editFilePreview || editingCard.image_filename,
                        is_active: editingCard.is_active,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      }}
                      bankName={editingCard.bank_name || "Bank"}
                      size="sm"
                      showName={false}
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          setEditFile(file);
                          setEditFilePreview(URL.createObjectURL(file));
                        }
                      }}
                      className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Leave empty to keep existing image.
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingCard(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isEditSubmitting}>
                  {isEditSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
