"use client";
import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { Button, Input, Label, Textarea, Badge } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { Plus, X } from "lucide-react";
import { saveCropLifter, toggleCropLifter, type LifterState } from "@/actions/crop-lifters";
import type { Lang } from "@/lib/i18n/translations";

interface Row {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string;
  cnic: string | null;
  village: string | null;
  address: string | null;
  commission_rate: number;
  is_active: boolean;
  notes: string | null;
  kattai: number;
  purana: number;
  commission: number;
  diya: number;
  baqi: number;
  bookings: number;
}

const empty: LifterState = {};

export function LiftersClient({ rows, lang }: { rows: Row[]; lang: Lang }) {
  const [editing, setEditing] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      {!adding && !editing && (
        <Button type="button" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Naya uthane wala
        </Button>
      )}

      {(adding || editing) && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
              {editing ? `${editing.name} — tafseel` : "Naya uthane wala"}
            </h2>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setEditing(null);
              }}
              className="text-surface-400 hover:text-surface-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <LifterForm
            row={editing}
            onDone={() => {
              setAdding(false);
              setEditing(null);
            }}
          />
        </Card>
      )}

      <div className="overflow-x-auto rounded-card border border-surface-200 dark:border-surface-800">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-surface-200 bg-surface-50 text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-900">
            <tr>
              <th className="px-3 py-2 text-left">Naam</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-right">Commission</th>
              <th className="px-3 py-2 text-right">Kattai ka zimma</th>
              <th className="px-3 py-2 text-right">Purana baqi</th>
              <th className="px-3 py-2 text-right">Commission bana</th>
              <th className="px-3 py-2 text-right">Baqi</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-surface-400">
                  Abhi koi uthane wala darj nahi.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                className={`border-b border-surface-100 last:border-0 dark:border-surface-800 ${
                  r.is_active ? "" : "opacity-50"
                }`}
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/machinery-rental/lifters/${r.id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    {r.name}
                  </Link>
                  {r.village && <p className="text-xs text-surface-400">{r.village}</p>}
                  {!r.is_active && <Badge tone="gray">Band</Badge>}
                </td>
                <td className="px-3 py-2 text-surface-600 dark:text-surface-300">{r.phone}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.commission_rate}%</td>
                {/* Teen sabab alag alag. "Kul baqi" ek adad ho to us se ye
                    poochha hi nahi ja sakta ke baat kis par karni hai. */}
                <td className="px-3 py-2 text-right tabular-nums text-surface-600 dark:text-surface-300">
                  {r.kattai ? `Rs ${r.kattai.toLocaleString()}` : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-surface-600 dark:text-surface-300">
                  {r.purana ? `Rs ${r.purana.toLocaleString()}` : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-green-700 dark:text-green-400">
                  {r.commission ? `Rs ${r.commission.toLocaleString()}` : "—"}
                </td>
                <td
                  className={`px-3 py-2 text-right font-medium tabular-nums ${
                    r.baqi > 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"
                  }`}
                >
                  Rs {r.baqi.toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(false);
                        setEditing(r);
                      }}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      Theek karein
                    </button>
                    <ToggleButton id={r.id} active={r.is_active} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LifterForm({ row, onDone }: { row: Row | null; onDone: () => void }) {
  const [state, action] = useFormState(saveCropLifter, empty);

  if (state.success) {
    return (
      <div className="space-y-2">
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{state.notice}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Theek hai
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {row && <input type="hidden" name="id" value={row.id} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Naam *</Label>
          <Input id="name" name="name" required defaultValue={row?.name ?? ""} placeholder="Misal: Haji Ashraf Arhti" />
        </div>
        <div>
          <Label htmlFor="phone">Phone *</Label>
          <Input id="phone" name="phone" required defaultValue={row?.phone ?? ""} placeholder="0300 1234567" />
          {/* Ek phone ek uthane wala -- wohi qanoon jo kisan (124) aur
              vendor (181) ka hai. Do ek jaise record ban jayen to un ke
              khate alag alag chalte hain aur dono adhoore hote hain. */}
          <p className="mt-1 text-xs text-surface-400">Isi se ye banda pehchana jata hai — ek phone par ek hi.</p>
        </div>
        <div>
          <Label htmlFor="contact_person">Raabte ka banda</Label>
          <Input id="contact_person" name="contact_person" defaultValue={row?.contact_person ?? ""} />
        </div>
        <div>
          <Label htmlFor="cnic">CNIC</Label>
          <Input id="cnic" name="cnic" defaultValue={row?.cnic ?? ""} />
        </div>
        <div>
          <Label htmlFor="village">Gaon</Label>
          <Input id="village" name="village" defaultValue={row?.village ?? ""} />
        </div>
        <div>
          <Label htmlFor="commission_rate">Hamara commission (%) *</Label>
          <Input
            id="commission_rate"
            name="commission_rate"
            type="number"
            step="0.01"
            required
            defaultValue={row?.commission_rate ?? ""}
            placeholder="2"
          />
          {/* Rate BANDE par rehta hai, booking par nahi -- wohi usool jo
              machinery ke commission ka hai (120). Har booking par alag
              likhne ka darwaza khula rakhte to ek hi bande ke do saudon
              par do rate ho jate. */}
          <p className="mt-1 text-xs text-surface-400">
            Fasal ki qeemat ka fisad — kattai ke bill ka nahi. Rate badla to purane saude apne purane rate par khare
            rahenge.
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="address">Pata</Label>
        <Input id="address" name="address" defaultValue={row?.address ?? ""} />
      </div>

      <div>
        <Label htmlFor="notes">Note</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={row?.notes ?? ""} />
      </div>

      <SaveBtn />
    </form>
  );
}

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Mehfooz ho raha hai..." : "Mehfooz karein"}
    </Button>
  );
}

function ToggleButton({ id, active }: { id: string; active: boolean }) {
  const [state, action] = useFormState(toggleCropLifter, empty);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "0" : "1"} />
      <button type="submit" className="text-xs font-medium text-surface-500 hover:text-surface-800 hover:underline">
        {active ? "Band karein" : "Chalu karein"}
      </button>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
