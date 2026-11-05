import crypto from "crypto";
import { query } from "@/lib/db";

/** No 0/O, 1/I/L: codes may be read out or typed. 31^8 ≈ 8.5e11 combinations. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;
export const MAX_INVITES_PER_BATCH = 1000;

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/** Upper-case, strip spaces/dashes; null when it can't be a code. */
export function normalizeInviteCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[\s-]/g, "");
  return /^[A-Z0-9]{4,32}$/.test(code) ? code : null;
}

export function inviteUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/i/${code}`;
}

export interface InviteLookup {
  id: number;
  code: string;
  claimed_by: string | null;
  event_id: number;
  event_slug: string;
  event_name: string;
  event_status: string;
  start_time: string;
  location_name: string | null;
  poster: string | null;
}

export async function getInviteByCode(code: string): Promise<InviteLookup | null> {
  const { rows } = await query(
    `SELECT i.id, i.code, i.claimed_by, e.id AS event_id, e.slug AS event_slug,
            e.name AS event_name, e.status::text AS event_status,
            to_json(e.start_time) #>> '{}' AS start_time,
            ewd.location_name,
            (SELECT url FROM event_images im WHERE im.event_id = e.id
              ORDER BY display_order ASC LIMIT 1) AS poster
     FROM event_invites i
     JOIN events e ON e.id = i.event_id
     LEFT JOIN events_with_details ewd ON ewd.event_id = e.id
     WHERE i.code = $1
     LIMIT 1`,
    [code],
  );
  const row = rows[0];
  if (!row) return null;
  return { ...row, id: Number(row.id), event_id: Number(row.event_id) } as InviteLookup;
}

export async function hasClaimedInvite(userId: string, eventId: number): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM event_invites WHERE event_id = $1 AND claimed_by = $2 LIMIT 1`,
    [eventId, userId],
  );
  return rows.length > 0;
}

export type ClaimResult =
  | { ok: true; eventSlug: string }
  | { ok: false; reason: "not_found" | "used" };

/**
 * Locks the code to this user. Re-claiming your own code is fine; a user who
 * already holds another code for the same event keeps that one (the unique
 * index stops a second claim) and is let through.
 */
export async function claimInvite(code: string, userId: string): Promise<ClaimResult> {
  const invite = await getInviteByCode(code);
  if (!invite) return { ok: false, reason: "not_found" };
  if (invite.claimed_by === userId) return { ok: true, eventSlug: invite.event_slug };
  if (invite.claimed_by) return { ok: false, reason: "used" };

  if (await hasClaimedInvite(userId, invite.event_id)) {
    return { ok: true, eventSlug: invite.event_slug };
  }

  try {
    const { rows } = await query(
      `UPDATE event_invites SET claimed_by = $2, claimed_at = now()
       WHERE id = $1 AND claimed_by IS NULL
       RETURNING id`,
      [invite.id, userId],
    );
    if (rows.length === 0) return { ok: false, reason: "used" };
  } catch (err) {
    // Unique (event_id, claimed_by): a parallel claim of another code won.
    if ((err as { code?: string }).code === "23505") {
      return { ok: true, eventSlug: invite.event_slug };
    }
    throw err;
  }
  return { ok: true, eventSlug: invite.event_slug };
}

/** Inserts `count` fresh codes; retries the rare collision. */
export async function createInvites(
  eventId: number,
  count: number,
  labels: (string | null)[] = [],
): Promise<string[]> {
  const created: string[] = [];
  for (let i = 0; i < count; i++) {
    const label = labels[i]?.trim() || null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateInviteCode();
      const { rows } = await query(
        `INSERT INTO event_invites (event_id, code, label) VALUES ($1, $2, $3)
         ON CONFLICT (code) DO NOTHING RETURNING code`,
        [eventId, code, label],
      );
      if (rows[0]) {
        created.push(rows[0].code);
        break;
      }
    }
  }
  return created;
}

export interface AdminInviteRow {
  id: number;
  code: string;
  label: string | null;
  claimed_at: string | null;
  claimed_by_email: string | null;
  claimed_by_name: string | null;
  booked: boolean;
  created_at: string;
}

export async function listInvites(eventId: number): Promise<AdminInviteRow[]> {
  const { rows } = await query(
    `SELECT i.id, i.code, i.label,
            to_json(i.claimed_at) #>> '{}' AS claimed_at,
            to_json(i.created_at) #>> '{}' AS created_at,
            u.email AS claimed_by_email,
            p.full_name AS claimed_by_name,
            EXISTS (
              SELECT 1 FROM bookings b
              WHERE b.event_id = i.event_id AND b.user_id = i.claimed_by
                AND b.payment_status = 'paid'
            ) AS booked
     FROM event_invites i
     LEFT JOIN profiles p ON p.id = i.claimed_by
     LEFT JOIN auth.users u ON u.id = i.claimed_by
     WHERE i.event_id = $1
     ORDER BY i.id ASC`,
    [eventId],
  );
  return rows.map((r) => ({ ...r, id: Number(r.id) })) as AdminInviteRow[];
}
