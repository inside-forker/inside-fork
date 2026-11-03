import {
  computeParchiDiscount,
  describeParchiOffer,
  tierStudentPrice,
  tiersStudentDiscount,
  tiersHeadlineOffer,
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

  describe("per-tier student pricing (event Parchi toggle)", () => {
    // Prismfest '26 tiers: price -> parchi_price.
    const tiers = [
      { price: 6000, parchi_price: 2999 }, // Prism Fam
      { price: 6000, parchi_price: 4800 }, // Prism Her
      { price: 12000, parchi_price: 5999 }, // Prism Front
      { price: 16000, parchi_price: 9999 }, // Prism Exclusive
    ];

    it("uses parchi_price only when it is below the price", () => {
      expect(tierStudentPrice({ price: 6000, parchi_price: 2999 })).toBe(2999);
      expect(tierStudentPrice({ price: 6000, parchi_price: 6000 })).toBeNull();
      expect(tierStudentPrice({ price: 6000, parchi_price: null })).toBeNull();
      expect(tierStudentPrice({ price: 6000 })).toBeNull();
    });

    it("sums rupees off per tier times quantity", () => {
      expect(
        tiersStudentDiscount([
          { ...tiers[0], quantity: 2 },
          { ...tiers[1], quantity: 1 },
          { price: 1000, parchi_price: null, quantity: 3 },
        ]),
      ).toBe(3001 * 2 + 1200);
    });

    it("headlines the biggest % off across tiers", () => {
      expect(tiersHeadlineOffer(tiers)).toEqual({
        discount_type: "percentage",
        discount_value: 50,
        max_discount_amount: null,
      });
      expect(tiersHeadlineOffer([{ price: 1000, parchi_price: null }])).toBeNull();
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

