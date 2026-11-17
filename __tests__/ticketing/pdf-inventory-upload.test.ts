import { extractExternalId } from "@/lib/ticketing/pdf-inventory-upload";

describe("extractExternalId", () => {
  it("extracts 6+ trailing digits from Ticketwala filename", () => {
    expect(extractExternalId("002_Prism_Fam_2586389.pdf")).toBe("2586389");
    expect(extractExternalId("IVF_VIBE__STANDARD__12100406762.pdf")).toBe("12100406762");
  });

  it("returns null when filename lacks 6+ trailing digits", () => {
    expect(extractExternalId("ticket.pdf")).toBeNull();
    expect(extractExternalId("pass_1.pdf")).toBeNull();
    expect(extractExternalId("general_pass.pdf")).toBeNull();
  });
});

