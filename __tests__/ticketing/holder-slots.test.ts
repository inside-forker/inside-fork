import {
  buildAttendeeDetails,
  type TicketAttendeeConfig,
} from "@/lib/ticketing/holder-slots";

describe("Holder Slots & Attendee Details Builder", () => {
  const mockConfig = new Map<number, TicketAttendeeConfig>([
    [
      101,
      {
        peoplePerTicket: 1,
        minPeople: 1,
        fields: [
          {
            id: "f_cnic",
            label: "CNIC",
            type: "text",
            required: true,
            scope: "person",
          },
        ],
      },
    ],
    [
      202,
      {
        // Group ticket: 3 people max, but minimum 2 required
        peoplePerTicket: 3,
        minPeople: 2,
        fields: [
          {
            id: "f_dept",
            label: "Department",
            type: "text",
            required: true,
            scope: "person",
          },
          {
            id: "f_company",
            label: "Company",
            type: "text",
            required: false,
            scope: "order",
          },
        ],
      },
    ],
  ]);

  it("returns null when no attendee data and no order answers are provided for empty cart", () => {
    const result = buildAttendeeDetails(
      [],
      mockConfig,
      () => undefined,
      {},
    );
    expect(result).toBeNull();
  });

  it("builds attendee details for single-person ticket with required fields", () => {
    const items = [{ ticket_type_id: 101, quantity: 1 }];
    const holders = {
      0: {
        name: "Test Attendee",
        cnic: "42101-0000000-1",
        answers: { f_cnic: "42101-0000000-1" },
      },
    };

    const result = buildAttendeeDetails(
      items,
      mockConfig,
      (_typeId, index) => holders[index as keyof typeof holders],
      {},
    );

    expect(result).not.toBeNull();
    expect(result?.holders["101"]).toHaveLength(1);
    expect(result?.holders["101"][0]).toEqual({
      name: "Test Attendee",
      cnic_last4: "0001",
      answers: [{ field_id: "f_cnic", label: "CNIC", value: "42101-0000000-1" }],
    });
  });

  it("throws when a required person field is missing on a required slot", () => {
    const items = [{ ticket_type_id: 101, quantity: 1 }];
    const holders = {
      0: {
        name: "Test Attendee",
        cnic: "42101-0000000-1",
        answers: { f_cnic: "" }, // Missing required answer
      },
    };

    expect(() => {
      buildAttendeeDetails(
        items,
        mockConfig,
        (_typeId, index) => holders[index as keyof typeof holders],
        {},
      );
    }).toThrow("Ticket 1: CNIC is required");
  });

  it("allows optional group attendees above minPeople to be empty (stores null)", () => {
    const items = [{ ticket_type_id: 202, quantity: 1 }];
    // Slot 0 (person 1, required): filled
    // Slot 1 (person 2, required): filled
    // Slot 2 (person 3, optional): empty
    const holders = {
      0: { name: "Person 1", answers: { f_dept: "Engineering" } },
      1: { name: "Person 2", answers: { f_dept: "Design" } },
      2: { name: "", answers: {} },
    };

    const result = buildAttendeeDetails(
      items,
      mockConfig,
      (_typeId, index) => holders[index as keyof typeof holders],
      { f_company: "Acme Corp" },
    );

    expect(result).not.toBeNull();
    const holderList = result?.holders["202"]!;
    expect(holderList).toHaveLength(3);
    expect(holderList[0]?.name).toBe("Person 1");
    expect(holderList[1]?.name).toBe("Person 2");
    expect(holderList[2]).toBeNull(); // Optional person left empty becomes null

    expect(result?.order).toEqual([
      { field_id: "f_company", label: "Company", value: "Acme Corp" },
    ]);
  });
});

