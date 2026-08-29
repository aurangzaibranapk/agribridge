"use client";
import { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { Search, RotateCcw, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { returnPosSale, setAuthCode, type ReturnState } from "@/actions/pos-returns";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input, Label, Textarea } from "@/components/ui/form";

const initialState: ReturnState = {};

interface FoundSale {
  id: string;
  createdAt: string;
  total: number;
  cash: number;
  khata: number;
  status: string;
  items: { name: string; quantity: number; unitPrice: number }[];
}

export function ReturnsClient({
  canHoldCode,
  hasCode,
  myName,
  myId,
}: {
  canHoldCode: boolean;
  hasCode: boolean;
  myName: string;
  myId: string;
}) {
  const [state, formAction] = useFormState(returnPosSale, initialState);
  const [codeState, codeAction] = useFormState(setAuthCode, initialState);

  const [query, setQuery] = useState("");
  const [sale, setSale] = useState<FoundSale | null>(null);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  /**
   * Bikri dhoondna. Raseed ka number nahi hota -- POS bikri ki apni id
   * deta hai, aur wohi raseed par chhapti hai. Is liye yahan wohi id
   * maangi jati hai, ya us ka aakhri hissa (jo parhne mein aasan hai).
   */
  function lookup() {
    setLookupMsg(null);
    setSale(null);
    const q = query.trim();
    if (q.length < 4) {
      setLookupMsg("Raseed ka number likhein (kam az kam char harf).");
      return;
    }

    start(async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("pos_sales")
        .select("id, created_at, total_amount, cash_paid, khata_amount, status, pos_sale_items(quantity, unit_price, products(name))")
        .ilike("id", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        setLookupMsg("Ye bikri nahi mili. Raseed ka number dobara dekh lein.");
        return;
      }

      setSale({
        id: data.id,
        createdAt: data.created_at,
        total: Number(data.total_amount),
        cash: Number(data.cash_paid ?? 0),
        khata: Number(data.khata_amount ?? 0),
        status: data.status,
        items: (data.pos_sale_items ?? []).map((i: any) => ({
          name: i.products?.name ?? "—",
          quantity: Number(i.quantity),
          unitPrice: Number(i.unit_price),
        })),
      });
    });
  }

  return (
    <div className="space-y-4">
      {canHoldCode && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-brand-600" />
            <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
              Aap ka code {hasCode ? <Badge tone="green">laga hua hai</Badge> : <Badge tone="red">abhi nahi laga</Badge>}
            </h2>
          </div>
          <p className="text-sm text-surface-600 dark:text-surface-300">
            Ye code counter par wapsi bhejne ke liye chahiye hota hai. {myName} — har wapsi aap ke naam par darj hoti
            hai, is liye ise kisi ko na batayein. Bhool jayen to naya banana paRta hai; purana kisi ko nazar nahi aata.
          </p>
          {codeState.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{codeState.error}</p>}
          {codeState.notice && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{codeState.notice}</p>
          )}
          <form action={codeAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="profile_id" value={myId} />
            <div>
              <Label>Naya code</Label>
              <Input name="code" type="password" inputMode="numeric" autoComplete="new-password" placeholder="****" />
            </div>
            <div>
              <Label>Dobara likhein</Label>
              <Input name="code_again" type="password" inputMode="numeric" autoComplete="new-password" placeholder="****" />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              {hasCode ? "Code badlein" : "Code lagayein"}
            </Button>
          </form>
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-brand-600" />
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">Wapsi karein</h2>
        </div>

        <div>
          <Label>Raseed ka number</Label>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  lookup();
                }
              }}
              placeholder="raseed par chhapa hua number"
            />
            <Button type="button" variant="secondary" onClick={lookup} disabled={pending}>
              <Search className="h-4 w-4" /> {pending ? "Dhoond raha hai..." : "Dhoondein"}
            </Button>
          </div>
          {lookupMsg && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{lookupMsg}</p>}
        </div>

        {sale && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 dark:border-brand-900/40 dark:bg-brand-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-surface-600 dark:text-surface-300">
                {new Date(sale.createdAt).toLocaleString()}
              </p>
              <Badge tone={sale.status === "completed" ? "green" : "red"}>
                {sale.status === "completed" ? "Wapsi ho sakti hai" : `Pehle hi ${sale.status}`}
              </Badge>
            </div>
            <ul className="mt-2 space-y-0.5 text-sm">
              {sale.items.map((i, n) => (
                <li key={n} className="text-surface-800 dark:text-surface-100">
                  {i.name} — {i.quantity} × Rs {i.unitPrice.toLocaleString()}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm font-medium text-surface-900 dark:text-surface-100">
              Kul Rs {sale.total.toLocaleString()}
              {sale.khata > 0 && ` (khata Rs ${sale.khata.toLocaleString()})`}
            </p>
            <p className="mt-1 text-xs text-surface-500">
              Poori bikri wapas hoti hai — kuch cheezein alag se nahi. Paisa usi tarah wapas jayega jis tarah aaya tha.
            </p>
          </div>
        )}

        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        {state.success && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Wapsi ho gayi — {state.returnNumber}. {state.notice ?? "Maal godam mein wapas aa gaya aur paisa gahak ko ja chuka hai."}
          </p>
        )}

        {sale && sale.status === "completed" && (
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="sale_id" value={sale.id} />
            <div>
              <Label>Wapsi ki wajah *</Label>
              <Textarea name="reason" rows={2} placeholder="Gahak ko doosri khaad chahiye thi..." />
              <p className="mt-1 text-xs text-surface-500">Ye wajah hamesha darj rahegi.</p>
            </div>
            <div>
              <Label>Manager ka code *</Label>
              <Input name="manager_code" type="password" inputMode="numeric" autoComplete="off" placeholder="****" />
              <p className="mt-1 text-xs text-surface-500">
                Code ke baghair wapsi nahi hoti. Ghalat code ki har koshish darj hoti hai.
              </p>
            </div>
            <Button type="submit">Wapsi karein</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
