import type { NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * "Came from Parchi" on website sign-up / sign-in.
 *
 * The event page sets this cookie when the Parchi app's link brings a visitor
 * in (lib/parchi/prefill.ts). The next sign-up or sign-in records a row in
 * parchi_auth_events and clears the cookie, so only the sign-in that followed
 * the Parchi visit counts. SameSite=None so it survives Apple's cross-site
 * form_post callback.
 */
export const PARCHI_ARRIVAL_COOKIE = "ik_from_parchi";

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return rest.join("=");
      }
    }
  }
  return null;
}

/** Records the Parchi arrival (if any) for this sign-up / sign-in. Never throws. */
export async function recordParchiAuth(
  request: Request,
  response: NextResponse,
  userId: string,
  event: "signup" | "signin",
  method: "email" | "google" | "apple",
): Promise<void> {
  const marker = readCookie(request.headers.get("cookie"), PARCHI_ARRIVAL_COOKIE);
  if (!marker) return;
  const parchiId = /^[A-Za-z0-9]{1,10}$/.test(marker) ? marker : null;
  try {
    await query(
      `INSERT INTO parchi_auth_events (user_id, event, method, parchi_id)
       VALUES ($1, $2, $3, $4)`,
      [userId, event, method, parchiId],
    );
  } catch (err) {
    console.error("[parchi] failed to record sign-in source:", err);
  }
  response.cookies.set(PARCHI_ARRIVAL_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "none",
    secure: true,
  });
}
