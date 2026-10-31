import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function NewHandoverRedirect({ searchParams }: { searchParams?: { date?: string; destination?: string } }) {
  const destination = searchParams?.destination === "vendor" || searchParams?.destination === "party" ? searchParams.destination : "company";
  const date = searchParams?.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? `?date=${searchParams.date}` : "";
  redirect(`/admin/milk-collection/handover/${destination}/new${date}`);
}
