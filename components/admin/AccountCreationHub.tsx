"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserPlus,
  Shield,
  Building,
  Search,
  RefreshCw,
  Copy,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  UserCheck,
  Globe,
  Phone,
  Mail,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  KeyRound,
  BadgeCheck,
  Smartphone,
  Calendar,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { EOProfilePreviewCard } from "@/components/admin/EOProfilePreviewCard";

interface Account {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  role: "organizer" | "eo_gate_pass";
  active_role: string;
  phone: string | null;
  organizer_company: string | null;
  organizer_bio: string | null;
  organizer_website: string | null;
  is_verified_organizer: boolean | null;
  linked_organizer_id: string | null;
  linked_organizer_name: string | null;
  linked_organizer_company: string | null;
  linked_organizer_username: string | null;
  event_count: number;
  gate_pass_count: number;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total_eos: number;
  total_gate_passes: number;
  verified_eos: number;
}

interface OrganizerOption {
  id: string;
  full_name: string;
  username?: string | null;
  organizer_company?: string | null;
}

export function AccountCreationHub() {
  const [activeTab, setActiveTab] = useState<string>("directory");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stats, setStats] = useState<Stats>({ total_eos: 0, total_gate_passes: 0, verified_eos: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [organizerFilter, setOrganizerFilter] = useState<string>("");

  // Organizer list for Gate Pass dropdown
  const [availableOrganizers, setAvailableOrganizers] = useState<OrganizerOption[]>([]);
  const [isLoadingOrganizers, setIsLoadingOrganizers] = useState(false);

  // EO Form State
  const [eoForm, setEoForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    company: "",
    website: "",
    bio: "",
    isVerified: true,
    customPassword: "",
  });
  const [isSubmittingEo, setIsSubmittingEo] = useState(false);

  // Gate Pass Form State
  const [gpForm, setGpForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    linkedOrganizerId: "",
    customPassword: "",
  });
  const [isSubmittingGp, setIsSubmittingGp] = useState(false);

  // Password Success Dialog State
  const [createdCredentials, setCreatedCredentials] = useState<{
    user: {
      id: string;
      full_name: string;
      username: string;
      email: string;
      role: string;
      linked_organizer_name?: string;
    };
    tempPassword: string;
  } | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  const { toast } = useToast();

  // Fetch Accounts Directory
  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (organizerFilter) params.set("organizer_id", organizerFilter);

      const res = await fetch(`/api/admin/accounts?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load accounts");

      const data = await res.json();
      if (data.success) {
        setAccounts(data.data.accounts || []);
        setStats(data.data.stats || { total_eos: 0, total_gate_passes: 0, verified_eos: 0 });
        setTotalPages(data.data.pagination.totalPages || 1);
      }
    } catch (err) {
      console.error("Error fetching accounts:", err);
      toast({
        title: "Fetch Error",
        description: "Could not load the accounts directory",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, roleFilter, organizerFilter, toast]);

  // Fetch Organizers for Gate Pass dropdown
  const fetchOrganizersForSelect = useCallback(async () => {
    setIsLoadingOrganizers(true);
    try {
      const res = await fetch("/api/admin/accounts?role=organizer&limit=100");
      if (!res.ok) throw new Error("Failed to load organizers");
      const data = await res.json();
      if (data.success) {
        const orgs = (data.data.accounts || []).map((acc: Account) => ({
          id: acc.id,
          full_name: acc.full_name || acc.username || "Organizer",
          username: acc.username,
          organizer_company: acc.organizer_company,
        }));
        setAvailableOrganizers(orgs);
      }
    } catch (err) {
      console.error("Error loading organizers dropdown:", err);
    } finally {
      setIsLoadingOrganizers(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    fetchOrganizersForSelect();
  }, [fetchOrganizersForSelect]);

  // Auto-copy password on modal open
  useEffect(() => {
    if (isPasswordDialogOpen && createdCredentials?.tempPassword) {
      navigator.clipboard
        .writeText(createdCredentials.tempPassword)
        .then(() => {
          toast({
            title: "Password Auto-Copied!",
            description: "Temporary password copied to clipboard.",
          });
        })
        .catch(() => {});
    }
  }, [isPasswordDialogOpen, createdCredentials, toast]);

  // Submit EO creation
  const handleCreateEo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eoForm.fullName.trim() || !eoForm.email.trim()) {
      toast({
        title: "Validation Error",
        description: "Full Name and Email are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingEo(true);
    try {
      const res = await fetch("/api/admin/accounts/eo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: eoForm.fullName,
          username: eoForm.username || undefined,
          email: eoForm.email,
          phone: eoForm.phone || undefined,
          organizer_company: eoForm.company || undefined,
          organizer_bio: eoForm.bio || undefined,
          organizer_website: eoForm.website || undefined,
          is_verified_organizer: eoForm.isVerified,
          custom_password: eoForm.customPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create Event Organizer account");
      }

      // Reset form
      setEoForm({
        fullName: "",
        username: "",
        email: "",
        phone: "",
        company: "",
        website: "",
        bio: "",
        isVerified: true,
        customPassword: "",
      });

      // Show password modal
      setCreatedCredentials(data.data);
      setIsPasswordDialogOpen(true);

      // Refresh directory and dropdown list
      fetchAccounts();
      fetchOrganizersForSelect();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Error creating account";
      toast({
        title: "Creation Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsSubmittingEo(false);
    }
  };

  // Submit Gate Pass creation
  const handleCreateGp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gpForm.fullName.trim() || !gpForm.email.trim() || !gpForm.linkedOrganizerId) {
      toast({
        title: "Validation Error",
        description: "Operator Name, Email, and Linked Organizer are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingGp(true);
    try {
      const res = await fetch("/api/admin/accounts/gate-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: gpForm.fullName,
          username: gpForm.username || undefined,
          email: gpForm.email,
          phone: gpForm.phone || undefined,
          linked_organizer_id: gpForm.linkedOrganizerId,
          custom_password: gpForm.customPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create Gate Pass operator account");
      }

      // Reset form
      setGpForm({
        fullName: "",
        username: "",
        email: "",
        phone: "",
        linkedOrganizerId: "",
        customPassword: "",
      });

      // Show password modal
      setCreatedCredentials(data.data);
      setIsPasswordDialogOpen(true);

      // Refresh directory
      fetchAccounts();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Error creating operator";
      toast({
        title: "Creation Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsSubmittingGp(false);
    }
  };

  const selectedOrganizerName = availableOrganizers.find(
    (o) => o.id === gpForm.linkedOrganizerId,
  )?.full_name;

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <UserPlus className="h-7 w-7 text-primary" />
            Account Creation Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Provision verified Event Organizers and assign linked Gate Pass scanning operators.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchAccounts();
              fetchOrganizersForSelect();
            }}
            disabled={isLoading}
            className="border-border/60 hover:bg-muted"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-primary">
            <Building className="h-16 w-16" />
          </div>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-primary" /> Total Event Organizers
            </CardDescription>
            <CardTitle className="text-2xl font-black text-foreground">
              {stats.total_eos}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            <span className="font-semibold text-emerald-500">{stats.verified_eos} verified</span> profiles
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-amber-500">
            <Shield className="h-16 w-16" />
          </div>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-amber-500" /> Gate Pass Operators
            </CardDescription>
            <CardTitle className="text-2xl font-black text-foreground">
              {stats.total_gate_passes}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Linked to active EO accounts
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-500">
            <BadgeCheck className="h-16 w-16" />
          </div>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" /> Verification Rate
            </CardDescription>
            <CardTitle className="text-2xl font-black text-foreground">
              {stats.total_eos > 0 ? `${Math.round((stats.verified_eos / stats.total_eos) * 100)}%` : "100%"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Of all platform organizers verified
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Hub */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-xl bg-muted/60 p-1 rounded-xl border border-border/50">
          <TabsTrigger value="directory" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Users className="h-4 w-4 mr-2" />
            Directory
          </TabsTrigger>
          <TabsTrigger value="create-eo" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Building className="h-4 w-4 mr-2 text-primary" />
            + New EO
          </TabsTrigger>
          <TabsTrigger value="create-gate-pass" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Shield className="h-4 w-4 mr-2 text-amber-500" />
            + New Gate Pass
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: DIRECTORY */}
        <TabsContent value="directory" className="space-y-4 outline-none">
          <Card className="border-border/50 bg-card/70 backdrop-blur-xl shadow-lg">
            <CardHeader className="p-4 pb-3 border-b border-border/40">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                {/* Search */}
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name, company, email..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9 bg-background/50 rounded-xl text-sm"
                  />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Select
                    value={roleFilter}
                    onValueChange={(val) => {
                      setRoleFilter(val);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[160px] bg-background/50 rounded-xl text-xs font-medium">
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="organizer">Event Organizers</SelectItem>
                      <SelectItem value="eo_gate_pass">Gate Pass Operators</SelectItem>
                    </SelectContent>
                  </Select>

                  {roleFilter === "eo_gate_pass" && (
                    <Select
                      value={organizerFilter}
                      onValueChange={(val) => {
                        setOrganizerFilter(val === "all" ? "" : val);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[180px] bg-background/50 rounded-xl text-xs font-medium">
                        <SelectValue placeholder="Filter by EO" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Organizers</SelectItem>
                        {availableOrganizers.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">Loading accounts directory...</p>
                </div>
              ) : accounts.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <UserCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-semibold text-foreground">No accounts found</p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    Try adjusting your search criteria or create a new account.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40">
                      <tr>
                        <th className="py-3 px-4">Account / Name</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Company / Linked EO</th>
                        <th className="py-3 px-4 text-center">Events / Passes</th>
                        <th className="py-3 px-4">Created</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {accounts.map((acc) => {
                        const isEO = acc.role === "organizer";
                        return (
                          <tr
                            key={acc.id}
                            className="hover:bg-muted/20 transition-colors group"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                                    isEO
                                      ? "bg-primary/10 text-primary border border-primary/20"
                                      : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                  }`}
                                >
                                  {acc.full_name ? acc.full_name[0].toUpperCase() : "U"}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-foreground truncate">
                                      {acc.full_name || "Unnamed"}
                                    </span>
                                    {isEO && acc.is_verified_organizer && (
                                      <BadgeCheck className="h-3.5 w-3.5 text-emerald-500 fill-emerald-500/20 flex-shrink-0" />
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground font-mono truncate">
                                    {acc.email || `@${acc.username}`}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              {isEO ? (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-primary/30 text-primary bg-primary/5 font-semibold"
                                >
                                  Organizer
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-amber-500/30 text-amber-500 bg-amber-500/5 font-semibold"
                                >
                                  Gate Pass
                                </Badge>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {isEO ? (
                                <span className="font-medium text-foreground truncate block max-w-[180px]">
                                  {acc.organizer_company || (
                                    <span className="text-muted-foreground/50 italic">—</span>
                                  )}
                                </span>
                              ) : (
                                <div className="min-w-0">
                                  <span className="font-medium text-foreground truncate block max-w-[180px]">
                                    {acc.linked_organizer_name || "Unknown EO"}
                                  </span>
                                  {acc.linked_organizer_company && (
                                    <span className="text-xs text-muted-foreground truncate block">
                                      {acc.linked_organizer_company}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-4 text-center">
                              {isEO ? (
                                <div className="flex items-center justify-center gap-2 text-xs">
                                  <span
                                    className="px-2 py-0.5 rounded-md bg-background border border-border/50 font-mono"
                                    title="Hosted Events"
                                  >
                                    {acc.event_count} events
                                  </span>
                                  <span
                                    className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono"
                                    title="Gate Pass Operators"
                                  >
                                    {acc.gate_pass_count} operators
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">—</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(acc.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {isEO && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                                    onClick={() => {
                                      setRoleFilter("eo_gate_pass");
                                      setOrganizerFilter(acc.id);
                                      setPage(1);
                                    }}
                                  >
                                    <Shield className="h-3.5 w-3.5 mr-1" />
                                    View Passes ({acc.gate_pass_count})
                                  </Button>
                                )}

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    navigator.clipboard.writeText(acc.id);
                                    toast({
                                      title: "ID Copied",
                                      description: "User UUID copied to clipboard",
                                    });
                                  }}
                                  title="Copy User ID"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-border/40 text-xs text-muted-foreground">
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="h-8 px-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="h-8 px-2"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: CREATE EVENT ORGANIZER */}
        <TabsContent value="create-eo" className="outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Form (7 cols) */}
            <Card className="lg:col-span-7 border-border/50 bg-card/70 backdrop-blur-xl shadow-lg">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Building className="h-5 w-5 text-primary" />
                  Create Event Organizer Account
                </CardTitle>
                <CardDescription className="text-xs">
                  Provision an organizer profile for hosting ticketed and free events.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 pt-2">
                <form onSubmit={handleCreateEo} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">
                        Full Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        placeholder="e.g. Sarah Khan"
                        value={eoForm.fullName}
                        onChange={(e) =>
                          setEoForm({ ...eoForm, fullName: e.target.value })
                        }
                        className="bg-background/60 rounded-xl text-sm"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">
                        Email Address <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="email"
                        placeholder="organizer@domain.com"
                        value={eoForm.email}
                        onChange={(e) =>
                          setEoForm({ ...eoForm, email: e.target.value })
                        }
                        className="bg-background/60 rounded-xl text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Username (Optional)</Label>
                      <Input
                        placeholder="auto-generated if blank"
                        value={eoForm.username}
                        onChange={(e) =>
                          setEoForm({ ...eoForm, username: e.target.value })
                        }
                        className="bg-background/60 rounded-xl text-sm font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Phone Number</Label>
                      <Input
                        placeholder="+92 300 1234567"
                        value={eoForm.phone}
                        onChange={(e) =>
                          setEoForm({ ...eoForm, phone: e.target.value })
                        }
                        className="bg-background/60 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Company / Brand Name</Label>
                      <Input
                        placeholder="e.g. Karachi Underground Events"
                        value={eoForm.company}
                        onChange={(e) =>
                          setEoForm({ ...eoForm, company: e.target.value })
                        }
                        className="bg-background/60 rounded-xl text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Website / Social URL</Label>
                      <Input
                        placeholder="https://insidekhi.com"
                        value={eoForm.website}
                        onChange={(e) =>
                          setEoForm({ ...eoForm, website: e.target.value })
                        }
                        className="bg-background/60 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Organizer Bio</Label>
                    <Textarea
                      placeholder="Brief overview of the organizer's background, track record, and event genres..."
                      value={eoForm.bio}
                      onChange={(e) =>
                        setEoForm({ ...eoForm, bio: e.target.value })
                      }
                      rows={2}
                      className="bg-background/60 rounded-xl text-sm resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Custom Temporary Password (Optional)
                    </Label>
                    <Input
                      type="text"
                      placeholder="Leave empty to auto-generate a secure password"
                      value={eoForm.customPassword}
                      onChange={(e) =>
                        setEoForm({ ...eoForm, customPassword: e.target.value })
                      }
                      className="bg-background/60 rounded-xl text-sm font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/40">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground cursor-pointer">
                        <BadgeCheck className="h-4 w-4 text-emerald-500" />
                        Grant Verified Organizer Status
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Displays the verified badge on event pages and ticket listings.
                      </p>
                    </div>
                    <Switch
                      checked={eoForm.isVerified}
                      onCheckedChange={(checked) =>
                        setEoForm({ ...eoForm, isVerified: checked })
                      }
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmittingEo}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                  >
                    {isSubmittingEo ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Creating EO Account...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Create Event Organizer Account
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Right Live Preview (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <EOProfilePreviewCard
                fullName={eoForm.fullName}
                username={eoForm.username}
                email={eoForm.email}
                phone={eoForm.phone}
                company={eoForm.company}
                bio={eoForm.bio}
                website={eoForm.website}
                isVerified={eoForm.isVerified}
                role="organizer"
              />

              <div className="rounded-2xl border border-border/50 bg-card/40 p-4 text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> What happens next?
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground/90">
                  <li>Direct authenticated login created with permanent <strong>organizer</strong> role.</li>
                  <li>Organizer can create, publish, and manage ticketed events.</li>
                  <li>Admin can immediately assign Gate Pass scan staff under this EO.</li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: CREATE GATE PASS OPERATOR */}
        <TabsContent value="create-gate-pass" className="outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Form (7 cols) */}
            <Card className="lg:col-span-7 border-border/50 bg-card/70 backdrop-blur-xl shadow-lg">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Shield className="h-5 w-5 text-amber-500" />
                  Create EO Gate Pass Operator Account
                </CardTitle>
                <CardDescription className="text-xs">
                  Provision a dedicated gate scanner account linked to a specific Event Organizer.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 pt-2">
                <form onSubmit={handleCreateGp} className="space-y-4">
                  {/* Linked Organizer Selection */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Linked Event Organizer <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={gpForm.linkedOrganizerId}
                      onValueChange={(val) =>
                        setGpForm({ ...gpForm, linkedOrganizerId: val })
                      }
                      required
                    >
                      <SelectTrigger className="bg-background/60 rounded-xl text-sm h-11 border-amber-500/30 focus:border-amber-500">
                        <SelectValue placeholder="Select the Event Organizer this operator works for..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {availableOrganizers.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{org.full_name}</span>
                              {org.organizer_company && (
                                <span className="text-xs text-muted-foreground">
                                  ({org.organizer_company})
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      This operator will only have permissions to validate tickets for events organized by this EO.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">
                        Operator Full Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        placeholder="e.g. Gate Staff #1 (Bilal)"
                        value={gpForm.fullName}
                        onChange={(e) =>
                          setGpForm({ ...gpForm, fullName: e.target.value })
                        }
                        className="bg-background/60 rounded-xl text-sm"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">
                        Email Address <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="email"
                        placeholder="bilal.gate@insidekhi.com"
                        value={gpForm.email}
                        onChange={(e) =>
                          setGpForm({ ...gpForm, email: e.target.value })
                        }
                        className="bg-background/60 rounded-xl text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Username (Optional)</Label>
                      <Input
                        placeholder="auto-generated if blank"
                        value={gpForm.username}
                        onChange={(e) =>
                          setGpForm({ ...gpForm, username: e.target.value })
                        }
                        className="bg-background/60 rounded-xl text-sm font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Phone Number</Label>
                      <Input
                        placeholder="+92 300 9876543"
                        value={gpForm.phone}
                        onChange={(e) =>
                          setGpForm({ ...gpForm, phone: e.target.value })
                        }
                        className="bg-background/60 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Custom Temporary Password (Optional)
                    </Label>
                    <Input
                      type="text"
                      placeholder="Leave empty to auto-generate a secure password"
                      value={gpForm.customPassword}
                      onChange={(e) =>
                        setGpForm({ ...gpForm, customPassword: e.target.value })
                      }
                      className="bg-background/60 rounded-xl text-sm font-mono"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmittingGp}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all"
                  >
                    {isSubmittingGp ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Creating Operator Account...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4 mr-2" />
                        Create Gate Pass Operator Account
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Right Live Preview (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <EOProfilePreviewCard
                fullName={gpForm.fullName}
                username={gpForm.username}
                email={gpForm.email}
                phone={gpForm.phone}
                role="eo_gate_pass"
                linkedOrganizerName={selectedOrganizerName}
              />

              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <Shield className="h-3.5 w-3.5" /> Gate Pass Role Security Constraints
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground/90">
                  <li>Can log into the Inside Karachi mobile scanner & attendance list.</li>
                  <li><strong>Cannot</strong> access organizer revenue, payouts, or event management.</li>
                  <li>Scans are cryptographically signed and tagged with this operator's ID for audit reconciliation.</li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* SUCCESS TEMP PASSWORD MODAL */}
      <Dialog
        open={isPasswordDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsPasswordDialogOpen(false);
            setCreatedCredentials(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-2xl border-border/60">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 mb-2">
              <KeyRound className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold text-foreground">
              Account Created Successfully
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              Provide these initial login credentials securely to the user.
            </DialogDescription>
          </DialogHeader>

          {createdCredentials && (
            <div className="space-y-4 py-2">
              {/* Account details summary */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-semibold text-foreground">{createdCredentials.user.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-mono text-foreground">{createdCredentials.user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role:</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold">
                    {createdCredentials.user.role.replace("_", " ")}
                  </Badge>
                </div>
              </div>

              {/* Password Highlight Box */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Temporary Password (Auto-Copied)
                </Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-3 rounded-xl bg-background border border-primary/30 font-mono text-sm font-bold text-primary tracking-wider text-center select-all">
                    {createdCredentials.tempPassword}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 px-3 border-border/60 hover:bg-muted"
                    onClick={() => {
                      navigator.clipboard.writeText(createdCredentials.tempPassword);
                      toast({
                        title: "Copied!",
                        description: "Temporary password copied to clipboard",
                      });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground space-y-1 bg-amber-500/5 p-3 rounded-xl border border-amber-500/20">
                <p className="font-semibold text-amber-600 dark:text-amber-400">Security Warning:</p>
                <p>This password is only displayed once and will not be visible again after closing this dialog.</p>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (createdCredentials) {
                  const summary = `Inside Karachi Credentials:\nRole: ${createdCredentials.user.role}\nEmail: ${createdCredentials.user.email}\nPassword: ${createdCredentials.tempPassword}`;
                  navigator.clipboard.writeText(summary);
                  toast({
                    title: "Summary Copied",
                    description: "Full login details copied to clipboard",
                  });
                }
              }}
              className="text-xs"
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copy Full Credentials
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setIsPasswordDialogOpen(false);
                setCreatedCredentials(null);
              }}
              className="bg-primary text-primary-foreground font-semibold"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
