"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  RefreshCw,
  Save,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Phone,
  Globe,
  ImageIcon,
  FolderTree,
  Folder,
  Check,
} from "lucide-react";
import type {
  ListingCapacityCompleteness,
  ListingCapacityFields,
  ListingCapacityRow,
} from "@/types/listing.types";

type DraftFields = {
  min_price_per_person: string;
  max_price_per_person: string;
  min_guest_capacity: string;
  max_guest_capacity: string;
  category_ids: string[];
};

type CategoryOption = {
  value: string;
  label: string;
  slug?: string;
  parentId?: string | null;
  iconName?: string | null;
};

function toDraft(row: ListingCapacityRow): DraftFields {
  const ids =
    row.category_ids && row.category_ids.length > 0
      ? row.category_ids.map(String)
      : row.category_id == null
      ? []
      : [String(row.category_id)];

  return {
    min_price_per_person:
      row.min_price_per_person == null ? "" : String(row.min_price_per_person),
    max_price_per_person:
      row.max_price_per_person == null ? "" : String(row.max_price_per_person),
    min_guest_capacity:
      row.min_guest_capacity == null ? "" : String(row.min_guest_capacity),
    max_guest_capacity:
      row.max_guest_capacity == null ? "" : String(row.max_guest_capacity),
    category_ids: ids,
  };
}

function draftEqualsRow(draft: DraftFields, row: ListingCapacityRow): boolean {
  const original = toDraft(row);
  const draftIdsStr = [...draft.category_ids].sort().join(",");
  const origIdsStr = [...original.category_ids].sort().join(",");

  return (
    draft.min_price_per_person === original.min_price_per_person &&
    draft.max_price_per_person === original.max_price_per_person &&
    draft.min_guest_capacity === original.min_guest_capacity &&
    draft.max_guest_capacity === original.max_guest_capacity &&
    draftIdsStr === origIdsStr
  );
}

function parseDraftField(
  value: string,
  integer: boolean,
): number | null | { error: string } {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return { error: "Invalid number" };
  if (integer && !Number.isInteger(num)) {
    return { error: "Must be a whole number" };
  }
  return num;
}

