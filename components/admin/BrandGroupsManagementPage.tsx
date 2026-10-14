"use client";

import * as React from "react";
import Link from "next/link";
import {
  Link2,
  Search,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Unlink,
  Store,
  MapPin,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  X,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { slugifyBrandName } from "@/lib/listings/brand-group-types";

type BrandGroupItem = {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  member_count: number;
  published_member_count: number;
};

type GroupMember = {
  listing_id: number;
  name: string;
  slug: string;
  status: string;
  address: string | null;
  sort_order: number;
  source: string;
  created_at: string;
};

type GroupDetail = {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  members: GroupMember[];
};

type SearchListing = {
  id: number;
  name: string;
  slug: string;
  status: string;
  address: string | null;
  current_group_id: number | null;
  current_group_name: string | null;
  current_group_slug: string | null;
};

export function BrandGroupsManagementPage() {
  const { toast } = useToast();

  // Left pane - Groups state
  const [groups, setGroups] = React.useState<BrandGroupItem[]>([]);
  const [totalGroups, setTotalGroups] = React.useState(0);
  const [groupSearch, setGroupSearch] = React.useState("");
  const [isLoadingGroups, setIsLoadingGroups] = React.useState(true);
  const [selectedGroupId, setSelectedGroupId] = React.useState<number | null>(null);

  // Right pane - Selected group detail state
  const [selectedGroup, setSelectedGroup] = React.useState<GroupDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);

  // Modals state
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [newGroupName, setNewGroupName] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);

  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
  const [renameGroupName, setRenameGroupName] = React.useState("");
  const [isRenaming, setIsRenaming] = React.useState(false);

  const [deleteGroupOpen, setDeleteGroupOpen] = React.useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = React.useState(false);

  // Listing search typeahead state
  const [listingSearchQuery, setListingSearchQuery] = React.useState("");
  const [listingSearchResults, setListingSearchResults] = React.useState<SearchListing[]>([]);
  const [isSearchingListings, setIsSearchingListings] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  // Move listing confirmation state
  const [listingToMove, setListingToMove] = React.useState<SearchListing | null>(null);
  const [isMovingListing, setIsMovingListing] = React.useState(false);

  // Unlink member confirmation state
  const [memberToUnlink, setMemberToUnlink] = React.useState<GroupMember | null>(null);
  const [isUnlinking, setIsUnlinking] = React.useState(false);

  // Fetch groups list
  const fetchGroups = React.useCallback(async (query = groupSearch) => {
    setIsLoadingGroups(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      params.set("limit", "100");

      const res = await fetch(`/api/admin/brand-groups?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load brand groups");
      }
      const data = await res.json();
      if (data.success) {
        setGroups(data.groups);
        setTotalGroups(data.total);

        // Auto-select first group if none selected or if selected was deleted
        if (data.groups.length > 0) {
          setSelectedGroupId((current) => {
            const exists = data.groups.some((g: BrandGroupItem) => g.id === current);
            return exists ? current : data.groups[0].id;
          });
        } else {
          setSelectedGroupId(null);
          setSelectedGroup(null);
        }
      }
    } catch (error) {
      console.error("Error loading brand groups:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load brand groups",
        variant: "destructive",
      });
    } finally {
      setIsLoadingGroups(false);
    }
  }, [groupSearch, toast]);

  // Load groups on initial mount
  React.useEffect(() => {
    void fetchGroups();
  }, [fetchGroups]);

  // Fetch selected group details
  const fetchGroupDetail = React.useCallback(async (id: number) => {
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/brand-groups/${id}`);
      if (!res.ok) {
        throw new Error("Failed to load brand group details");
      }
      const data = await res.json();
      if (data.success) {
        setSelectedGroup(data.group);
      }
    } catch (error) {
      console.error("Error loading group details:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load group details",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDetail(false);
    }
  }, [toast]);

  // Load details whenever selected group ID changes
  React.useEffect(() => {
    if (selectedGroupId !== null) {
      void fetchGroupDetail(selectedGroupId);
    } else {
      setSelectedGroup(null);
    }
  }, [selectedGroupId, fetchGroupDetail]);

  // Search listings with debounce
  React.useEffect(() => {
    if (!listingSearchQuery.trim()) {
      setListingSearchResults([]);
      setIsSearchingListings(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingListings(true);
      try {
        const res = await fetch(
          `/api/admin/brand-groups/search-listings?q=${encodeURIComponent(
            listingSearchQuery.trim(),
          )}&limit=15`,
        );
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        if (data.success) {
          setListingSearchResults(data.listings);
          setIsSearchOpen(true);
        }
      } catch (err) {
        console.error("Failed to search listings:", err);
      } finally {
        setIsSearchingListings(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [listingSearchQuery]);

  // Create brand group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/admin/brand-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create brand group");
      }

      toast({
        title: "Brand group created",
        description: `Group "${data.group.name}" is ready. Now link outlets to it.`,
      });

      setNewGroupName("");
      setCreateDialogOpen(false);
      await fetchGroups();
      setSelectedGroupId(data.group.id);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create group",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Rename brand group
  const handleRenameGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;
    const name = renameGroupName.trim();
    if (!name) return;

    setIsRenaming(true);
    try {
      const res = await fetch(`/api/admin/brand-groups/${selectedGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to rename brand group");
      }

      toast({
        title: "Brand group renamed",
        description: `Updated name to "${data.group.name}".`,
      });

      setRenameDialogOpen(false);
      await fetchGroups();
      await fetchGroupDetail(selectedGroup.id);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to rename group",
        variant: "destructive",
      });
    } finally {
      setIsRenaming(false);
    }
  };

  // Delete brand group
  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    setIsDeletingGroup(true);
    try {
      const res = await fetch(`/api/admin/brand-groups/${selectedGroup.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete brand group");
      }

      toast({
        title: "Brand group deleted",
        description: `Group "${selectedGroup.name}" deleted. Linked listings remain intact.`,
      });

      setDeleteGroupOpen(false);
      setSelectedGroupId(null);
      setSelectedGroup(null);
      await fetchGroups();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete group",
        variant: "destructive",
      });
    } finally {
      setIsDeletingGroup(false);
    }
  };

  // Attach a listing to the current group
  const handleAddListing = async (listingId: number) => {
    if (!selectedGroup) return;

    try {
      const res = await fetch(`/api/admin/brand-groups/${selectedGroup.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add listing");
      }

      toast({
        title: "Listing linked",
        description: "Listing linked to brand group successfully.",
      });

      setListingSearchQuery("");
      setListingSearchResults([]);
      setIsSearchOpen(false);
      setListingToMove(null);

      // Refresh group details and groups list counts
      await fetchGroupDetail(selectedGroup.id);
      await fetchGroups();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to link listing",
        variant: "destructive",
      });
    }
  };

  // Confirm move listing from another group
  const handleConfirmMoveListing = async () => {
    if (!listingToMove || !selectedGroup) return;
    setIsMovingListing(true);
    try {
      await handleAddListing(listingToMove.id);
    } finally {
      setIsMovingListing(false);
      setListingToMove(null);
    }
  };

  // Unlink member from group
  const handleUnlinkMember = async () => {
    if (!selectedGroup || !memberToUnlink) return;
    setIsUnlinking(true);
    try {
      const res = await fetch(
        `/api/admin/brand-groups/${selectedGroup.id}/members/${memberToUnlink.listing_id}`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to remove listing");
      }

      toast({
        title: "Listing unlinked",
        description: `"${memberToUnlink.name}" was removed from "${selectedGroup.name}".`,
      });

      setMemberToUnlink(null);
      await fetchGroupDetail(selectedGroup.id);
      await fetchGroups();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove listing",
        variant: "destructive",
      });
    } finally {
      setIsUnlinking(false);
    }
  };

  // Render listing status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge variant="success">Published</Badge>;
      case "draft":
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
            Draft
          </Badge>
        );
      case "archived":
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const publishedCount =
    selectedGroup?.members.filter((m) => m.status === "published").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">Manual Brand Linking</h2>
            <Badge variant="outline" className="text-xs font-mono">
              sibling_locations
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Group multi-outlet branches under one brand header so users see the Other Locations switcher.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchGroups()}
            disabled={isLoadingGroups}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoadingGroups ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setNewGroupName("");
              setCreateDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Brand Group
          </Button>
        </div>
      </div>

      {/* Main Two-Pane Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Pane: Groups List (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Brand Groups
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {totalGroups} {totalGroups === 1 ? "group" : "groups"}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Select a group to manage member outlets
              </CardDescription>

              {/* Group Search Input */}
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search groups or slug..."
                  value={groupSearch}
                  onChange={(e) => {
                    setGroupSearch(e.target.value);
                    void fetchGroups(e.target.value);
                  }}
                  className="pl-8 text-sm h-9"
                />
                {groupSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setGroupSearch("");
                      void fetchGroups("");
                    }}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-2 pt-0">
              {isLoadingGroups ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
                  Loading brand groups...
                </div>
              ) : groups.length === 0 ? (
                <div className="py-10 text-center px-4">
                  <Store className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">No brand groups found</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">
                    {groupSearch ? `No matches for "${groupSearch}"` : "Create your first brand group to get started"}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNewGroupName(groupSearch.trim());
                      setCreateDialogOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Create &quot;{groupSearch.trim() || "New Group"}&quot;
                  </Button>
                </div>
              ) : (
                <div className="space-y-1 max-h-[620px] overflow-y-auto pr-1">
                  {groups.map((group) => {
                    const isSelected = group.id === selectedGroupId;
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setSelectedGroupId(group.id)}
                        className={`w-full text-left p-3 rounded-lg transition-all flex items-center justify-between border ${
                          isSelected
                            ? "bg-primary/10 border-primary text-primary font-medium shadow-sm"
                            : "hover:bg-muted/60 border-transparent text-foreground"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                            <span>{group.name}</span>
                            {isSelected && (
                              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono truncate">
                            /{group.slug}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge
                            variant={group.member_count > 0 ? "secondary" : "outline"}
                            className="text-xs font-normal"
                          >
                            {group.member_count} {group.member_count === 1 ? "outlet" : "outlets"}
                          </Badge>
                          {group.published_member_count >= 2 && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Active picker
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Pane: Selected Group Details & Member Management (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-6">
          {!selectedGroup && !isLoadingDetail ? (
            <Card className="shadow-sm border-dashed">
              <CardContent className="py-20 text-center flex flex-col items-center justify-center">
                <div className="p-4 bg-muted rounded-full mb-3">
                  <Link2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No Brand Group Selected</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                  Select a brand group from the list on the left to view and link its member locations,
                  or create a new brand group to link separate outlets together.
                </p>
                <Button
                  onClick={() => {
                    setNewGroupName("");
                    setCreateDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create Brand Group
                </Button>
              </CardContent>
            </Card>
          ) : isLoadingDetail ? (
            <Card className="shadow-sm">
              <CardContent className="py-20 text-center text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
                Loading brand group details...
              </CardContent>
            </Card>
          ) : selectedGroup ? (
            <div className="space-y-6">
              {/* Group Header Card */}
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-2xl font-bold tracking-tight">
                          {selectedGroup.name}
                        </h2>
                        <Badge variant="outline" className="font-mono text-xs">
                          slug: {selectedGroup.slug}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Group ID #{selectedGroup.id} &bull; Created:{" "}
                        {new Date(selectedGroup.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRenameGroupName(selectedGroup.name);
                          setRenameDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Rename
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                        onClick={() => setDeleteGroupOpen(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* Sibling Picker Status Alert */}
                  <div className="mt-4">
                    {publishedCount >= 2 ? (
                      <Alert className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <AlertTitle className="text-sm font-semibold">
                          Sibling Switcher Active ({publishedCount} published outlets)
                        </AlertTitle>
                        <AlertDescription className="text-xs mt-0.5 text-emerald-800 dark:text-emerald-300">
                          Detail pages for these published listings automatically display the
                          &quot;Other locations&quot; picker so customers can switch between outlets.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900 text-amber-900 dark:text-amber-200">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <AlertTitle className="text-sm font-semibold">
                          Requires 2+ Published Outlets ({publishedCount} published currently)
                        </AlertTitle>
                        <AlertDescription className="text-xs mt-0.5 text-amber-800 dark:text-amber-300">
                          The public sibling switcher will appear on listing detail once at least 2
                          members are published. Search and link more outlets below.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardHeader>

                {/* Add Listing Search Section */}
                <CardContent className="pt-0 pb-6 border-t">
                  <div className="space-y-3 pt-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold flex items-center gap-1.5">
                        <Plus className="h-4 w-4 text-primary" />
                        Add Listing to &quot;{selectedGroup.name}&quot;
                      </label>
                      <span className="text-xs text-muted-foreground">
                        Search by name or street address
                      </span>
                    </div>

                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Type listing name (e.g. KFC Boat Basin, Xanders Clifton)..."
                          value={listingSearchQuery}
                          onChange={(e) => {
                            setListingSearchQuery(e.target.value);
                            setIsSearchOpen(true);
                          }}
                          onFocus={() => {
                            if (listingSearchResults.length > 0) setIsSearchOpen(true);
                          }}
                          className="pl-9 pr-9"
                        />
                        {listingSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setListingSearchQuery("");
                              setListingSearchResults([]);
                              setIsSearchOpen(false);
                            }}
                            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Dropdown Typeahead Results */}
                      {isSearchOpen && listingSearchQuery.trim() && (
                        <div className="absolute z-20 top-full left-0 right-0 mt-1.5 bg-popover border rounded-lg shadow-xl overflow-hidden max-h-80 overflow-y-auto">
                          {isSearchingListings ? (
                            <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                              Searching listings...
                            </div>
                          ) : listingSearchResults.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              No listings found matching &quot;{listingSearchQuery}&quot;
                            </div>
                          ) : (
                            <div className="divide-y divide-border/60">
                              {listingSearchResults.map((listing) => {
                                const isAlreadyInThisGroup =
                                  listing.current_group_id === selectedGroup.id;
                                const isInAnotherGroup =
                                  listing.current_group_id !== null &&
                                  listing.current_group_id !== selectedGroup.id;

                                return (
                                  <div
                                    key={listing.id}
                                    className="p-3 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-sm">
                                          {listing.name}
                                        </span>
                                        {renderStatusBadge(listing.status)}
                                        {isAlreadyInThisGroup ? (
                                          <Badge variant="secondary" className="text-[10px]">
                                            Already in this group
                                          </Badge>
                                        ) : isInAnotherGroup ? (
                                          <Badge
                                            variant="outline"
                                            className="text-[10px] border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30"
                                          >
                                            In group: {listing.current_group_name}
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                            Unlinked
                                          </Badge>
                                        )}
                                      </div>

                                      {listing.address && (
                                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1 truncate">
                                          <MapPin className="h-3 w-3 shrink-0" />
                                          <span className="truncate">{listing.address}</span>
                                        </div>
                                      )}
                                    </div>

                                    <div className="shrink-0">
                                      {isAlreadyInThisGroup ? (
                                        <Button size="sm" variant="ghost" disabled className="text-xs h-8">
                                          Added
                                        </Button>
                                      ) : isInAnotherGroup ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-xs h-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-300"
                                          onClick={() => setListingToMove(listing)}
                                        >
                                          Move Here
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          className="text-xs h-8"
                                          onClick={() => void handleAddListing(listing.id)}
                                        >
                                          <Plus className="h-3.5 w-3.5 mr-1" />
                                          Add
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Members Table Card */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Store className="h-4 w-4 text-primary" />
                        Linked Locations ({selectedGroup.members.length})
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        All outlets linked under {selectedGroup.name}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {selectedGroup.members.length === 0 ? (
                    <div className="py-16 text-center px-4">
                      <div className="p-3 bg-muted rounded-full w-fit mx-auto mb-3">
                        <Unlink className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <h4 className="text-sm font-semibold mb-1">No Members Yet</h4>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
                        Search for a listing above and click &quot;Add&quot; to link sibling outlets to this brand group.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="w-[30%]">Listing / Outlet</TableHead>
                            <TableHead className="w-[12%]">Status</TableHead>
                            <TableHead className="w-[38%]">Address</TableHead>
                            <TableHead className="w-[10%]">Source</TableHead>
                            <TableHead className="w-[10%] text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedGroup.members.map((member) => (
                            <TableRow key={member.listing_id} className="hover:bg-muted/30">
                              {/* Listing Name & Link */}
                              <TableCell className="font-medium">
                                <div className="space-y-0.5">
                                  <Link
                                    href={`/listing/${member.slug}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold text-primary hover:underline inline-flex items-center gap-1.5"
                                  >
                                    <span>{member.name}</span>
                                    <ExternalLink className="h-3.5 w-3.5 opacity-60 shrink-0" />
                                  </Link>
                                  <div className="text-[11px] font-mono text-muted-foreground">
                                    ID: {member.listing_id} &bull; /{member.slug}
                                  </div>
                                </div>
                              </TableCell>

                              {/* Status */}
                              <TableCell>{renderStatusBadge(member.status)}</TableCell>

                              {/* Address */}
                              <TableCell>
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                  {member.address || (
                                    <span className="italic opacity-60">No street address</span>
                                  )}
                                </div>
                              </TableCell>

                              {/* Source */}
                              <TableCell>
                                <Badge variant="outline" className="text-[11px] capitalize">
                                  {member.source.replace(/_/g, " ")}
                                </Badge>
                              </TableCell>

                              {/* Actions */}
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setMemberToUnlink(member)}
                                >
                                  <Unlink className="h-3.5 w-3.5 mr-1" />
                                  Unlink
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </div>

      {/* DIALOG 1: Create Brand Group */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateGroup}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Create Brand Group
              </DialogTitle>
              <DialogDescription className="text-xs">
                Group multiple outlets of the same brand together (e.g. &quot;KFC&quot;, &quot;Xander&apos;s&quot;, &quot;Espresso&quot;).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Brand Display Name</label>
                <Input
                  placeholder="e.g. KFC, Xander's, Broadway Pizza"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              {newGroupName.trim() && (
                <div className="p-3 bg-muted/60 rounded-md text-xs space-y-1">
                  <span className="text-muted-foreground">Generated URL slug:</span>
                  <div className="font-mono font-semibold text-primary">
                    {slugifyBrandName(newGroupName)}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || !newGroupName.trim()}>
                {isCreating ? "Creating..." : "Create Group"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: Rename Brand Group */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleRenameGroup}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-primary" />
                Rename Brand Group
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update the brand group name for &quot;{selectedGroup?.name}&quot;.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Brand Name</label>
                <Input
                  value={renameGroupName}
                  onChange={(e) => setRenameGroupName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              {renameGroupName.trim() && (
                <div className="p-3 bg-muted/60 rounded-md text-xs space-y-1">
                  <span className="text-muted-foreground">Updated slug will be:</span>
                  <div className="font-mono font-semibold text-primary">
                    {slugifyBrandName(renameGroupName)}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameDialogOpen(false)}
                disabled={isRenaming}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isRenaming || !renameGroupName.trim()}>
                {isRenaming ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG 3: Move Listing Confirmation */}
      <AlertDialog
        open={Boolean(listingToMove)}
        onOpenChange={(open) => !open && setListingToMove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              Move Listing to This Group?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              <span className="font-semibold text-foreground">{listingToMove?.name}</span> is
              currently linked to brand group{" "}
              <span className="font-semibold text-foreground">
                &quot;{listingToMove?.current_group_name}&quot;
              </span>
              .
              <br />
              <br />
              Moving it will detach it from{" "}
              <span className="italic font-medium">{listingToMove?.current_group_name}</span> and
              attach it to <span className="font-semibold text-primary">{selectedGroup?.name}</span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMovingListing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmMoveListing();
              }}
              disabled={isMovingListing}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isMovingListing ? "Moving..." : "Move Listing"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ALERT DIALOG 4: Unlink Member Confirmation */}
      <AlertDialog
        open={Boolean(memberToUnlink)}
        onOpenChange={(open) => !open && setMemberToUnlink(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Unlink className="h-5 w-5" />
              Unlink Listing from Group?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to remove{" "}
              <span className="font-semibold text-foreground">{memberToUnlink?.name}</span> from
              brand group &quot;{selectedGroup?.name}&quot;?
              <br />
              <br />
              The listing itself will remain intact on the platform, but it will no longer appear as
              a sibling outlet under {selectedGroup?.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnlinking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleUnlinkMember();
              }}
              disabled={isUnlinking}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isUnlinking ? "Unlinking..." : "Unlink Outlet"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ALERT DIALOG 5: Delete Group Confirmation */}
      <AlertDialog open={deleteGroupOpen} onOpenChange={setDeleteGroupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Brand Group &quot;{selectedGroup?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This will remove the brand group record and unlink all{" "}
              <span className="font-semibold text-foreground">
                {selectedGroup?.members.length ?? 0}
              </span>{" "}
              member locations.
              <br />
              <br />
              <span className="text-xs text-muted-foreground">
                Note: Member listings will NOT be deleted; they will simply become unlinked.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingGroup}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteGroup();
              }}
              disabled={isDeletingGroup}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeletingGroup ? "Deleting..." : "Delete Group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
