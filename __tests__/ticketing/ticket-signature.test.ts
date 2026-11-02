import { verifyTicketSignature } from "@/lib/tickets/signature";
import crypto from "crypto";

describe("Ticket Signature Verification", () => {
  const originalEnv = process.env;
  const TEST_SECRET = "super-secret-test-key-12345";

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function generateValidSignature(
    code: string,
    eventId: number,
    bookingId: number,
    secret: string,
  ): string {
    const payload = `${code}:${eventId}:${bookingId}`;
    return crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex")
      .substring(0, 16);
  }

  it("throws an error when TICKET_SIGNING_SECRET is not configured", () => {
    delete process.env.TICKET_SIGNING_SECRET;
    expect(() => {
      verifyTicketSignature("TICK-123", 1, 100, "any-sig");
    }).toThrow("TICKET_SIGNING_SECRET environment variable is not configured");
  });

  it("successfully verifies a valid ticket signature", () => {
    process.env.TICKET_SIGNING_SECRET = TEST_SECRET;
    const code = "TICK-VALID-ABC";
    const eventId = 42;
    const bookingId = 999;
    const signature = generateValidSignature(code, eventId, bookingId, TEST_SECRET);

    const isValid = verifyTicketSignature(code, eventId, bookingId, signature);
    expect(isValid).toBe(true);
  });

  it("rejects when ticket code is altered", () => {
    process.env.TICKET_SIGNING_SECRET = TEST_SECRET;
    const code = "TICK-VALID-ABC";
    const eventId = 42;
    const bookingId = 999;
    const signature = generateValidSignature(code, eventId, bookingId, TEST_SECRET);

    const isTamperedValid = verifyTicketSignature("TICK-TAMPERED", eventId, bookingId, signature);
    expect(isTamperedValid).toBe(false);
  });

  it("rejects when eventId or bookingId differs", () => {
    process.env.TICKET_SIGNING_SECRET = TEST_SECRET;
    const code = "TICK-VALID-ABC";
    const signature = generateValidSignature(code, 42, 999, TEST_SECRET);

    expect(verifyTicketSignature(code, 43, 999, signature)).toBe(false);
    expect(verifyTicketSignature(code, 42, 1000, signature)).toBe(false);
  });

  it("rejects when signature was generated with a different secret", () => {
    process.env.TICKET_SIGNING_SECRET = TEST_SECRET;
    const forgedSignature = generateValidSignature("TICK-VALID-ABC", 42, 999, "attacker-secret");
    expect(verifyTicketSignature("TICK-VALID-ABC", 42, 999, forgedSignature)).toBe(false);
  });
});

