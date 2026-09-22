"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface DeleteAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3;

export function DeleteAccountDialog({ isOpen, onClose }: DeleteAccountDialogProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>(1);
  const [hasPassword, setHasPassword] = React.useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [confirmText, setConfirmText] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    // Reset on every open so a cancelled attempt doesn't carry over.
    setStep(1);
    setCurrentPassword("");
    setConfirmText("");
    setError(null);

    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => setHasPassword(Boolean(data?.profile?.has_password)))
      .catch(() => setHasPassword(null));
  }, [isOpen]);

  const handleDelete = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          hasPassword ? { currentPassword } : { confirmText },
        ),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message || "Something went wrong. Please try again.");
        setIsSubmitting(false);
        return;
      }

      router.push("/account-deleted");
    } catch {
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    hasPassword === true
      ? currentPassword.length > 0
      : confirmText === "DELETE";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        {step === 1 && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <DialogTitle className="text-left">
                  Delete your Inside Karachi account?
                </DialogTitle>
              </div>
              <DialogDescription className="text-left mt-2">
                This is permanent. Once you confirm on the final screen, it
                happens immediately — there&apos;s no grace period and no way
                to undo it.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => setStep(2)}
                className="flex-1 sm:flex-none"
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle className="text-left">
                What happens when you delete your account
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-foreground flex items-center gap-2 mb-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Removed or anonymized
                </p>
                <ul className="list-disc pl-9 space-y-1 text-muted-foreground">
                  <li>
                    Your name, profile photo, phone number, and bio —
                    replaced with &quot;Insider&quot;
                  </li>
                  <li>
                    Your email address — freed up right away; you won&apos;t
                    be able to log back into this account with it
                  </li>
                  <li>Your password — disabled permanently</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Kept (shown under &quot;Insider&quot;)
                </p>
                <ul className="list-disc pl-9 space-y-1 text-muted-foreground">
                  <li>Reviews and comments you&apos;ve written</li>
                  <li>Listings or events you&apos;ve created</li>
                  <li>Your bookings, RSVPs, and ticket history</li>
                  <li>Points and badges you&apos;ve earned</li>
                </ul>
              </div>
              <p className="text-destructive font-medium">This can&apos;t be undone.</p>
            </div>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 sm:flex-none">
                Go back
              </Button>
              <Button
                variant="destructive"
                onClick={() => setStep(3)}
                className="flex-1 sm:flex-none"
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 3 && (
          <>
            <DialogHeader>
              <DialogTitle className="text-left">Confirm deletion</DialogTitle>
              <DialogDescription className="text-left mt-2">
                {hasPassword
                  ? "Enter your current password to permanently delete your account."
                  : 'Type "DELETE" to permanently delete your account.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {hasPassword ? (
                <div className="space-y-2">
                  <Label htmlFor="delete-current-password">Current password</Label>
                  <Input
                    id="delete-current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="delete-confirm-text">Type DELETE to confirm</Label>
                  <Input
                    id="delete-confirm-text"
                    autoComplete="off"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    disabled={isSubmitting || hasPassword === null}
                    placeholder="DELETE"
                  />
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none"
              >
                Go back
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={!canSubmit || isSubmitting}
                className="flex-1 sm:flex-none"
              >
                {isSubmitting ? "Deleting..." : "Permanently Delete My Account"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
