import { Metadata } from "next";
import Link from "next/link";
import { getOptionalSessionUser } from "@/lib/auth/require-session";

export const metadata: Metadata = {
  title: "Delete Your Account - Inside: The City Guide (Inside Karachi)",
  description:
    "How to permanently delete your Inside: The City Guide (Inside Karachi) account, on the web or in the app, and what happens to your data when you do.",
};

const RETURN_TO = "/dashboard/profile?openDelete=1";

export default async function DeleteAccountPage() {
  const session = await getOptionalSessionUser({ withProfile: false });
  const ctaHref = session
    ? RETURN_TO
    : `/login?returnUrl=${encodeURIComponent(RETURN_TO)}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <h1 className="text-3xl md:text-5xl font-bold mb-4">
          <span className="gradient-text-primary">Delete your account</span>
        </h1>
        <p className="text-muted-foreground text-lg mb-10">
          You can permanently delete your Inside: The City Guide (Inside
          Karachi) account at any time, from the website or the mobile app. This page explains
          exactly what happens when you do.
        </p>

        <div className="glass-card border border-border rounded-2xl p-6 md:p-8 mb-8">
          <h2 className="text-xl font-bold mb-4">What happens when you delete your account</h2>
          <p className="text-muted-foreground mb-4">
            Deletion is <strong className="text-foreground">immediate and permanent</strong> —
            there is no grace period, and it cannot be undone once confirmed.
          </p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-foreground mb-2">Removed or anonymized</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                <li>Your name, profile photo, phone number, and bio — replaced with &quot;Insider&quot;</li>
                <li>Your email address — freed up immediately for reuse</li>
                <li>Your password — disabled permanently</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Kept (under &quot;Insider&quot;)</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                <li>Reviews and comments you&apos;ve written</li>
                <li>Listings or events you&apos;ve created</li>
                <li>Your bookings, RSVPs, and ticket history</li>
                <li>Points and badges you&apos;ve earned</li>
              </ul>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            We keep this content so reviews and listings stay useful for
            everyone else on Inside Karachi — it&apos;s just no longer
            connected to your identity.
          </p>
        </div>

        <div className="glass-card border border-border rounded-2xl p-6 md:p-8 mb-8">
          <h2 className="text-xl font-bold mb-4">How to delete your account</h2>
          <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
            <li>Log in to your account (on the website or in the app).</li>
            <li>
              Go to <strong className="text-foreground">Profile → Security</strong> (web) or{" "}
              <strong className="text-foreground">Settings</strong> (app), and find the
              &quot;Danger Zone&quot;.
            </li>
            <li>Tap or click <strong className="text-foreground">Delete Account</strong>.</li>
            <li>Read the confirmation screens, then confirm with your password (or by typing &quot;DELETE&quot;).</li>
          </ol>
          <div className="mt-6">
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center rounded-md bg-destructive text-white px-5 py-2.5 font-semibold shadow-xs hover:bg-destructive/90 transition-colors"
            >
              Delete My Account
            </Link>
          </div>
        </div>

        <div className="glass-card border border-border rounded-2xl p-6 md:p-8">
          <h2 className="text-xl font-bold mb-4">Questions</h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold text-foreground">Is this reversible?</p>
              <p className="text-muted-foreground">
                No. Once confirmed, deletion happens immediately and cannot
                be undone.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">What happens to my email address?</p>
              <p className="text-muted-foreground">
                It&apos;s freed up right away — you can sign up again later
                with the same email if you want to.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">
                I don&apos;t have access to the app or website anymore — can you delete it for me?
              </p>
              <p className="text-muted-foreground">
                Yes — contact us and we&apos;ll verify your identity and
                delete the account on your behalf.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
