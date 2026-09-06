import { query } from "@/lib/db";

export type ConsentLedgerInput = {
  userId: string;
  source?: string;
  termsVersion?: string | null;
  privacyVersion?: string | null;
  marketingPush?: boolean | null;
  marketingSms?: boolean | null;
  marketingWhatsapp?: boolean | null;
  marketingEmail?: boolean | null;
  locationPermission?: string | null;
  personalisationOptIn?: boolean | null;
  meta?: Record<string, unknown>;
};

/** Append-only consent ledger write. Never updates prior rows. */
export async function appendConsentLedger(input: ConsentLedgerInput): Promise<void> {
  await query(
    `INSERT INTO public.consent_ledger
       (user_id, source, terms_version, privacy_version,
        marketing_push, marketing_sms, marketing_whatsapp, marketing_email,
        location_permission, personalisation_opt_in, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
    [
      input.userId,
      input.source ?? "settings",
      input.termsVersion ?? null,
      input.privacyVersion ?? null,
      input.marketingPush ?? null,
      input.marketingSms ?? null,
      input.marketingWhatsapp ?? null,
      input.marketingEmail ?? null,
      input.locationPermission ?? null,
      input.personalisationOptIn ?? null,
      JSON.stringify(input.meta ?? {}),
    ],
  );
}
