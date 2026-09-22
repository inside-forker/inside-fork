import { query } from "@/lib/db";

type ContentType = "review" | "comment";

type BlockContentAuthorInput = {
  contentType: ContentType;
  contentId: number;
  blockerId: string;
};

type BlockResult =
  | { success: true }
  | {
      success: false;
      error: "not_found" | "cannot_block_self" | "already_blocked";
    };

const CONTENT_TABLE: Record<ContentType, string> = {
  review: "reviews",
  comment: "review_comments",
};

/**
 * Blocks the author of a review/comment. Content-relative rather than
 * user-id-based: the mobile API never exposes another user's profile id to
 * the client (see lib/mobile/mappers.ts), so the owner id is resolved
 * server-side from the content, mirroring createContentReport's
 * auth -> self-check -> duplicate-check -> insert shape
 * (lib/reports/create-report.ts).
 */
export async function blockContentAuthor(
  input: BlockContentAuthorInput,
): Promise<BlockResult> {
  const { contentType, contentId, blockerId } = input;

  const { rows } = await query(
    `SELECT user_id FROM ${CONTENT_TABLE[contentType]} WHERE id = $1`,
    [contentId],
  );
  const ownerId = rows[0]?.user_id as string | undefined;

  if (!ownerId) {
    return { success: false, error: "not_found" };
  }

  if (ownerId === blockerId) {
    return { success: false, error: "cannot_block_self" };
  }

  try {
    await query(
      `INSERT INTO public.blocked_users (blocker_id, blocked_id) VALUES ($1, $2)`,
      [blockerId, ownerId],
    );
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === "23505") {
      return { success: false, error: "already_blocked" };
    }
    throw error;
  }

  return { success: true };
}

/** Unblocks by the opaque `blocked_users.id` row handle, scoped to the
 * caller so one user can't unblock another's relationship. Returns whether
 * a row was actually deleted. */
export async function unblockUser(
  blockId: number,
  blockerId: string,
): Promise<boolean> {
  const { rowCount } = await query(
    `DELETE FROM public.blocked_users WHERE id = $1 AND blocker_id = $2`,
    [blockId, blockerId],
  );
  return (rowCount ?? 0) > 0;
}

export type BlockedUserRow = {
  id: number;
  username: string | null;
  avatar_url: string | null;
  blocked_at: string;
};

/** Lists who `blockerId` has blocked, newest first. Deleted accounts get the
 * same placeholder handle used elsewhere (REVIEW_SQL_COLUMNS). */
export async function listBlockedUsers(
  blockerId: string,
  limit: number,
  offset: number,
): Promise<{ rows: BlockedUserRow[]; total: number }> {
  const [rowsRes, countRes] = await Promise.all([
    query(
      `SELECT bu.id,
              CASE WHEN p.deleted_at IS NOT NULL THEN 'Inside Karachi User' ELSE p.username END AS username,
              p.avatar_url,
              to_json(bu.created_at) #>> '{}' AS blocked_at
       FROM public.blocked_users bu
       LEFT JOIN profiles p ON p.id = bu.blocked_id
       WHERE bu.blocker_id = $1
       ORDER BY bu.created_at DESC
       LIMIT $2 OFFSET $3`,
      [blockerId, limit, offset],
    ),
    query(
      `SELECT COUNT(*) FROM public.blocked_users WHERE blocker_id = $1`,
      [blockerId],
    ),
  ]);

  const rows: BlockedUserRow[] = rowsRes.rows.map((row) => ({
    id: Number(row.id),
    username: row.username,
    avatar_url: row.avatar_url,
    blocked_at: row.blocked_at,
  }));
  const total = Number(countRes.rows[0]?.count ?? 0);

  return { rows, total };
}
