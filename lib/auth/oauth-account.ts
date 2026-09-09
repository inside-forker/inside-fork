import { v4 as uuidv4 } from "uuid";
import { query } from "@/lib/db";

export interface OAuthProfile {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export async function generateUniqueUsername(email: string): Promise<string> {
  const base =
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20) || "user";
  const padded = base.length >= 3 ? base : `${base}user`.slice(0, 20);

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate =
      attempt === 0 ? padded : `${padded}${Math.floor(1000 + Math.random() * 9000)}`;
    const { rows } = await query(
      "SELECT id FROM public.profiles WHERE LOWER(username) = LOWER($1) LIMIT 1",
      [candidate]
    );
    if (rows.length === 0) {
      return candidate;
    }
  }

  return `user_${uuidv4().slice(0, 8)}`;
}

export async function linkInviteIfPresent(
  userId: string,
  email: string,
  inviteCode: string
): Promise<void> {
  try {
    const { rows: invitations } = await query(
      "SELECT * FROM public.invitations WHERE invite_code = $1 AND status = 'pending' LIMIT 1",
      [inviteCode]
    );
    const invitation = invitations[0];

    if (invitation && invitation.invitee_email.toLowerCase() === email.toLowerCase()) {
      await query(
        "UPDATE public.invitations SET invitee_id = $1, status = 'accepted', accepted_at = $2 WHERE id = $3",
        [userId, new Date().toISOString(), invitation.id]
      );
    }
  } catch (inviteError) {
    console.error("OAUTH: Failed to process invitation:", inviteError);
  }
}

/**
 * Finds an existing user by email or creates a new one, recording the given
 * OAuth provider in raw_app_meta_data so multiple providers can be linked to
 * the same account over time.
 */
export async function findOrCreateOAuthUser(
  provider: "google" | "apple",
  profile: OAuthProfile,
  inviteCode?: string
): Promise<{ id: string; email: string; role: string }> {
  const { rows } = await query(
    `SELECT u.id, COALESCE(p.role, 'public_user') as role, u.email, u.raw_app_meta_data, p.id as profile_id
     FROM auth.users u
     LEFT JOIN public.profiles p ON p.id = u.id
     WHERE LOWER(u.email) = LOWER($1) LIMIT 1`,
    [profile.email]
  );

  const existing = rows[0];
  const now = new Date().toISOString();
  const subKey = `${provider}_sub`;

  if (existing) {
    const providers = new Set<string>(
      existing.raw_app_meta_data?.providers ?? []
    );
    providers.add(provider);

    await query(
      `UPDATE auth.users
       SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || $2::jsonb,
           raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || $3::jsonb,
           last_sign_in_at = $4
       WHERE id = $1`,
      [
        existing.id,
        JSON.stringify({ provider, providers: Array.from(providers) }),
        JSON.stringify({
          [subKey]: profile.sub,
          ...(profile.name ? { name: profile.name } : {}),
          ...(profile.picture ? { avatar_url: profile.picture } : {}),
        }),
        now,
      ]
    );

    if (!existing.profile_id) {
      const username = await generateUniqueUsername(profile.email);
      try {
        await query(`SELECT public.create_user_profile($1, $2, $3)`, [
          existing.id,
          username,
          profile.name ?? null,
        ]);
      } catch {
        await query(
          `INSERT INTO public.profiles (id, username, full_name, role, points, active_role)
           VALUES ($1, $2, $3, 'public_user', 0, 'public_user')
           ON CONFLICT (id) DO NOTHING`,
          [existing.id, username, profile.name ?? null]
        );
      }
    }

    if (profile.picture) {
      await query(
        `UPDATE public.profiles
         SET avatar_url = COALESCE(avatar_url, $2), updated_at = $3
         WHERE id = $1`,
        [existing.id, profile.picture, now]
      );
    }

    return { id: existing.id, email: existing.email, role: existing.role };
  }

  const newUserId = uuidv4();
  await query(
    `INSERT INTO auth.users
       (id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
        last_sign_in_at, role, aud, raw_app_meta_data, raw_user_meta_data)
     VALUES ($1, $2, NULL, $3, $3, $3, $3, 'authenticated', 'authenticated', $4::jsonb, $5::jsonb)`,
    [
      newUserId,
      profile.email,
      now,
      JSON.stringify({ provider, providers: [provider] }),
      JSON.stringify({
        [subKey]: profile.sub,
        ...(profile.name ? { name: profile.name } : {}),
        ...(profile.picture ? { avatar_url: profile.picture } : {}),
      }),
    ]
  );

  const username = await generateUniqueUsername(profile.email);

  try {
    await query(`SELECT public.create_user_profile($1, $2, $3)`, [
      newUserId,
      username,
      profile.name ?? null,
    ]);
  } catch (profileCreateError) {
    console.error("OAUTH CALLBACK: Profile creation exception:", {
      error: profileCreateError,
      userId: newUserId,
      username,
      provider,
    });
    await query(
      `INSERT INTO public.profiles (id, username, full_name, role, points, active_role)
       VALUES ($1, $2, $3, 'public_user', 0, 'public_user')`,
      [newUserId, username, profile.name ?? null]
    );
  }

  if (profile.picture) {
    await query(`UPDATE public.profiles SET avatar_url = $2 WHERE id = $1`, [
      newUserId,
      profile.picture,
    ]);
  }

  if (inviteCode) {
    await linkInviteIfPresent(newUserId, profile.email, inviteCode);
  }

  try {
    const { logUserSignup } = await import("@/lib/audit");
    await logUserSignup(newUserId, profile.email);
  } catch (logError) {
    console.error("Failed to log OAuth signup:", logError);
  }

  return { id: newUserId, email: profile.email, role: "public_user" };
}
