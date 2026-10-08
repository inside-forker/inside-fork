"use client";

import { Button } from "@/components/ui/button";

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "h-4 w-4 fill-current shrink-0 -mt-0.5"}
      aria-hidden="true"
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.85-.92.04-2.06.63-2.71 1.38-.56.65-1.07 1.71-.94 2.74 1.05.08 2.11-.53 2.73-1.27z" />
    </svg>
  );
}

export function AppleSignInButton({
  next,
  invite,
  label = "Continue with Apple",
  className,
}: {
  next?: string;
  invite?: string;
  label?: string;
  className?: string;
}) {
  const params = new URLSearchParams();
  if (next) params.set("next", next);
  if (invite) params.set("invite", invite);
  const query = params.toString();
  const href = query ? `/api/auth/apple?${query}` : "/api/auth/apple";

  return (
    <Button
      type="button"
      variant="outline"
      asChild
      className={
        className ??
        "w-full bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white font-medium py-3 rounded-lg transition-all duration-200"
      }
    >
      <a href={href} className="flex items-center justify-center gap-2">
        <AppleLogo />
        {label}
      </a>
    </Button>
  );
}
