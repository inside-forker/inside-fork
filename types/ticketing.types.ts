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
  assigned_gate_index?: number | null;
  gate_label?: string | null;
}

export interface BookingStatusPayload {
  booking_id: number;
  booking_reference: string | null;
  payment_status: BookingRow["payment_status"];
  total_amount: number;
  passes?: PublicPass[];
}
