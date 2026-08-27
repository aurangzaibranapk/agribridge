"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label, Badge } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { Wallet, Search, History } from "lucide-react";

interface KhataAccount {
  id: string;
  customer_id: string;
  current_balance: number;
  customer: { name: string; phone: string | null } | null;
}

interface Transaction {
  id: string;
  type: "debit" | "credit" | "payment";
  amount: number;
  note: string | null;
  created_at: string;
}

export function KhataClient({
  dealerName,
  accounts,
}: {
  dealerName: string;
  accounts: KhataAccount[];
}) {
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<KhataAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => a.customer?.name?.toLowerCase().includes(q));
  }, [accounts, search]);

  const totalOutstanding = useMemo(
    () => accounts.reduce((sum, a) => sum + (a.current_balance > 0 ? a.current_balance : 0), 0),
    [accounts]
  );

  async function loadTransactions(accountId: string) {
    setLoadingTx(true);
    const { data } = await supabase
      .from("khata_transactions")
      .select("id, type, amount, note, created_at")
      .eq("khata_account_id", accountId)
      .order("created_at", { ascending: false });
    setTransactions((data as Transaction[]) ?? []);
    setLoadingTx(false);
  }

  useEffect(() => {
    if (selected) {
      loadTransactions(selected.id);
      setMessage(null);
      setAmount("");
      setNote("");
    }
  }, [selected?.id]);

  async function handleRecordPayment() {
    if (!selected) return;
    setMessage(null);

    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      setMessage({ type: "error", text: "Enter a valid payment amount." });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.rpc("record_khata_payment", {
      p_customer_id: selected.customer_id,
      p_amount: parsed,
      p_note: note || null,
    });
    setSubmitting(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }

    setMessage({ type: "success", text: "Payment recorded successfully." });
    setAmount("");
    setNote("");
    // Refresh transaction history and balance locally
    await loadTransactions(selected.id);
    selected.current_balance = selected.current_balance - parsed;
    setSelected({ ...selected });
  }

  function typeLabel(type: Transaction["type"]) {
    if (type === "debit") return { text: "Sale (Udhaar)", tone: "red" as const };
    if (type === "payment") return { text: "Payment Received", tone: "green" as const };
    return { text: "Credit", tone: "blue" as const };
  }

  return (
    <div className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold text-surface-900 dark:text-white">
              {dealerName} — Khata
            </h1>
            <p className="mt-1 text-sm text-surface-500">
              Total Outstanding:{" "}
              <span className="font-semibold text-red-600">
                Rs {totalOutstanding.toLocaleString()}
              </span>
            </p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <Input
              placeholder="Search customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-4 py-3 font-medium text-surface-500">Customer</th>
                <th className="px-4 py-3 font-medium text-surface-500">Phone</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className={`cursor-pointer border-b border-surface-100 last:border-0 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800 ${
                    selected?.id === a.id ? "bg-brand-50 dark:bg-brand-950/30" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-surface-800 dark:text-surface-200">
                    {a.customer?.name ?? "Unknown"}
                  </td>
                  <td className="px-4 py-3 text-surface-500">{a.customer?.phone ?? "—"}</td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      a.current_balance > 0 ? "text-red-600" : "text-brand-600"
                    }`}
                  >
                    Rs {a.current_balance.toLocaleString()}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-surface-400">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-surface-500" />
              <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
                Transaction History — {selected.customer?.name}
              </h2>
            </div>

            {loadingTx ? (
              <p className="py-6 text-center text-sm text-surface-400">Loading...</p>
            ) : transactions.length === 0 ? (
              <p className="py-6 text-center text-sm text-surface-400">No transactions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-100 text-left dark:border-surface-800">
                      <th className="py-2 font-medium text-surface-500">Date</th>
                      <th className="py-2 font-medium text-surface-500">Type</th>
                      <th className="py-2 font-medium text-surface-500">Note</th>
                      <th className="py-2 text-right font-medium text-surface-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const label = typeLabel(tx.type);
                      return (
                        <tr key={tx.id} className="border-b border-surface-50 last:border-0 dark:border-surface-800">
                          <td className="py-2 text-surface-500">
                            {new Date(tx.created_at).toLocaleString("en-PK", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-2">
                            <Badge tone={label.tone}>{label.text}</Badge>
                          </td>
                          <td className="py-2 text-surface-500">{tx.note ?? "—"}</td>
                          <td
                            className={`py-2 text-right font-medium ${
                              tx.type === "payment" ? "text-brand-600" : "text-red-600"
                            }`}
                          >
                            {tx.type === "payment" ? "-" : "+"} Rs {tx.amount.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <Card className="flex h-fit flex-col gap-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-brand-600" />
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            Record Payment
          </h2>
        </div>

        {!selected ? (
          <p className="py-6 text-center text-sm text-surface-400">
            Select a customer from the list to record a payment.
          </p>
        ) : (
          <>
            <div className="rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
              <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                {selected.customer?.name}
              </p>
              <p className="text-xs text-surface-500">
                Current Balance: Rs {selected.current_balance.toLocaleString()}
              </p>
            </div>

            <div>
              <Label>Payment Amount</Label>
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <Label>Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Cash received" />
            </div>

            {message && (
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.type === "success"
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                    : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                }`}
              >
                {message.text}
              </div>
            )}

            <Button onClick={handleRecordPayment} disabled={submitting}>
              {submitting ? "Recording..." : "Record Payment"}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
