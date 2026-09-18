"use client";

import { useMemo, useState } from "react";
import {
  parseGoogleMapsLink,
  isLikelyGoogleMapsHost,
} from "@/lib/utils/google-maps";
import type {
  ListingFormData,
  CustomAttributes,
  Listing,
  BranchWithHours,
} from "@/types/listing.types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { OwnerSelect } from "../OwnerSelect";
import {
  Tag,
  Star,
  Clock,
  Facebook,
  Instagram,
  MessageCircle,
  Youtube,
  MapPin,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface Category {
  value: string;
  label: string;
  slug: string;
  parentId: string | null;
  iconName: string | null;
}

interface DetailsTabProps {
  formData: ListingFormData;
  onInputChange: (
    field: string,
    value: string | boolean | number | CustomAttributes | string[] | null,
  ) => void;
  categories: Category[];
  categoriesLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  listing?: Listing | null;
  branches?: BranchWithHours[];
  hideAdminFields?: boolean;
}

export function DetailsTab({
  formData,
  onInputChange,
  categories,
  categoriesLoading,
  onSubmit,
  listing,
  branches,
  hideAdminFields = false,
}: DetailsTabProps) {
  const [urlErrors, setUrlErrors] = useState<Record<string, string>>({});
  const [categorySearch, setCategorySearch] = useState("");

  // Group subcategories under their main categories
  const categoryGroups = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();

    // 1. Separate top-level / parent categories (parentId is null or empty)
    const parents = categories.filter((c) => !c.parentId);

    // 2. Build groups
    const groups: Array<{
      parent: Category;
      subcategories: Category[];
    }> = [];

    const processedSubIds = new Set<string>();

    for (const parent of parents) {
      const subs = categories.filter((c) => c.parentId === parent.value);
      subs.forEach((s) => processedSubIds.add(s.value));

      const matchingSubs = query
        ? subs.filter((s) => s.label.toLowerCase().includes(query))
        : subs;

      const parentMatches = query
        ? parent.label.toLowerCase().includes(query)
        : false;

      // Include if no query, or if parent matches (show all subs), or if any subs match
      if (!query || parentMatches || matchingSubs.length > 0) {
        groups.push({
          parent,
          subcategories:
            parentMatches && !matchingSubs.length ? subs : matchingSubs,
        });
      }
    }

    // 3. Catch any orphan subcategories whose parent wasn't in parents list
    const orphans = categories.filter(
      (c) => c.parentId && !processedSubIds.has(c.value)
    );
    if (orphans.length > 0) {
      const matchingOrphans = query
        ? orphans.filter((o) => o.label.toLowerCase().includes(query))
        : orphans;
      if (matchingOrphans.length > 0) {
        groups.push({
          parent: {
            value: "other",
            label: "Other Categories",
            slug: "other",
            parentId: null,
            iconName: null,
          },
          subcategories: matchingOrphans,
        });
      }
    }

    return groups;
  }, [categories, categorySearch]);

  // Check if location should be managed by primary branch
  const hasPrimaryBranch = branches?.some((b) => b.is_primary);
  const primaryBranch = branches?.find((b) => b.is_primary);

  const selectedCategoryIds = formData.category_ids?.length
    ? formData.category_ids
    : formData.category_id
      ? [formData.category_id]
      : [];

  const toggleCategory = (categoryValue: string, checked: boolean) => {
    let next = checked
      ? [...selectedCategoryIds, categoryValue]
      : selectedCategoryIds.filter((id) => id !== categoryValue);
    next = [...new Set(next)];

    let primary = formData.category_id;
    if (checked && !primary) {
      primary = categoryValue;
    }
    if (!checked && primary === categoryValue) {
      primary = next[0] || "";
    }
    if (primary && !next.includes(primary) && next.length > 0) {
      primary = next[0];
    }

    onInputChange("category_ids", next);
    onInputChange("category_id", primary);
  };

  const setPrimaryCategory = (categoryValue: string) => {
    if (!selectedCategoryIds.includes(categoryValue)) return;
    const rest = selectedCategoryIds.filter((id) => id !== categoryValue);
    onInputChange("category_ids", [categoryValue, ...rest]);
    onInputChange("category_id", categoryValue);
  };

  const validateUrl = (url: string, fieldName: string) => {
    if (!url.trim()) {
      setUrlErrors((prev) => ({ ...prev, [fieldName]: "" }));
      return true;
    }
    try {
      const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);

      // Strict domain validation - exact matches only
      const validDomains = {
        facebook_url: ["facebook.com", "www.facebook.com"],
        instagram_url: ["instagram.com", "www.instagram.com"],
        youtube_url: ["youtube.com", "www.youtube.com", "youtu.be"],
        // Accept broader maps domains and short links
        google_maps_url: [
          "maps.google.com",
          "www.google.com",
          "google.com",
          "www.google.com.pk",
          "google.com.pk",
          "maps.app.goo.gl",
          "goo.gl",
          "g.page",
          "g.co",
        ],
      };

      const allowedDomains =
        validDomains[fieldName as keyof typeof validDomains] || [];

      // Allow if hostname matches our list or looks like a google maps host
      if (
        !allowedDomains.includes(urlObj.hostname) &&
        !isLikelyGoogleMapsHost(urlObj.hostname)
      ) {
        const platformName = fieldName
          .replace("_url", "")
          .replace("_number", "");
        setUrlErrors((prev) => ({
          ...prev,
          [fieldName]: `Please enter a valid ${platformName} URL`,
        }));
        return false;
      }

      setUrlErrors((prev) => ({ ...prev, [fieldName]: "" }));
      return true;
    } catch {
      setUrlErrors((prev) => ({
        ...prev,
        [fieldName]: "Please enter a valid URL",
      }));
      return false;
    }
  };

  const handleUrlChange = (field: string, value: string) => {
    onInputChange(field, value);
    const ok = validateUrl(value, field);
    if (field === "google_maps_url" && ok) {
      try {
        const parsed = parseGoogleMapsLink(value);
        // Auto-fill lat/lng when present
        if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
          if (formData.latitude !== String(parsed.lat)) {
            onInputChange("latitude", String(parsed.lat));
          }
          if (formData.longitude !== String(parsed.lng)) {
            onInputChange("longitude", String(parsed.lng));
          }
          // Resolve a human-readable address via our OSM-based endpoint (English)
          {
            const qs = new URLSearchParams({
              lat: String(parsed.lat),
              lng: String(parsed.lng),
            });
            if (parsed.label) qs.set("label", parsed.label);
            fetch(`/api/location?${qs.toString()}`)
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                const candidate = data?.formattedAddress || data?.fullAddress;
                if (
                  candidate &&
                  (!formData.address || formData.address.trim() === "")
                ) {
                  onInputChange("address", candidate as string);
                }
              })
              .catch(() => {});
          }
        }
        // If no coordinates but we do have a label, use it as address if empty
        if (
          (parsed.lat === undefined || parsed.lng === undefined) &&
          parsed.label &&
          (!formData.address || formData.address.trim() === "")
        ) {
          onInputChange("address", parsed.label);
        }
        // Optionally normalize the URL for storage/display
        if (parsed.normalizedUrl && parsed.normalizedUrl !== value) {
          onInputChange("google_maps_url", parsed.normalizedUrl);
        }
      } catch {
        // ignore parsing issues; validation already passed
      }
    }
  };
  return (
    <TabsContent value="details" className="space-y-8">
      <form onSubmit={onSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-medium">Basic Information</h3>
          </div>
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="name">Listing Name</Label>
                <span className="text-destructive text-sm">*</span>
              </div>
              <Input
                id="name"
                name="name"
                autoComplete="organization"
                value={formData.name}
                onChange={(e) => onInputChange("name", e.target.value)}
                placeholder="Enter a compelling listing name"
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                autoComplete="off"
                value={formData.description}
                onChange={(e) => onInputChange("description", e.target.value)}
                placeholder="Describe your business, services, and highlights..."
                rows={4}
                className="min-h-[100px] resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parking_information">Parking Information</Label>
              <Textarea
                id="parking_information"
                name="parking_information"
                autoComplete="off"
                value={formData.parking_information || ""}
                onChange={(e) =>
                  onInputChange("parking_information", e.target.value)
                }
                placeholder="e.g., Free parking available on-site. Valet parking offered. First 2 hours free..."
                rows={3}
                className="min-h-[75px] resize-y"
              />
              <p className="text-xs text-muted-foreground">
                Main parking description that will appear on the listing page
              </p>
            </div>
            <div className="space-y-3">
              <Label>Parking Amenities (Select features that apply)</Label>
              <div className="space-y-2 p-3 rounded-lg bg-secondary/30 border border-border/50">
                {(
                  [
                    "Free Parking",
                    "Wheelchair Accessible",
                    "Security",
                    "Valet Parking",
                    "24-Hour Access",
                    "Covered Parking",
                  ] as const
                ).map((amenity) => {
                  const amenitiesList = Array.isArray(formData.parking_amenities)
                    ? formData.parking_amenities
                    : [];
                  const isChecked = amenitiesList.includes(amenity);

                  return (
                    <div key={amenity} className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id={`amenity-${amenity}`}
                        checked={isChecked}
                        onChange={(e) => {
                          const currentAmenities = Array.isArray(
                            formData.parking_amenities
                          )
                            ? formData.parking_amenities
                            : [];
                          const newAmenities = e.target.checked
                            ? [...currentAmenities, amenity]
                            : currentAmenities.filter((a) => a !== amenity);
                          onInputChange(
                            "parking_amenities",
                            newAmenities.length > 0 ? newAmenities : null,
                          );
                        }}
                        className="h-4 w-4 rounded border-border bg-background cursor-pointer"
                      />
                      <Label
                        htmlFor={`amenity-${amenity}`}
                        className="cursor-pointer flex-1 text-sm font-normal"
                      >
                        {amenity}
                      </Label>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                These will appear as badges below the parking description
              </p>
            </div>
            {!hideAdminFields && (
              <div className="space-y-2">
                <OwnerSelect
                  selectedOwnerId={formData.owner_id}
                  onOwnerSelect={(ownerId) =>
                    onInputChange("owner_id", ownerId)
                  }
                  listingId={listing?.id ? String(listing.id) : ""}
                />
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label>Categories</Label>
                <span className="text-destructive text-sm">*</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Select one or more subcategories under each main category. The primary category is used
                for display cards and legacy fields.
              </p>

              {categories.length > 6 && (
                <Input
                  type="text"
                  placeholder="Filter categories or subcategories..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="h-8 text-xs"
                />
              )}

              <div className="max-h-64 overflow-y-auto rounded-md border p-3 space-y-4 bg-background">
                {categoriesLoading && (
                  <p className="text-sm text-muted-foreground">
                    Loading categories...
                  </p>
                )}
                {!categoriesLoading && categoryGroups.length === 0 && (
                  <p className="text-xs text-muted-foreground italic py-2">
                    No matching categories found.
                  </p>
                )}
                {!categoriesLoading &&
                  categoryGroups.map(({ parent, subcategories }) => (
                    <div key={parent.value} className="space-y-2">
                      {/* Main Category Header */}
                      <div className="flex items-center justify-between pb-1 border-b border-border/60">
                        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                          {parent.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {subcategories.length}{" "}
                          {subcategories.length === 1
                            ? "subcategory"
                            : "subcategories"}
                        </span>
                      </div>

                      {/* Subcategories list */}
                      <div className="pl-2 space-y-1.5">
                        {subcategories.length === 0 ? (
                          <div className="flex items-center justify-between gap-2 py-0.5">
                            <label className="flex items-center gap-2 text-sm cursor-pointer flex-1 min-w-0">
                              <Checkbox
                                checked={selectedCategoryIds.includes(
                                  parent.value
                                )}
                                onCheckedChange={(value) =>
                                  toggleCategory(parent.value, value === true)
                                }
                              />
                              <span className="text-sm">{parent.label}</span>
                            </label>
                            {selectedCategoryIds.includes(parent.value) && (
                              <button
                                type="button"
                                className="shrink-0"
                                onClick={() => setPrimaryCategory(parent.value)}
                              >
                                <Badge
                                  variant={
                                    formData.category_id === parent.value
                                      ? "default"
                                      : "outline"
                                  }
                                  className="text-[10px]"
                                >
                                  {formData.category_id === parent.value
                                    ? "Primary"
                                    : "Make primary"}
                                </Badge>
                              </button>
                            )}
                          </div>
                        ) : (
                          subcategories.map((subcategory) => {
                            const checked = selectedCategoryIds.includes(
                              subcategory.value
                            );
                            const isPrimary =
                              formData.category_id === subcategory.value;
                            return (
                              <div
                                key={subcategory.value}
                                className="flex items-center justify-between gap-2 py-0.5 hover:bg-muted/40 px-1 rounded transition-colors"
                              >
                                <label className="flex items-center gap-2 text-sm cursor-pointer flex-1 min-w-0">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(value) =>
                                      toggleCategory(
                                        subcategory.value,
                                        value === true
                                      )
                                    }
                                  />
                                  <span className="truncate text-sm">
                                    {subcategory.label}
                                  </span>
                                </label>
                                {checked && (
                                  <button
                                    type="button"
                                    className="shrink-0"
                                    onClick={() =>
                                      setPrimaryCategory(subcategory.value)
                                    }
                                  >
                                    <Badge
                                      variant={
                                        isPrimary ? "default" : "outline"
                                      }
                                      className="text-[10px]"
                                    >
                                      {isPrimary ? "Primary" : "Make primary"}
                                    </Badge>
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
              </div>
              {selectedCategoryIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedCategoryIds.length} selected
                  {formData.category_id
                    ? ` · primary: ${
                        categories.find(
                          (c) => c.value === formData.category_id
                        )?.label || `#${formData.category_id}`
                      }`
                    : ""}
                </p>
              )}
              <Input
                id="custom_category"
                name="custom_category"
                autoComplete="off"
                value={formData.custom_category}
                onChange={(e) =>
                  onInputChange("custom_category", e.target.value)
                }
                placeholder="Or enter custom category"
                className="h-11"
              />
            </div>
          </div>
        </div>
        <Separator />

        {/* Contact Information */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-medium">Contact Information</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone</Label>
              <Input
                id="phone_number"
                name="phone_number"
                autoComplete="tel"
                value={formData.phone_number}
                onChange={(e) => onInputChange("phone_number", e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                autoComplete="email"
                value={formData.email}
                onChange={(e) => onInputChange("email", e.target.value)}
                placeholder="contact@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                autoComplete="url"
                value={formData.website}
                onChange={(e) => onInputChange("website", e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
        </div>
        <Separator />

        {/* Social Links */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-medium">Social Links</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Facebook className="h-4 w-4 text-blue-600" />
                <Label htmlFor="facebook_url">Facebook</Label>
              </div>
              <Input
                id="facebook_url"
                name="facebook_url"
                autoComplete="username"
                value={formData.facebook_url}
                onChange={(e) =>
                  handleUrlChange("facebook_url", e.target.value)
                }
                placeholder="yourpage or https://facebook.com/yourpage"
                className={urlErrors.facebook_url ? "border-red-500" : ""}
              />
              {urlErrors.facebook_url && (
                <p className="text-sm text-red-500">{urlErrors.facebook_url}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Instagram className="h-4 w-4 text-pink-600" />
                <Label htmlFor="instagram_url">Instagram</Label>
              </div>
              <Input
                id="instagram_url"
                name="instagram_url"
                autoComplete="username"
                value={formData.instagram_url}
                onChange={(e) =>
                  handleUrlChange("instagram_url", e.target.value)
                }
                placeholder="yourhandle or https://instagram.com/yourhandle"
                className={urlErrors.instagram_url ? "border-red-500" : ""}
              />
              {urlErrors.instagram_url && (
                <p className="text-sm text-red-500">
                  {urlErrors.instagram_url}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-600" />
                <Label htmlFor="whatsapp_number">WhatsApp</Label>
              </div>
              <Input
                id="whatsapp_number"
                name="whatsapp_number"
                autoComplete="tel"
                value={formData.whatsapp_number}
                onChange={(e) =>
                  onInputChange("whatsapp_number", e.target.value)
                }
                placeholder="+923001234567"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Youtube className="h-4 w-4 text-red-600" />
                <Label htmlFor="youtube_url">YouTube</Label>
              </div>
              <Input
                id="youtube_url"
                name="youtube_url"
                autoComplete="username"
                value={formData.youtube_url}
                onChange={(e) => handleUrlChange("youtube_url", e.target.value)}
                placeholder="yourchannel or https://youtube.com/yourchannel"
                className={urlErrors.youtube_url ? "border-red-500" : ""}
              />
              {urlErrors.youtube_url && (
                <p className="text-sm text-red-500">{urlErrors.youtube_url}</p>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-red-500" />
                <Label htmlFor="google_maps_url">Google Maps</Label>
              </div>
              <Input
                id="google_maps_url"
                name="google_maps_url"
                autoComplete="off"
                value={formData.google_maps_url}
                onChange={(e) =>
                  handleUrlChange("google_maps_url", e.target.value)
                }
                placeholder="https://maps.google.com/?q=your+location"
                className={urlErrors.google_maps_url ? "border-red-500" : ""}
              />
              {urlErrors.google_maps_url && (
                <p className="text-sm text-red-500">
                  {urlErrors.google_maps_url}
                </p>
              )}
            </div>
          </div>
        </div>
        <Separator />

        {/* Location Information */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-medium">Location</h3>
            {hasPrimaryBranch && (
              <div className="ml-auto flex items-center gap-2 bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>Managed by Primary Branch</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                autoComplete="street-address"
                value={formData.address}
                onChange={(e) => onInputChange("address", e.target.value)}
                placeholder="Enter full address"
                disabled={!!hasPrimaryBranch}
                className={
                  hasPrimaryBranch ? "bg-muted text-muted-foreground" : ""
                }
              />
              {hasPrimaryBranch && primaryBranch && (
                <p className="text-xs text-muted-foreground">
                  Synced with: {primaryBranch.name}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                name="latitude"
                autoComplete="off"
                value={formData.latitude}
                onChange={(e) => onInputChange("latitude", e.target.value)}
                placeholder="24.8607"
                disabled={!!hasPrimaryBranch}
                className={
                  hasPrimaryBranch ? "bg-muted text-muted-foreground" : ""
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                name="longitude"
                autoComplete="off"
                value={formData.longitude}
                onChange={(e) => onInputChange("longitude", e.target.value)}
                placeholder="67.0011"
                disabled={!!hasPrimaryBranch}
                className={
                  hasPrimaryBranch ? "bg-muted text-muted-foreground" : ""
                }
              />
            </div>
          </div>
        </div>
        <Separator />

        {/* Settings */}
        {!hideAdminFields && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              <h3 className="text-lg font-medium">Settings</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-medium">
                  Status
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => onInputChange("status", value)}
                  name="status"
                >
                  <SelectTrigger id="status" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-secondary" />
                        Draft
                      </div>
                    </SelectItem>
                    <SelectItem value="published">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        Published
                      </div>
                    </SelectItem>
                    <SelectItem value="archived">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-500" />
                        Archived
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_order" className="text-sm font-medium">
                  Display Order
                </Label>
                <Input
                  id="display_order"
                  name="display_order"
                  type="number"
                  autoComplete="off"
                  value={formData.display_order}
                  onChange={(e) =>
                    onInputChange("display_order", e.target.value)
                  }
                  placeholder="0"
                  min="0"
                  className="h-11"
                />
              </div>
            </div>
          </div>
        )}
        <Separator />

        {/* Toggles */}
        {!hideAdminFields && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Featured Listing Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r from-yellow-50/50 to-orange-50/50 dark:from-yellow-950/20 dark:to-orange-950/20 border-yellow-200/50 dark:border-yellow-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                  <Star className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <Label
                    htmlFor="is_featured"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Featured Listing
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Show inside featured listings
                  </p>
                </div>
              </div>
              <Switch
                id="is_featured"
                name="is_featured"
                checked={formData.is_featured}
                onCheckedChange={(checked) =>
                  onInputChange("is_featured", checked)
                }
              />
            </div>

            {/* Membership Badge Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200/50 dark:border-blue-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Tag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <Label
                    htmlFor="show_member_badge"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Membership Badge
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Show member status
                  </p>
                </div>
              </div>
              <Switch
                id="show_member_badge"
                name="show_member_badge"
                checked={formData.show_member_badge}
                onCheckedChange={(checked) =>
                  onInputChange("show_member_badge", checked)
                }
              />
            </div>
          </div>
        )}
      </form>
    </TabsContent>
  );
}
