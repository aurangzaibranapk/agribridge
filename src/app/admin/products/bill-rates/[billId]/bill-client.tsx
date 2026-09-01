"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, Save, Search, Trash2, TrendingUp } from "lucide-react";
import {
  applyBillRates,
  saveBillLine,
  skipBillLine,
  type BillRateState,
} from "@/actions/supplier-bill-rates";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input, Label } from "@/components/ui/form";

const initial: BillRateState = {};

interface Line {
  id: string;
  lineNo: number | null;
  rawText: string | null;
  itemName: string | null;
  packSize: string | null;
  qty: number | null;
  rate: number | null;
  lineTotal: number | null;
  productId: string | null;
  matchSource: string | null;
  status: string;
  problem: string | null;
  appliedRate: number | null;
}

interface Product {
  id: string;
  name: string;
  packSize: string | null;
  purchasePrice: number;
  ratePending: boolean;
}

function Submit({ label, icon, variant }: { label: string; icon?: React.ReactNode; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant}>
      <span className="inline-flex items-center gap-1.5">
        {icon} {pending ? "…" : label}
      </span>
    </Button>
  );
}

function Msg({ state }: { state: BillRateState }) {
  if (state.error) return <p className="mt-2 text-sm text-red-700">{state.error}</p>;
  if (state.notice) return <p className="mt-2 text-sm text-emerald-700">{state.notice}</p>;
  return null;
}

/**
 * Product chunne ka khana.
 *
 * Poori fehrist ek select mein daalna aasan tha, magar hazaar products
 * mein se sahi wala dhoondna wahan haath se hota hai -- aur jaldi mein
 * upar neeche wala chun liya jata hai. Yahan likh kar dhoondte hain,
 * aur chuna hua naam saamne likha rehta hai.
 */
