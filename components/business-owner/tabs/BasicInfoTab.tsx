"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info } from "lucide-react";
import type { Database } from "@/types/database";

type Listing = Database["public"]["Tables"]["listings"]["Row"] & {
  category?: {
    id: number;
    name: string;
  } | null;
};

interface BasicInfoForm {
  name: string;
  description: string;
  category_id: string;
  address: string;
  phone_number: string;
  email: string;
  website: string;
  facebook_url: string;
  instagram_url: string;
  whatsapp_number: string;
  reason: string;
}

interface BasicInfoTabProps {
  listing?: Listing;
  mode: "create" | "edit";
  onSaveSuccess?: (listing: Listing) => void;
}

const MAJOR_CHANGE_FIELDS = ["name", "category_id", "address"];

export default function BasicInfoTab({
  listing,
  mode,
  onSaveSuccess,
}: BasicInfoTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [needsReason, setNeedsReason] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<BasicInfoForm>({
    name: listing?.name || "",
    description: listing?.description || "",
    category_id:
      listing?.category_id != null ? String(listing.category_id) : "",
    address: listing?.address || "",
    phone_number: listing?.phone_number || "",
    email: listing?.email || "",
    website: listing?.website || "",
    facebook_url: listing?.facebook_url || "",
    instagram_url: listing?.instagram_url || "",
    whatsapp_number: listing?.whatsapp_number || "",
    reason: "",
  });

  // Fetch categories
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch("/api/categories?all=true");
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || []);
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      }
    }
    fetchCategories();
  }, []);

  // Watch for major changes to show reason field
  useEffect(() => {
    if (mode === "create" || !listing) {
      setNeedsReason(false);
      return;
    }

    const hasMajorChange = MAJOR_CHANGE_FIELDS.some((field) => {
      const currentValue = formData[field as keyof BasicInfoForm];
      const originalValue = listing[field as keyof Listing];

      if (field === "category_id") {
        const originalCategoryId =
          originalValue != null ? String(originalValue) : "";
        return currentValue !== originalCategoryId;
      }
      return currentValue !== originalValue;
    });

    setNeedsReason(hasMajorChange);
  }, [formData, listing, mode]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.length < 3) {
      newErrors.name = "Name must be at least 3 characters";
    }
    if (!formData.description || formData.description.length < 20) {
      newErrors.description = "Description must be at least 20 characters";
    }
    if (!formData.category_id) {
      newErrors.category_id = "Please select a category";
    }
    if (needsReason && (!formData.reason || formData.reason.length < 10)) {
      newErrors.reason = "Please explain your changes (minimum 10 characters)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      setLoading(true);

      const endpoint =
        mode === "create"
          ? "/api/business/listings"
          : `/api/business/listings/${listing?.id}`;

      const method = mode === "create" ? "POST" : "PATCH";

      const payload = {
        ...formData,
        category_id: parseInt(formData.category_id, 10),
        status: mode === "create" ? "draft" : undefined,
      };

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();

        if (error.code === "PENDING_REQUEST_EXISTS") {
          toast({
            title: "Pending Change Request",
            description:
              error.error ||
              "You already have a pending change request for this listing.",
            variant: "destructive",
          });
          return;
        }

        throw new Error(error.error || "Failed to save listing");
      }

      const result = await response.json();

      if (result.data.change_request_created) {
        toast({
          title: "Change Request Submitted",
          description:
            "Your changes will be reviewed by an admin before going live.",
        });
        onSaveSuccess?.(result.data.change_request.proposed_data as Listing);
      } else {
        toast({
          title: mode === "create" ? "Listing Created" : "Listing Updated",
          description:
            mode === "create"
              ? "Your listing has been created successfully"
              : result.message || "Changes saved successfully",
        });
        onSaveSuccess?.(result.data as Listing);
      }
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save listing",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {needsReason && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            You&apos;re making major changes that require admin approval. Please
            explain the reason for these changes.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Name */}
          <div className="md:col-span-2">
            <Label htmlFor="name">Business Name *</Label>
            <Input
              id="name"
              placeholder="Enter business name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
            {errors.name && (
              <p className="text-sm text-destructive mt-1">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe your business..."
              className="min-h-[120px]"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
            <p className="text-sm text-muted-foreground mt-1">
              Provide a detailed description of your business (20-2000
              characters)
            </p>
            {errors.description && (
              <p className="text-sm text-destructive mt-1">
                {errors.description}
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <Label htmlFor="category_id">Category *</Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) =>
                setFormData({ ...formData, category_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter((cat) => cat && cat.id != null)
                  .map((category) => (
                    <SelectItem
                      key={category.id}
                      value={String(category.id)}
                    >
                      {category.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {errors.category_id && (
              <p className="text-sm text-destructive mt-1">
                {errors.category_id}
              </p>
            )}
          </div>

          {/* Address */}
          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="Business address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
            />
          </div>

          {/* Phone */}
          <div>
            <Label htmlFor="phone_number">Phone Number</Label>
            <Input
              id="phone_number"
              placeholder="+92 300 1234567"
              value={formData.phone_number}
              onChange={(e) =>
                setFormData({ ...formData, phone_number: e.target.value })
              }
            />
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="business@example.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>

          {/* Website */}
          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              placeholder="https://www.example.com"
              value={formData.website}
              onChange={(e) =>
                setFormData({ ...formData, website: e.target.value })
              }
            />
          </div>

          {/* WhatsApp */}
          <div>
            <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
            <Input
              id="whatsapp_number"
              placeholder="+92 300 1234567"
              value={formData.whatsapp_number}
              onChange={(e) =>
                setFormData({ ...formData, whatsapp_number: e.target.value })
              }
            />
          </div>

          {/* Facebook */}
          <div>
            <Label htmlFor="facebook_url">Facebook URL</Label>
            <Input
              id="facebook_url"
              placeholder="https://facebook.com/yourpage"
              value={formData.facebook_url}
              onChange={(e) =>
                setFormData({ ...formData, facebook_url: e.target.value })
              }
            />
          </div>

          {/* Instagram */}
          <div>
            <Label htmlFor="instagram_url">Instagram URL</Label>
            <Input
              id="instagram_url"
              placeholder="https://instagram.com/yourprofile"
              value={formData.instagram_url}
              onChange={(e) =>
                setFormData({ ...formData, instagram_url: e.target.value })
              }
            />
          </div>

          {/* Reason (if major changes) */}
          {needsReason && (
            <div className="md:col-span-2">
              <Label htmlFor="reason">Reason for Changes *</Label>
              <Textarea
                id="reason"
                placeholder="Explain why you're making these changes..."
                className="min-h-[80px]"
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
              />
              <p className="text-sm text-muted-foreground mt-1">
                Required for major changes (name, category, or address)
              </p>
              {errors.reason && (
                <p className="text-sm text-destructive mt-1">{errors.reason}</p>
              )}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create Listing" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
