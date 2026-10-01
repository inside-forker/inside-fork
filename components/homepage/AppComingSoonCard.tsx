import { Smartphone } from "lucide-react";
import { NewsletterForm } from "@/components/shared/NewsletterForm";

/**
 * The app isn't in the stores yet, so this stays a small card: one line and a
 * way to hear when it lands. No store badges until there's something to tap.
 */
export function AppComingSoonCard() {
  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-muted p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Smartphone className="h-5 w-5 text-primary" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight text-foreground">
            Inside Karachi, soon in your pocket.
          </h2>
          <p className="text-sm text-muted-foreground">
            Get notified when the app launches.
          </p>
        </div>
      </div>
      <NewsletterForm
        buttonLabel="Notify me"
        successTitle="You're on the list"
        successDescription="We'll email you when the app is out."
        className="mt-auto"
      />
    </div>
  );
}
