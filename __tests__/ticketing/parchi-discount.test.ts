import {
  computeParchiDiscount,
  describeParchiOffer,
  resolveStudentOffer,
  PRISMFEST_FALLBACK_OFFER,
  type ParchiOffer,
} from "@/lib/parchi/discount";

describe("Parchi Discount Calculation", () => {
  describe("computeParchiDiscount", () => {
    it("calculates percentage discount accurately", () => {
      const offer: ParchiOffer = {
        discount_type: "percentage",
        discount_value: 20,
        max_discount_amount: null,
      };
      // 20% of 1500 = 300
      expect(computeParchiDiscount(offer, 1500)).toBe(300);
    });

    it("respects max_discount_amount cap for percentage discounts", () => {
      const offer: ParchiOffer = {
        discount_type: "percentage",
        discount_value: 50,
        max_discount_amount: 500,
      };
      // 50% of 2000 is 1000, capped at 500
      expect(computeParchiDiscount(offer, 2000)).toBe(500);

      // 50% of 600 is 300, which is below the 500 cap
      expect(computeParchiDiscount(offer, 600)).toBe(300);
    });

    it("calculates fixed discount accurately", () => {
      const offer: ParchiOffer = {
        discount_type: "fixed",
        discount_value: 400,
        max_discount_amount: null,
      };
      expect(computeParchiDiscount(offer, 1000)).toBe(400);
    });

    it("never lets discount exceed subtotal", () => {
      const offer: ParchiOffer = {
        discount_type: "fixed",
        discount_value: 1500,
        max_discount_amount: null,
      };
      // Subtotal is only 1000, discount cannot exceed 1000
      expect(computeParchiDiscount(offer, 1000)).toBe(1000);
    });

    it("handles zero or sub-zero subtotals safely", () => {
      const offer: ParchiOffer = {
        discount_type: "percentage",
        discount_value: 25,
        max_discount_amount: null,
      };
      expect(computeParchiDiscount(offer, 0)).toBe(0);
    });

    it("rounds percentage calculations to 2 decimal places properly", () => {
      const offer: ParchiOffer = {
        discount_type: "percentage",
        discount_value: 15,
        max_discount_amount: null,
      };
      // 15% of 333 = 49.95
      expect(computeParchiDiscount(offer, 333)).toBe(49.95);
    });
  });

  describe("resolveStudentOffer", () => {
    it("returns active offer when provided", () => {
      const customOffer: ParchiOffer = {
        discount_type: "percentage",
        discount_value: 30,
        max_discount_amount: 1000,
      };
      expect(resolveStudentOffer(customOffer)).toEqual(customOffer);
    });

    it("falls back to PRISMFEST_FALLBACK_OFFER when offer is null or undefined", () => {
      expect(resolveStudentOffer(null)).toEqual(PRISMFEST_FALLBACK_OFFER);
      expect(resolveStudentOffer(undefined)).toEqual(PRISMFEST_FALLBACK_OFFER);
      expect(PRISMFEST_FALLBACK_OFFER.discount_value).toBe(50);
      expect(PRISMFEST_FALLBACK_OFFER.discount_type).toBe("percentage");
    });
  });

  describe("describeParchiOffer", () => {
    it("formats percentage discount without cap", () => {
      const offer: ParchiOffer = {
        discount_type: "percentage",
        discount_value: 20,
        max_discount_amount: null,
      };
      expect(describeParchiOffer(offer)).toBe("20% off");
    });

    it("formats percentage discount with max cap", () => {
      const offer: ParchiOffer = {
        discount_type: "percentage",
        discount_value: 25,
        max_discount_amount: 1000,
      };
      expect(describeParchiOffer(offer)).toBe("25% off (up to PKR 1,000)");
    });

    it("formats fixed discount", () => {
      const offer: ParchiOffer = {
        discount_type: "fixed",
        discount_value: 500,
        max_discount_amount: null,
      };
      expect(describeParchiOffer(offer)).toBe("PKR 500 off");
    });
  });
});

