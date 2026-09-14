import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { query } from "@/lib/db";
import { CleanupLogsClient } from "@/components/admin/CleanupLogsClient";

export default async function CleanupLogsPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  // Check super admin role
  if (profile.role !== "super_admin") {
    redirect("/admin");
  }

  // Fetch cleanup logs
  let logs;
  try {
    const result = await query(
      `SELECT l.*, p.full_name AS deleted_by_full_name, u.email AS deleted_by_email
       FROM form_reply_cleanup_logs l
       LEFT JOIN profiles p ON p.id = l.executed_by
       LEFT JOIN auth.users u ON u.id = l.executed_by
       ORDER BY l.executed_at DESC
       LIMIT 100`,
    );
    logs = result.rows.map((row) => {
      const { deleted_by_full_name, deleted_by_email, ...rest } = row;
      return {
        ...rest,
        deleted_by_profile: {
          full_name: deleted_by_full_name,
          email: deleted_by_email,
        },
      };
    });
  } catch (error) {
    console.error("Failed to fetch cleanup logs:", error);
    logs = [];
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Reply Cleanup Logs</h1>
        <p className="text-muted-foreground">
          Audit trail for automatic cleanup of soft-deleted form replies
        </p>
      </div>

      <CleanupLogsClient
        initialLogs={(logs as never) || []}
        userRole={profile.role || "user"}
      />
    </div>
  );
}
