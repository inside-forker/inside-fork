import {
  normalizePeoplePerTicket,
  normalizeMinPeople,
  sanitizeAttendeeFields,
  mergeAttendeeFields,
  collectOrderFields,
  personFields,
  attendeeFieldError,
  collectAnswers,
  groupPosition,
  passAttendeeInfo,
  MAX_PEOPLE_PER_TICKET,
  type AttendeeField,
} from "@/lib/ticketing/attendee-fields";

describe("Attendee Fields & Group Tickets", () => {
  describe("normalizePeoplePerTicket", () => {
    it("returns parsed integer for valid counts", () => {
      expect(normalizePeoplePerTicket(4)).toBe(4);
      expect(normalizePeoplePerTicket("3")).toBe(3);
    });

    it("clamps invalid or sub-1 counts to 1", () => {
      expect(normalizePeoplePerTicket(0)).toBe(1);
      expect(normalizePeoplePerTicket(-5)).toBe(1);
      expect(normalizePeoplePerTicket("invalid")).toBe(1);
      expect(normalizePeoplePerTicket(null)).toBe(1);
    });

    it("clamps counts above MAX_PEOPLE_PER_TICKET", () => {
      expect(normalizePeoplePerTicket(50)).toBe(MAX_PEOPLE_PER_TICKET);
    });
  });

  describe("normalizeMinPeople", () => {
    it("returns max when min is null, undefined, or empty", () => {
      expect(normalizeMinPeople(null, 5)).toBe(5);
      expect(normalizeMinPeople(undefined, 3)).toBe(3);
      expect(normalizeMinPeople("", 4)).toBe(4);
      expect(normalizeMinPeople("junk", 4)).toBe(4);
    });

    it("clamps within 1 and max", () => {
      expect(normalizeMinPeople(2, 5)).toBe(2);
      expect(normalizeMinPeople(0, 5)).toBe(1);
      expect(normalizeMinPeople(10, 5)).toBe(5);
    });
  });

  describe("sanitizeAttendeeFields", () => {
    it("returns empty array for non-array input", () => {
      expect(sanitizeAttendeeFields(null)).toEqual([]);
      expect(sanitizeAttendeeFields("abc")).toEqual([]);
    });

    it("drops entries without a label", () => {
      const raw = [{ id: "f1", label: "   " }, { id: "f2", label: "CNIC" }];
      const result = sanitizeAttendeeFields(raw);
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("CNIC");
    });

    it("generates an id if none provided or if duplicate id found", () => {
      const raw = [
        { id: "dup", label: "Field 1" },
        { id: "dup", label: "Field 2" },
      ];
      const result = sanitizeAttendeeFields(raw);
      expect(result[0].id).toBe("dup");
      expect(result[1].id).not.toBe("dup");
      expect(result[1].id.startsWith("f_")).toBe(true);
    });

    it("converts select without options to text", () => {
      const raw = [{ label: "Choice", type: "select", options: [] }];
      const result = sanitizeAttendeeFields(raw);
      expect(result[0].type).toBe("text");
    });

    it("preserves valid options for select fields", () => {
      const raw = [
        {
          label: "T-Shirt Size",
          type: "select",
          options: ["S", "M", "L", "XL", "M"],
        },
      ];
      const result = sanitizeAttendeeFields(raw);
      expect(result[0].type).toBe("select");
      // Deduplicates "M"
      expect(result[0].options).toEqual(["S", "M", "L", "XL"]);
    });
  });

  describe("mergeAttendeeFields", () => {
    it("combines event and ticket fields and prevents duplicates by label", () => {
      const eventFields = [{ id: "e1", label: "CNIC", type: "text", required: true, scope: "person" }];
      const ticketFields = [
        { id: "t1", label: "cnic", type: "text", required: false, scope: "person" }, // Duplicate (case insensitive)
        { id: "t2", label: "Student ID", type: "text", required: true, scope: "person" },
      ];
      const merged = mergeAttendeeFields(eventFields, ticketFields);
      expect(merged).toHaveLength(2);
      expect(merged.map((f) => f.label)).toEqual(["CNIC", "Student ID"]);
    });
  });

  describe("collectOrderFields and personFields", () => {
    const fields: AttendeeField[] = [
      { id: "1", label: "Delivery Address", type: "text", required: true, scope: "order" },
      { id: "2", label: "Emergency Contact", type: "phone", required: true, scope: "person" },
      { id: "3", label: "Delivery Address", type: "text", required: true, scope: "order" }, // duplicate label
    ];

    it("collects unique order-level fields", () => {
      const orderFields = collectOrderFields([fields]);
      expect(orderFields).toHaveLength(1);
      expect(orderFields[0].label).toBe("Delivery Address");
    });

    it("filters person-level fields", () => {
      const pFields = personFields(fields);
      expect(pFields).toHaveLength(1);
      expect(pFields[0].label).toBe("Emergency Contact");
    });
  });

  describe("attendeeFieldError", () => {
    const textField: AttendeeField = {
      id: "f1",
      label: "Full Name",
      type: "text",
      required: true,
      scope: "person",
    };
    const emailField: AttendeeField = {
      id: "f2",
      label: "Work Email",
      type: "email",
      required: true,
      scope: "person",
    };
    const phoneField: AttendeeField = {
      id: "f3",
      label: "Mobile Number",
      type: "phone",
      required: true,
      scope: "person",
    };
    const selectField: AttendeeField = {
      id: "f4",
      label: "Meal Preference",
      type: "select",
      options: ["Veg", "Non-Veg"],
      required: true,
      scope: "person",
    };

    it("validates required fields", () => {
      expect(attendeeFieldError(textField, "")).toBe("Full Name is required");
      expect(attendeeFieldError(textField, "   ")).toBe("Full Name is required");
      expect(attendeeFieldError(textField, undefined)).toBe("Full Name is required");
      expect(attendeeFieldError({ ...textField, required: false }, "")).toBeNull();
    });

    it("validates email formatting", () => {
      expect(attendeeFieldError(emailField, "invalid-email")).toBe("Enter a valid work email");
      expect(attendeeFieldError(emailField, "user@example.com")).toBeNull();
    });

    it("validates phone numbers (at least 10 digits)", () => {
      expect(attendeeFieldError(phoneField, "12345")).toBe("Enter a valid mobile number");
      expect(attendeeFieldError(phoneField, "0300-1234567")).toBeNull();
    });

    it("validates select options", () => {
      expect(attendeeFieldError(selectField, "Fish")).toBe("Pick a meal preference");
      expect(attendeeFieldError(selectField, "Veg")).toBeNull();
    });
  });

  describe("collectAnswers", () => {
    const fields: AttendeeField[] = [
      { id: "name", label: "Name", type: "text", required: true, scope: "person" },
      { id: "age", label: "Age", type: "number", required: false, scope: "person" },
    ];

    it("successfully collects valid answers", () => {
      const answers = collectAnswers(fields, { name: "Ali", age: "25" });
      expect(answers).toEqual([
        { field_id: "name", label: "Name", value: "Ali" },
        { field_id: "age", label: "Age", value: "25" },
      ]);
    });

    it("throws an error when a required field is missing, including who prefix", () => {
      expect(() => {
        collectAnswers(fields, { age: "25" }, "Ticket 1, person 2");
      }).toThrow("Ticket 1, person 2: Name is required");
    });
  });

  describe("groupPosition and passAttendeeInfo", () => {
    it("computes 1-based ticket and person slot indices correctly", () => {
      // 3 people per ticket
      // index 0 -> Ticket 1, Person 1 of 3
      expect(groupPosition(0, 3)).toEqual({ ticket: 1, person: 1, size: 3 });
      // index 2 -> Ticket 1, Person 3 of 3
      expect(groupPosition(2, 3)).toEqual({ ticket: 1, person: 3, size: 3 });
      // index 3 -> Ticket 2, Person 1 of 3
      expect(groupPosition(3, 3)).toEqual({ ticket: 2, person: 1, size: 3 });
    });

    it("merges holder answers with order answers in passAttendeeInfo", () => {
      const metadata = {
        answers: [{ field_id: "p1", label: "ID", value: "123" }],
        group: { ticket: 1, person: 1, size: 2 },
      };
      const bookingDetails = {
        order: [{ field_id: "o1", label: "Company", value: "Acme Corp" }],
        holders: {},
      };
      const info = passAttendeeInfo(metadata, bookingDetails);
      expect(info.answers).toHaveLength(2);
      expect(info.answers[0].value).toBe("123");
      expect(info.answers[1].value).toBe("Acme Corp");
      expect(info.group).toEqual({ ticket: 1, person: 1, size: 2 });
    });
  });
});