function ProductPicker({
  name,
  products,
  defaultId,
  disabled,
}: {
  name: string;
  products: Product[];
  defaultId: string | null;
  disabled?: boolean;
}) {
  const [chosen, setChosen] = useState<string | null>(defaultId);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const chosenProduct = useMemo(() => products.find((p) => p.id === chosen) ?? null, [products, chosen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => `${p.name} ${p.packSize ?? ""}`.toLowerCase().includes(q))
      .slice(0, 25);
  }, [products, query]);

  return (
    <div>
      <input type="hidden" name={name} value={chosen ?? ""} />

      {chosenProduct ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="text-base font-medium text-emerald-900">
            {chosenProduct.name}
            {chosenProduct.packSize ? ` · ${chosenProduct.packSize}` : ""}
          </span>
          <span className="text-xs text-emerald-800">
            {chosenProduct.ratePending
              ? "trade rate abhi tak nahi tha"
              : `abhi ka trade rate Rs ${chosenProduct.purchasePrice.toLocaleString()}`}
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={() => {
                setChosen(null);
                setOpen(true);
              }}
              className="ml-auto text-xs text-emerald-800 underline"
            >
              badlein
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-center gap-2 rounded-lg border border-surface-300 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-surface-400" />
            <input
              type="text"
              value={query}
              disabled={disabled}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              placeholder="Product ka naam likhein…"
              className="w-full border-0 bg-transparent p-0 text-base outline-none placeholder:text-surface-400"
            />
          </div>

          {open && results.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-surface-200 bg-white shadow-lg">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(p.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left hover:bg-surface-50"
                  >
                    <span className="text-sm font-medium">{p.name}</span>
                    {p.packSize && <span className="text-xs text-surface-500">{p.packSize}</span>}
                    <span className="ml-auto text-xs text-surface-500">
                      {p.ratePending ? "rate baqi" : `Rs ${p.purchasePrice.toLocaleString()}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {open && query.trim().length > 1 && results.length === 0 && (
            <p className="mt-1 text-xs text-surface-500">
              Is naam ka koi product nahi mila. Pehle product banayein, phir yahan chunein.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LineRow({ line, products, billDone }: { line: Line; products: Product[]; billDone: boolean }) {
  const [saveState, saveAction] = useFormState(saveBillLine, initial);
  const [skipState, skipAction] = useFormState(skipBillLine, initial);

  const applied = line.status === "applied";
  const locked = applied || billDone;

  return (
    <Card className={applied ? "border-emerald-200" : line.status === "ready" ? "border-amber-200" : undefined}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-surface-400">#{line.lineNo ?? "—"}</span>
        {/* Bill par jo likha tha, jyun ka tyun. Ye kabhi nahi badalta --
            baad mein "AI ne kya parha tha" ka jawab isi se milta hai. */}
        <span className="rounded bg-surface-100 px-2 py-0.5 font-mono text-xs text-surface-700">
          {line.rawText ?? "—"}
        </span>
        <span className="ml-auto">
          {applied ? (
            <Badge tone="green">charh gaya · Rs {line.appliedRate?.toLocaleString()}</Badge>
          ) : line.status === "ready" ? (
            <Badge tone="amber">tayyar</Badge>
          ) : (
            <Badge tone="gray">dekhna baqi</Badge>
          )}
        </span>
      </div>

      {line.problem && (
        <p className="mb-2 flex items-start gap-1.5 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {line.problem}
        </p>
      )}

      <form action={saveAction} className="space-y-3">
        <input type="hidden" name="line_id" value={line.id} />

        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Label htmlFor={`nm-${line.id}`}>Bill par ye cheez</Label>
            <Input
              id={`nm-${line.id}`}
              name="item_name"
              defaultValue={line.itemName ?? ""}
              disabled={locked}
              className="text-base"
            />
          </div>
          <div>
            <Label htmlFor={`qt-${line.id}`}>Kitne aaye</Label>
            <Input
              id={`qt-${line.id}`}
              name="qty"
              type="number"
              step="0.001"
              min="0"
              defaultValue={line.qty ?? ""}
              disabled={locked}
              className="text-base"
            />
          </div>
          <div>
            <Label htmlFor={`rt-${line.id}`}>Trade rate (ek ka)</Label>
            <Input
              id={`rt-${line.id}`}
              name="rate"
              type="number"
              step="0.01"
              min="0"
              defaultValue={line.rate ?? ""}
              disabled={locked}
              placeholder="bill par saaf nahi tha"
              className="text-base"
            />
            {line.rate == null && !applied && (
              <p className="mt-1 text-xs text-amber-700">
                Bill par ye rate saaf nahi tha — khud dekh kar likhein. Khali chhoRna sifar likhne se behtar hai.
              </p>
            )}
          </div>
        </div>

        <div>
          <Label>Hamara kaun sa product</Label>
          <ProductPicker name="product_id" products={products} defaultId={line.productId} disabled={locked} />
          {line.matchSource === "auto_name" && !applied && (
            <p className="mt-1 text-xs text-amber-700">
              Ye naam se apne aap mila hai — charhane se pehle ek dafa dekh lein.
            </p>
          )}
        </div>

        {!locked && (
          <div className="flex flex-wrap items-center gap-2">
            <Submit label="Mehfooz karein" icon={<Save className="h-4 w-4" />} variant="secondary" />
            <span className="text-xs text-surface-500">
              {line.lineTotal != null && `bill par is qatar ka Rs ${line.lineTotal.toLocaleString()}`}
            </span>
          </div>
        )}
      </form>

      {!locked && (
        <form action={skipAction} className="mt-2">
          <input type="hidden" name="line_id" value={line.id} />
          <Submit label="Ye qatar chhoR dein" icon={<Trash2 className="h-4 w-4" />} variant="secondary" />
        </form>
      )}

      <Msg state={saveState} />
      <Msg state={skipState} />
    </Card>
  );
}

export function BillClient({
  billId,
  billStatus,
  billImageUrl,
  billTotal,
  linesTotal,
  aiRead,
  lines,
  products,
}: {
  billId: string;
  billStatus: string;
  billImageUrl: string;
  billTotal: number | null;
  linesTotal: number;
  aiRead: boolean;
  lines: Line[];
  products: Product[];
}) {
  const [applyState, applyAction] = useFormState(applyBillRates, initial);
  const [showBill, setShowBill] = useState(true);

  const done = billStatus === "applied";
  const ready = lines.filter((l) => l.status === "ready").length;
  const draft = lines.filter((l) => l.status === "draft").length;
  const applied = lines.filter((l) => l.status === "applied").length;

  // Rs 1 tak ka farq gol karne ka hota hai; us se zyada ka matlab hai
  // koi qatar chhoot gayi.
  const mismatch =
    billTotal != null && linesTotal > 0 && Math.abs(billTotal - linesTotal) > 1
      ? Math.abs(billTotal - linesTotal)
      : null;

  return (
    <div className="space-y-4">
      {!aiRead && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            Is bill ko AI parh nahi saki. Qatarein khali hain — ya to GEMINI_API_KEY nahi laga, ya tasveer saaf nahi
            thi. Rate haath se bhi likhe ja sakte hain.
          </p>
        </Card>
      )}

      {mismatch != null && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            Qataron ka jorh <strong>Rs {linesTotal.toLocaleString()}</strong> hai, aur bill par kul{" "}
            <strong>Rs {billTotal?.toLocaleString()}</strong> — Rs {mismatch.toLocaleString()} ka farq. Ho sakta hai koi
            qatar parhi na gayi ho, ya bill par discount/tax alag likha ho. Charhane se pehle dekh lein.
          </p>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-surface-600">
            {lines.length} qatarein · <strong className="text-emerald-700">{ready} tayyar</strong>
            {draft > 0 && ` · ${draft} dekhna baqi`}
            {applied > 0 && ` · ${applied} charh chuki`}
          </span>
          <button
            type="button"
            onClick={() => setShowBill((v) => !v)}
            className="text-xs text-surface-500 underline"
          >
            {showBill ? "bill ki photo chhupayein" : "bill ki photo dekhein"}
          </button>
        </div>

        {showBill && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={billImageUrl}
            alt="Supplier ka bill"
            className="mt-3 max-h-[28rem] w-full rounded-lg border border-surface-200 object-contain"
          />
        )}
      </Card>

      {lines.length === 0 ? (
        <Card>
          <p className="text-sm text-surface-500">Is bill par koi qatar nahi parhi gayi.</p>
        </Card>
      ) : (
        lines.map((line) => <LineRow key={line.id} line={line} products={products} billDone={done} />)
      )}

      {!done && ready > 0 && (
        <Card className="border-emerald-200 bg-emerald-50">
          <p className="mb-2 text-sm text-emerald-900">
            <strong>{ready}</strong> qatarein charhne ke liye tayyar hain. Charhne par in products ka trade rate badal
            jayega, aur purana rate indraj mein mehfooz ho jayega.
          </p>
          <form action={applyAction}>
            <input type="hidden" name="bill_id" value={billId} />
            <Submit label={`${ready} rate charhayein`} icon={<TrendingUp className="h-4 w-4" />} />
          </form>
          <Msg state={applyState} />
        </Card>
      )}

      {done && (
        <Card className="border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-900">
            Is bill ka kaam mukammal hai — {applied} products ka trade rate charh chuka hai.
          </p>
        </Card>
      )}
    </div>
  );
}
