import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Theme-token fills only. Picked from the name so the same person keeps the same tone.
const TONES = [
  "bg-muted text-foreground",
  "bg-foreground text-background",
  "bg-primary/10 text-foreground",
  "bg-cream text-ink",
] as const;

const SIZES = {
  sm: "size-6",
  md: "size-7",
  lg: "size-8",
} as const;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

function toneFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

export interface AdminAvatarProps {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Person or organizer avatar with an initials fallback. */
export function AdminAvatar({ name, src, size = "md", className }: AdminAvatarProps) {
  return (
    <Avatar className={cn(SIZES[size], "shrink-0", className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className={cn("text-xs font-semibold", toneFor(name))}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
