import { effectiveQuantitySql } from "@/lib/ticketing/sellable-quantity";

describe("Sellable Quantity Logic", () => {
  it("generates correct SQL expression with default table alias", () => {
    const sql = effectiveQuantitySql();
    expect(sql).toContain("WHERE i.ticket_type_id = tt.id");
    expect(sql).toContain("WHERE i.ticket_type_id = tt.id AND i.booking_id IS NULL");
    expect(sql).toContain("ELSE tt.quantity_available");
  });

  it("generates correct SQL expression with custom table alias", () => {
    const sql = effectiveQuantitySql("custom_alias");
    expect(sql).toContain("WHERE i.ticket_type_id = custom_alias.id");
    expect(sql).toContain("WHERE i.ticket_type_id = custom_alias.id AND i.booking_id IS NULL");
    expect(sql).toContain("ELSE custom_alias.quantity_available");
  });
});