/** Digits + optional single decimal point (prices). Strips letters and signs. */
function sanitizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("")}`;
}

/** Digits only (guest capacity). */
function sanitizeIntegerInput(value: string): string {
  return value.replace(/\D/g, "");
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "published":
      return "bg-green-500/10 text-green-700 border-green-500/20";
    case "draft":
      return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
    case "archived":
      return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    case "pending_approval":
      return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    case "rejected":
      return "bg-red-500/10 text-red-700 border-red-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function ListingCapacityPage() {
  const { toast } = useToast();
  const [listings, setListings] = React.useState<ListingCapacityRow[]>([]);
  const [drafts, setDrafts] = React.useState<Record<number, DraftFields>>({});
  const [savingIds, setSavingIds] = React.useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [completenessFilter, setCompletenessFilter] =
    React.useState<ListingCapacityCompleteness>("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [stats, setStats] = React.useState({
    total: 0,
    incomplete: 0,
    published: 0,
    draft: 0,
    archived: 0,
    all: 0,
  });
  const [categories, setCategories] = React.useState<CategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = React.useState(false);
  const [expandedIds, setExpandedIds] = React.useState<Set<number>>(new Set());
  const [expandedCategoryIds, setExpandedCategoryIds] = React.useState<Set<number>>(
    new Set()
  );

  const pageSize = 20;

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCategoryExpanded = (id: number) => {
    setExpandedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getCategoryPath = React.useCallback(
    (catId: string | null | undefined): string => {
      if (!catId) return "";
      const cat = categories.find((c) => c.value === catId);
      if (!cat) return "";
      if (cat.parentId) {
        const parent = categories.find((c) => c.value === cat.parentId);
        return parent ? `${parent.label} > ${cat.label}` : cat.label;
      }
      return cat.label;
    },
    [categories]
  );

  const getCategorySummary = React.useCallback(
    (catIds: string[]): string => {
      if (!catIds || catIds.length === 0) return "";
      if (catIds.length === 1) return getCategoryPath(catIds[0]);
      const firstPath = getCategoryPath(catIds[0]);
      return `${firstPath} (+${catIds.length - 1} more)`;
    },
    [getCategoryPath]
  );

  const toggleCategorySelection = (listingId: number, categoryIdStr: string) => {
    setDrafts((prev) => {
      const currentDraft =
        prev[listingId] || toDraft(listings.find((l) => l.id === listingId)!);
      const exists = currentDraft.category_ids.includes(categoryIdStr);
      const nextIds = exists
        ? currentDraft.category_ids.filter((id) => id !== categoryIdStr)
        : [...currentDraft.category_ids, categoryIdStr];

      return {
        ...prev,
        [listingId]: {
          ...currentDraft,
          category_ids: nextIds,
        },
      };
    });
  };

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  React.useEffect(() => {
    const fetchCategories = async () => {
      setCategoriesLoading(true);
      try {
        const response = await fetch("/api/categories");
        const result = await response.json();
        if (response.ok && result.categories) {
          setCategories(result.categories);
        }
      } catch (error) {
        console.error("Failed to load categories:", error);
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const fetchListings = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        completeness: completenessFilter,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category_id", categoryFilter);

      const response = await fetch(
        `/api/admin/listing-capacity?${params.toString()}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load listings");
      }

      const rows: ListingCapacityRow[] = data.listings || [];
      setListings(rows);
      setDrafts(
        Object.fromEntries(rows.map((row) => [row.id, toDraft(row)])),
      );
      setExpandedIds(new Set());
      setExpandedCategoryIds(new Set());
      setTotalPages(data.pagination?.totalPages || 1);
      setStats({
        total: data.stats?.total ?? data.pagination?.total ?? 0,
        incomplete: data.stats?.incomplete ?? 0,
        published: data.stats?.published ?? 0,
        draft: data.stats?.draft ?? 0,
        archived: data.stats?.archived ?? 0,
        all: data.stats?.all ?? 0,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to load listings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    currentPage,
    debouncedSearch,
    statusFilter,
    categoryFilter,
    completenessFilter,
    toast,
  ]);

  React.useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const updateDraft = (
    id: number,
    field: keyof ListingCapacityFields,
    value: string,
  ) => {
    const isPrice = field.includes("price");
    const sanitized = isPrice
      ? sanitizeDecimalInput(value)
      : sanitizeIntegerInput(value);

    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || toDraft(listings.find((l) => l.id === id)!)),
        [field]: sanitized,
      },
    }));
  };

  const handleSave = async (row: ListingCapacityRow) => {
    const draft = drafts[row.id];
    if (!draft) return;

    const minPrice = parseDraftField(draft.min_price_per_person, false);
    const maxPrice = parseDraftField(draft.max_price_per_person, false);
    const minCapacity = parseDraftField(draft.min_guest_capacity, true);
    const maxCapacity = parseDraftField(draft.max_guest_capacity, true);
    const categoryIdsNums = draft.category_ids
      .map((id) => parseInt(id, 10))
      .filter((n) => Number.isInteger(n) && n > 0);

    for (const parsed of [minPrice, maxPrice, minCapacity, maxCapacity]) {
      if (parsed && typeof parsed === "object" && "error" in parsed) {
        toast({
          title: "Invalid value",
          description: parsed.error,
          variant: "destructive",
        });
        return;
      }
    }

    const payload = {
      min_price_per_person: minPrice as number | null,
      max_price_per_person: maxPrice as number | null,
      min_guest_capacity: minCapacity as number | null,
      max_guest_capacity: maxCapacity as number | null,
      category_ids: categoryIdsNums,
    };

    if (
      payload.min_price_per_person != null &&
      payload.min_price_per_person < 0
    ) {
      toast({
        title: "Invalid value",
        description: "Prices cannot be negative",
        variant: "destructive",
      });
      return;
    }
    if (
      payload.max_price_per_person != null &&
      payload.max_price_per_person < 0
    ) {
      toast({
        title: "Invalid value",
        description: "Prices cannot be negative",
        variant: "destructive",
      });
      return;
    }
    if (
      payload.min_guest_capacity != null &&
      payload.min_guest_capacity < 1
    ) {
      toast({
        title: "Invalid value",
        description: "Guest capacity must be at least 1",
        variant: "destructive",
      });
      return;
    }
    if (
      payload.max_guest_capacity != null &&
      payload.max_guest_capacity < 1
    ) {
      toast({
        title: "Invalid value",
        description: "Guest capacity must be at least 1",
        variant: "destructive",
      });
      return;
    }
    if (
      payload.min_price_per_person != null &&
      payload.max_price_per_person != null &&
      payload.min_price_per_person > payload.max_price_per_person
    ) {
      toast({
        title: "Invalid value",
        description:
          "Minimum price per person cannot exceed maximum price per person",
        variant: "destructive",
      });
      return;
    }
    if (
      payload.min_guest_capacity != null &&
      payload.max_guest_capacity != null &&
      payload.min_guest_capacity > payload.max_guest_capacity
    ) {
      toast({
        title: "Invalid value",
        description:
          "Minimum guest capacity cannot exceed maximum guest capacity",
        variant: "destructive",
      });
      return;
    }

    setSavingIds((prev) => new Set(prev).add(row.id));
    try {
      const maxAttempts = 3;
      let response: Response | null = null;
      let data: { listing?: ListingCapacityRow; error?: string } = {};

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          response = await fetch(`/api/admin/listing-capacity/${row.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          data = await response.json().catch(() => ({}));

          // Don't retry client/validation errors
          if (response.ok || (response.status >= 400 && response.status < 500)) {
            break;
          }
        } catch (networkError) {
          if (attempt === maxAttempts) {
            throw networkError instanceof Error
              ? networkError
              : new Error("Network error while saving");
          }
        }

        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 400 * attempt));
        }
      }

      if (!response || !response.ok) {
        throw new Error(data.error || "Failed to save");
      }

      const updated = data.listing as ListingCapacityRow;
      setListings((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, ...updated } : item)),
      );
      setDrafts((prev) => ({
        ...prev,
        [row.id]: toDraft({ ...row, ...updated }),
      }));
      toast({
        title: "Saved",
        description: `Updated listing details for ${updated.name || row.name}`,
      });

      const wasComplete =
        row.min_price_per_person != null &&
        row.max_price_per_person != null &&
        row.min_guest_capacity != null &&
        row.max_guest_capacity != null;
      const isComplete =
        updated.min_price_per_person != null &&
        updated.max_price_per_person != null &&
        updated.min_guest_capacity != null &&
        updated.max_guest_capacity != null;
      if (wasComplete !== isComplete) {
        setStats((prev) => ({
          ...prev,
          incomplete: Math.max(
            0,
            prev.incomplete + (isComplete ? -1 : 1),
          ),
        }));
      }
    } catch (error) {
      toast({
        title: "Save failed",
        description:
          error instanceof Error ? error.message : "Could not save changes",
        variant: "destructive",
      });
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Published (total)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            {stats.published.toLocaleString()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Matching filters
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {stats.total.toLocaleString()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Incomplete (in filters)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            {stats.incomplete.toLocaleString()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Draft (total)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-semibold text-muted-foreground">
            {stats.draft.toLocaleString()}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-muted-foreground">
        Outing budget contracts need prices: prioritize{" "}
        <button
          type="button"
          className="font-medium text-foreground underline-offset-2 hover:underline"
          onClick={() => {
            const hit = categories.find((c) =>
              /fine.?dining/i.test(c.label + (c.slug ?? "")),
            );
            if (hit) {
              setCategoryFilter(hit.value);
              setCompletenessFilter("incomplete");
              setCurrentPage(1);
            }
          }}
        >
          Fine dining
        </button>
        {", "}
        <button
          type="button"
          className="font-medium text-foreground underline-offset-2 hover:underline"
          onClick={() => {
            const hit = categories.find((c) =>
              /entertainment|recreation/i.test(c.label + (c.slug ?? "")),
            );
            if (hit) {
              setCategoryFilter(hit.value);
              setCompletenessFilter("incomplete");
              setCurrentPage(1);
            }
          }}
        >
          Entertainment
        </button>
        {", and "}
        <button
          type="button"
          className="font-medium text-foreground underline-offset-2 hover:underline"
          onClick={() => {
            const hit = categories.find((c) =>
              /gaming|arcade/i.test(c.label + (c.slug ?? "")),
            );
            if (hit) {
              setCategoryFilter(hit.value);
              setCompletenessFilter("incomplete");
              setCurrentPage(1);
            }
          }}
        >
          Gaming / arcades
        </button>
        {" "}
        incomplete rows first.
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or address…"
            className="h-11 pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="h-11 w-full lg:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_approval">Pending approval</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={categoryFilter}
          onValueChange={(value) => {
            setCategoryFilter(value);
            setCurrentPage(1);
          }}
          disabled={categoriesLoading}
        >
          <SelectTrigger className="h-11 w-full lg:w-52">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.value} value={category.value}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={completenessFilter}
          onValueChange={(value) => {
            setCompletenessFilter(value as ListingCapacityCompleteness);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="h-11 w-full lg:w-44">
            <SelectValue placeholder="Completeness" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rows</SelectItem>
            <SelectItem value="incomplete">Incomplete</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="h-11"
          onClick={() => fetchListings()}
          disabled={isLoading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 px-2">
                  <span className="sr-only">Actions</span>
                </TableHead>
                <TableHead className="min-w-[180px]">Listing</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="min-w-[120px]">
                  Min price / person (PKR)
                </TableHead>
                <TableHead className="min-w-[120px]">
                  Max price / person (PKR)
                </TableHead>
                <TableHead className="min-w-[110px]">Min guest capacity</TableHead>
                <TableHead className="min-w-[110px]">Max guest capacity</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Loading listings…
                  </TableCell>
                </TableRow>
              ) : listings.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No listings match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                listings.map((row) => {
                  const draft = drafts[row.id] || toDraft(row);
                  const dirty = !draftEqualsRow(draft, row);
                  const saving = savingIds.has(row.id);
                  const expanded = expandedIds.has(row.id);
                  const expandedCategory = expandedCategoryIds.has(row.id);

                  return (
                    <React.Fragment key={row.id}>
                      <TableRow>
                        <TableCell className="px-2 pr-0">
                          <div className="flex items-center gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              aria-expanded={expanded}
                              aria-label={
                                expanded
                                  ? `Collapse details for ${row.name}`
                                  : `Expand details for ${row.name}`
                              }
                              title="Toggle listing details preview"
                              onClick={() => toggleExpanded(row.id)}
                            >
                              {expanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 transition-colors ${
                                expandedCategory
                                  ? "bg-primary/10 text-primary font-bold"
                                  : "text-muted-foreground hover:text-primary"
                              }`}
                              aria-expanded={expandedCategory}
                              aria-label={
                                expandedCategory
                                  ? `Collapse category selector for ${row.name}`
                                  : `Expand category selector for ${row.name}`
                              }
                              title="Choose categories & subcategories"
                              onClick={() => toggleCategoryExpanded(row.id)}
                            >
                              {expandedCategory ? (
                                <ChevronDown className="h-4 w-4 text-primary" />
                              ) : (
                                <FolderTree className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="text-left hover:underline"
                            onClick={() => toggleExpanded(row.id)}
                          >
                            <div className="font-medium">{row.name}</div>
                            {row.address ? (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {row.address}
                              </div>
                            ) : null}
                          </button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <button
                            type="button"
                            onClick={() => toggleCategoryExpanded(row.id)}
                            className="hover:underline hover:text-foreground text-left font-medium inline-flex items-center gap-1.5 group"
                            title="Click to open categories selector"
                          >
                            <span>
                              {getCategorySummary(draft.category_ids) ||
                                row.category_name ||
                                "—"}
                            </span>
                            <FolderTree className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusBadgeClass(row.status)}
                          >
                            {row.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0"
                            value={draft.min_price_per_person}
                            onChange={(e) =>
                              updateDraft(
                                row.id,
                                "min_price_per_person",
                                e.target.value,
                              )
                            }
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0"
                            value={draft.max_price_per_person}
                            onChange={(e) =>
                              updateDraft(
                                row.id,
                                "max_price_per_person",
                                e.target.value,
                              )
                            }
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="1"
                            value={draft.min_guest_capacity}
                            onChange={(e) =>
                              updateDraft(
                                row.id,
                                "min_guest_capacity",
                                e.target.value,
                              )
                            }
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="1"
                            value={draft.max_guest_capacity}
                            onChange={(e) =>
                              updateDraft(
                                row.id,
                                "max_guest_capacity",
                                e.target.value,
                              )
                            }
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            disabled={!dirty || saving}
                            onClick={() => handleSave(row)}
                          >
                            <Save className="h-3.5 w-3.5 mr-1" />
                            {saving ? "Saving…" : "Save"}
                          </Button>
                        </TableCell>
                      </TableRow>

                      {expandedCategory ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell
                            colSpan={9}
                            className="bg-muted/40 p-4 border-y border-border/60"
                          >
                            <div className="space-y-4">
                              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/40">
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                    <FolderTree className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-sm leading-none">
                                      Assign Categories & Subcategories
                                    </h4>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Click categories to select/deselect multiple for{" "}
                                      <span className="font-medium text-foreground">
                                        {row.name}
                                      </span>
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-muted-foreground">
                                    Selected ({draft.category_ids.length}):
                                  </span>
                                  {draft.category_ids.length === 0 ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-background font-medium py-1 px-2.5"
                                    >
                                      Unassigned
                                    </Badge>
                                  ) : (
                                    draft.category_ids.map((id) => (
                                      <Badge
                                        key={id}
                                        variant="secondary"
                                        className="bg-primary/10 text-primary border-primary/20 py-0.5 px-2 text-xs flex items-center gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-colors"
                                        onClick={() =>
                                          toggleCategorySelection(row.id, id)
                                        }
                                        title="Click to remove category"
                                      >
                                        <span>{getCategoryPath(id)}</span>
                                        <span className="text-xs font-bold">×</span>
                                      </Badge>
                                    ))
                                  )}
                                  {draftEqualsRow(draft, row) ? null : (
                                    <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 py-1">
                                      Unsaved changes
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                {categories
                                  .filter((c) => !c.parentId)
                                  .map((parent) => {
                                    const subcats = categories.filter(
                                      (c) => c.parentId === parent.value
                                    );
                                    const isParentSelected =
                                      draft.category_ids.includes(parent.value);

                                    return (
                                      <div
                                        key={parent.value}
                                        className={`rounded-xl border p-3 transition-all ${
                                          isParentSelected
                                            ? "border-primary bg-primary/5 shadow-xs"
                                            : "border-border/60 bg-card hover:border-border"
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleCategorySelection(
                                              row.id,
                                              parent.value
                                            )
                                          }
                                          className="w-full flex items-center justify-between font-semibold text-xs text-foreground text-left py-1 group"
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <Folder className="h-3.5 w-3.5 text-primary shrink-0 group-hover:scale-110 transition-transform" />
                                            <span className="truncate group-hover:text-primary transition-colors">
                                              {parent.label}
                                            </span>
                                          </div>
                                          {isParentSelected ? (
                                            <Check className="h-3.5 w-3.5 text-primary shrink-0 font-bold" />
                                          ) : null}
                                        </button>

                                        {subcats.length > 0 ? (
                                          <div className="mt-2 space-y-1 pl-2 border-l-2 border-primary/20">
                                            {subcats.map((sub) => {
                                              const isSubSelected =
                                                draft.category_ids.includes(sub.value);
                                              return (
                                                <button
                                                  key={sub.value}
                                                  type="button"
                                                  onClick={() =>
                                                    toggleCategorySelection(
                                                      row.id,
                                                      sub.value
                                                    )
                                                  }
                                                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-all flex items-center justify-between ${
                                                    isSubSelected
                                                      ? "bg-primary text-primary-foreground font-medium shadow-xs"
                                                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                                  }`}
                                                >
                                                  <span className="truncate">
                                                    {sub.label}
                                                  </span>
                                                  {isSubSelected ? (
                                                    <Check className="h-3 w-3 shrink-0 ml-1" />
                                                  ) : null}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}

                      {expanded ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={9} className="bg-muted/30 p-4">
                            <div className="flex flex-col gap-4 sm:flex-row">
                              <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl border border-border/50 bg-muted sm:h-44 sm:w-56">
                                {row.image_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={row.image_url}
                                    alt={
                                      row.image_alt ||
                                      `${row.name} listing photo`
                                    }
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                                    <ImageIcon className="h-8 w-8 opacity-50" />
                                    <span className="text-xs">No photo</span>
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 space-y-3">
                                <div>
                                  <h3 className="text-base font-semibold">
                                    {row.name}
                                  </h3>
                                  {row.category_name ? (
                                    <p className="text-sm text-muted-foreground">
                                      {row.category_name}
                                    </p>
                                  ) : null}
                                </div>
                                {row.description ? (
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                                    {row.description}
                                  </p>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">
                                    No description available.
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                                  {row.address ? (
                                    <span className="inline-flex items-start gap-1.5 text-muted-foreground">
                                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                      <span>{row.address}</span>
                                    </span>
                                  ) : null}
                                  {row.phone_number ? (
                                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                      <Phone className="h-3.5 w-3.5 shrink-0" />
                                      <span>{row.phone_number}</span>
                                    </span>
                                  ) : null}
                                  {row.website ? (
                                    <a
                                      href={row.website}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                                    >
                                      <Globe className="h-3.5 w-3.5 shrink-0" />
                                      <span className="truncate max-w-[220px]">
                                        {row.website}
                                      </span>
                                    </a>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
