export type FindingForTicket = {
  id: string;
  title: string;
  description: string;
  department: string;
  severity: string;
  related_label?: string | null;
  related_table?: string | null;
  related_id?: string | null;
  amount?: number | string | null;
  finding_type?: string | null;
};

/** Data Health masle se support ticket ka title/description/priority. */
export function buildAssistantTicket(f: FindingForTicket, note?: string) {
  const label = f.related_label ? ` — ${f.related_label}` : "";
  const title = `Data Health: ${f.title}${label}`.slice(0, 160);
  const lines = [
    `Data Health masla (${f.department}, ${f.severity}).`,
    f.description,
    f.amount != null ? `Raqam: Rs ${Number(f.amount).toLocaleString()}` : "",
    f.related_table ? `Record: ${f.related_table}${f.related_id ? ` / ${f.related_id}` : ""}` : "",
    f.finding_type ? `Qisam: ${f.finding_type}` : "",
    `Finding id: ${f.id}`,
    note?.trim() ? `Note: ${note.trim()}` : "",
    "Data badalne se pehle Owner ki approval zaroori hai.",
  ].filter(Boolean);
  const description = lines.join("\n").slice(0, 5000);
  const priority = f.severity === "high" ? "urgent" : "normal";
  return { title: title.length < 3 ? "Data Health masla" : title, description, priority } as const;
}

/** Ticket status se row ka pill. */
export function assistantPill(ticketStatus?: string | null, assignmentStatus?: string | null) {
  if (ticketStatus === "resolved" || assignmentStatus === "completed") return { kind: "done", text: "Assistant ne hal kar diya" } as const;
  if (ticketStatus === "investigating" || ticketStatus === "testing" || assignmentStatus === "working") return { kind: "working", text: "Assistant kaam kar raha hai" } as const;
  return { kind: "sent", text: "Assistant ko bheja gaya" } as const;
}
