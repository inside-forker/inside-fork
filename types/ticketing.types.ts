import { Database } from "./supabase";

export type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
export type TicketPassRow =
  Database["public"]["Tables"]["ticket_passes"]["Row"];

export interface PublicPass {
  id: number;
  booking_id: number;
  code?: string;
  status: TicketPassRow["status"];
  quantity_index: number;
  issued_at: string;
  ticket_type_id: number;
  guest_name?: string | null;
  cnic_last4?: string | null;
  ticket_type_name?: string | null;
  assigned_gate_index?: number | null;
  gate_label?: string | null;
}

/** Organizer PDF handed out from ticket_pdf_inventory (e.g. Ticketwala). */
export interface PublicPdfTicket {
  id: number;
  booking_id: number;
  ticket_type_id: number;
  ticket_type_name?: string | null;
  external_ticket_id: string;
  original_filename?: string | null;
  assigned_at: string;
  download_path: string;
}

export interface BookingStatusPayload {
  booking_id: number;
  booking_reference: string | null;
  payment_status: BookingRow["payment_status"];
  total_amount: number;
  passes?: PublicPass[];
}
