import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/require-session";
import { query } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

async function createCreatorCode(formData: FormData) {
  "use server";
  const { profile } = await requireSessionUser();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    throw new Error("Unauthorized");
  }

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
  const label = String(formData.get("label") ?? "").trim();
  if (!code || code.length < 3 || !label) {
    return;
  }

  await query(
    `INSERT INTO public.creator_attribution_codes (code, label, is_active)
     VALUES ($1, $2, true)
     ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, is_active = true`,
    [code, label],
  );
  revalidatePath("/admin/creator-codes");
}

export default async function AdminCreatorCodesPage() {
  const { profile } = await requireSessionUser();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  let rows: {
    code: string;
    label: string;
    is_active: boolean;
    created_at: string;
    attributed_users: number;
  }[] = [];

  try {
    const { rows: dbRows } = await query(
      `SELECT c.code, c.label, c.is_active, c.created_at::text,
              COUNT(p.id)::int AS attributed_users
       FROM public.creator_attribution_codes c
       LEFT JOIN public.profiles p ON p.attributed_creator_code = c.code
       GROUP BY c.code, c.label, c.is_active, c.created_at
       ORDER BY attributed_users DESC, c.created_at DESC`,
    );
    rows = dbRows.map((r) => ({
      code: String(r.code),
      label: String(r.label),
      is_active: Boolean(r.is_active),
      created_at: String(r.created_at),
      attributed_users: Number(r.attributed_users ?? 0),
    }));
  } catch (error) {
    console.error("creator codes load failed", error);
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Creator codes</h1>
          <p className="text-muted-foreground">
            Basic attribution: share a code, capture it at signup (
            <code className="text-xs">?creator=CODE</code> / signup body).
          </p>
        </div>
        <Link
          href="/admin/analytics"
          className="text-sm text-primary hover:underline"
        >
          Back to Analytics
        </Link>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-lg">Create code</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createCreatorCode} className="space-y-3">
            <Input name="code" placeholder="CODE (e.g. ZAKI01)" required minLength={3} />
            <Input name="label" placeholder="Label / creator name" required />
            <Button type="submit">Save code</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Codes & attributed signups</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No codes yet (or Phase 3 migration not applied).
            </p>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Signups</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.code}>
                      <TableCell>
                        <code className="text-xs">{row.code}</code>
                      </TableCell>
                      <TableCell>{row.label}</TableCell>
                      <TableCell>{row.is_active ? "yes" : "no"}</TableCell>
                      <TableCell className="text-right">
                        {row.attributed_users.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
