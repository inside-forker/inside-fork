import {
  formatPayFastMobile,
  normalizePayFastStatus,
  validateAmountMatch,
  validatePayFastCallback,
} from "@/lib/payments/payfast";
import crypto from "crypto";

describe("PayFast Payment Gateway Logic", () => {
  const originalEnv = process.env;
  const TEST_MERCHANT_ID = "1001";
  const TEST_SECURED_KEY = "test-sec-key-xyz";

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      PAYFAST_MERCHANT_ID: TEST_MERCHANT_ID,
      PAYFAST_SECURED_KEY: TEST_SECURED_KEY,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      PAYFAST_ALLOW_SANDBOX: "false",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("formatPayFastMobile", () => {
    it("converts 03001234567 to 923001234567", () => {
      expect(formatPayFastMobile("03001234567")).toBe("923001234567");
    });

    it("strips dashes and spaces before formatting", () => {
      expect(formatPayFastMobile("0300-123 4567")).toBe("923001234567");
    });

    it("prepends 92 to numbers starting with 3", () => {
      expect(formatPayFastMobile("3001234567")).toBe("923001234567");
    });

    it("keeps numbers already prefixed with 92 untouched", () => {
      expect(formatPayFastMobile("923001234567")).toBe("923001234567");
    });
  });

  describe("normalizePayFastStatus", () => {
    it("maps '00' and '000' to paid", () => {
      expect(normalizePayFastStatus("00")).toBe("paid");
      expect(normalizePayFastStatus("000")).toBe("paid");
    });

    it("maps '124' and '125' to pending", () => {
      expect(normalizePayFastStatus("124")).toBe("pending");
      expect(normalizePayFastStatus("125")).toBe("pending");
    });

    it("maps any error or rejection code to failed", () => {
      expect(normalizePayFastStatus("01")).toBe("failed");
      expect(normalizePayFastStatus("99")).toBe("failed");
      expect(normalizePayFastStatus("CANCELLED")).toBe("failed");
    });
  });

  describe("validateAmountMatch", () => {
    it("returns true for matching string amounts", () => {
      expect(validateAmountMatch("1500.00", "1500")).toBe(true);
      expect(validateAmountMatch("250.50", "250.50")).toBe(true);
    });

    it("allows small floating point rounding tolerance under 0.01", () => {
      expect(validateAmountMatch("100.004", "100.000")).toBe(true);
    });

    it("returns false for mismatched amounts", () => {
      expect(validateAmountMatch("1500.00", "1499.00")).toBe(false);
      expect(validateAmountMatch("100.00", "150.00")).toBe(false);
    });
  });

  describe("validatePayFastCallback", () => {
    function computeValidHash(
      basketId: string,
      key: string,
      merchantId: string,
      errCode: string,
    ): string {
      return crypto
        .createHash("sha256")
        .update(`${basketId}|${key}|${merchantId}|${errCode}`)
        .digest("hex");
    }

    it("throws when basket_id or err_code is missing", () => {
      expect(() =>
        validatePayFastCallback({
          basket_id: "",
          err_code: "00",
        }),
      ).toThrow("Missing required callback parameters");
    });

    it("validates authentic callback hash in production", () => {
      const basketId = "BASKET-12345";
      const errCode = "00";
      const validHash = computeValidHash(
        basketId,
        TEST_SECURED_KEY,
        TEST_MERCHANT_ID,
        errCode,
      );

      const result = validatePayFastCallback({
        basket_id: basketId,
        err_code: errCode,
        validation_hash: validHash,
      });

      expect(result.isValid).toBe(true);
      expect(result.basketId).toBe(basketId);
      expect(result.errorCode).toBe(errCode);
      expect(result.sandboxBypass).toBe(false);
    });

    it("rejects forged or tampered hash in production", () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const result = validatePayFastCallback({
        basket_id: "BASKET-12345",
        err_code: "00",
        validation_hash: "tampered_fake_hash_12345",
      });

      expect(result.isValid).toBe(false);
      expect(result.sandboxBypass).toBe(false);
      consoleErrorSpy.mockRestore();
    });

    it("supports case-insensitive hash parameter variations (e.g., Response_Hash)", () => {
      const basketId = "BASKET-789";
      const errCode = "00";
      const validHash = computeValidHash(
        basketId,
        TEST_SECURED_KEY,
        TEST_MERCHANT_ID,
        errCode,
      );

      const result = validatePayFastCallback({
        basket_id: basketId,
        err_code: errCode,
        Response_Hash: validHash,
      });

      expect(result.isValid).toBe(true);
    });
  });
});
