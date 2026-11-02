import { usesAdminShell, adminNavigation, ADMIN_NAV_GROUPS } from "@/lib/navigation/role-navigation";

describe("usesAdminShell", () => {
  it.each(["admin", "super_admin", "lister", "data_entry"])("gives %s the admin shell", (role) => {
    expect(usesAdminShell({ role })).toBe(true);
  });

  it.each(["public_user", "organizer", "business_owner", "writer", "gate_pass"])("keeps %s on the existing layout", (role) => {
    expect(usesAdminShell({ role })).toBe(false);
  });

  it("follows the active role, so staff in personal mode keep the consumer layout", () => {
    expect(usesAdminShell({ role: "admin", active_role: "public_user" })).toBe(false);
    expect(usesAdminShell({ role: "admin", active_role: null })).toBe(true);
  });

  it("handles a missing profile", () => {
    expect(usesAdminShell(null)).toBe(false);
  });
});

describe("ADMIN_NAV_GROUPS", () => {
  it("only references real admin links (or the shared dashboard ones)", () => {
    const known = new Set([...adminNavigation.map((i) => i.href), "/dashboard", "/dashboard/scan"]);
    const grouped = ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(grouped.filter((href) => !known.has(href))).toEqual([]);
  });
});
