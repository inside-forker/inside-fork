import { query } from "@/lib/db";

export type GateAssignmentMode = "manual" | "auto";

/**
 * Resolve which gate/device index to stamp on newly issued ticket passes.
 *
 * - `manual`: return null — admin assigns later from the Accounts console.
 * - `auto`: least-loaded gate among configured slots (single scanner => 0).
 */
export async function resolveAssignedGateIndex(
  eventId: number,
): Promise<number | null> {
  const { rows } = await query(
    `SELECT scanning_mode,
            total_gates,
            COALESCE(gate_assignment_mode, 'manual') AS gate_assignment_mode
     FROM public.events
     WHERE id = $1
     LIMIT 1`,
    [eventId],
  );

  if (rows.length === 0) return null;

  const assignmentMode: GateAssignmentMode =
    rows[0].gate_assignment_mode === "auto" ? "auto" : "manual";
  if (assignmentMode !== "auto") return null;

  const scanningMode = rows[0].scanning_mode || "single";
  const totalGates =
    scanningMode === "multi_gate" && Number(rows[0].total_gates) > 1
      ? Number(rows[0].total_gates)
      : 1;

  if (totalGates <= 1) return 0;

  const { rows: gateLoadRows } = await query(
    `SELECT assigned_gate_index, COUNT(*)::int AS count
     FROM public.ticket_passes
     WHERE event_id = $1
       AND status != 'revoked'
       AND assigned_gate_index IS NOT NULL
     GROUP BY assigned_gate_index`,
    [eventId],
  );

  const loadMap: Record<number, number> = {};
  for (let g = 0; g < totalGates; g++) loadMap[g] = 0;
  gateLoadRows.forEach((r) => {
    const idx = Number(r.assigned_gate_index);
    if (idx >= 0 && idx < totalGates) loadMap[idx] = Number(r.count);
  });

  let minGate = 0;
  let minCount = loadMap[0];
  for (let g = 1; g < totalGates; g++) {
    if (loadMap[g] < minCount) {
      minCount = loadMap[g];
      minGate = g;
    }
  }

  return minGate;
}
