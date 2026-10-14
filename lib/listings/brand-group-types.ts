export type SiblingLocation = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_current: boolean;
};

export function slugifyBrandName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
