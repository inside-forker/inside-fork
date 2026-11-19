import { NextRequest } from "next/server";

// Mock the DB and storage modules before importing the route
jest.mock("@/lib/auth/admin", () => ({
  requireStaff: jest.fn().mockResolvedValue({ id: "staff-1", role: "admin" }),
  getAdminAuthErrorStatus: jest.fn().mockReturnValue(null),
}));

jest.mock("@/lib/storage/spaces", () => ({
  BANKS_PREFIX: "banks",
  uploadFile: jest.fn().mockResolvedValue({
    publicUrl: "https://insidekhi.sgp1.cdn.digitaloceanspaces.com/banks/test-bank-123.png",
  }),
}));

const mockQuery = jest.fn();
jest.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

import { POST, GET } from "@/app/api/admin/banks/route";

describe("Admin Banks API (/api/admin/banks)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/admin/banks", () => {
    it("returns list of banks", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: "HBL Bank",
            code: "HBL",
            logo_url: "https://example.com/hbl.png",
            is_active: true,
            display_order: 0,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      });

      const req = new NextRequest("http://localhost:3000/api/admin/banks");
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.banks).toHaveLength(1);
      expect(json.banks[0].name).toBe("HBL Bank");
    });
  });

  describe("POST /api/admin/banks", () => {
    it("rejects request if bank name is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Bank \/ Wallet name is required/i);
    });

    it("rejects duplicate bank name", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: "Easypaisa" }],
      });

      const req = new NextRequest("http://localhost:3000/api/admin/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "easypaisa" }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/already exists/i);
    });

    it("successfully creates a new bank and auto-generates code if missing", async () => {
      // 1. Duplicate check (none found)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // 2. Sequence sync query
      mockQuery.mockResolvedValueOnce({ rows: [{ setval: "19" }] });
      // 3. Insert query returning new bank
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 19,
            name: "Easypaisa Mobile Wallet",
            code: "EMW",
            logo_url: "https://example.com/ep.png",
            is_active: true,
            display_order: 0,
            created_at: "2026-11-19T00:00:00Z",
          },
        ],
      });

      const req = new NextRequest("http://localhost:3000/api/admin/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Easypaisa Mobile Wallet",
          logo_url: "https://example.com/ep.png",
        }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.bank.id).toBe(19);
      expect(json.bank.name).toBe("Easypaisa Mobile Wallet");
      expect(json.bank.code).toBe("EMW");
    });
  });
});

