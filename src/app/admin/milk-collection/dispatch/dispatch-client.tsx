"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Truck, PackageCheck } from "lucide-react";
import { recordDispatch, recordReceipt, type DispatchState } from "@/actions/milk-dispatch";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: DispatchState = {};

interface Row {
  id: string;
  date: string;
  shift: string;
  chiller: string;
  vehicle: string | null;
  driver: string | null;
  sent: number;
  received: number | null;
  shortage: number | null;
  shortagePct: number | null;
}

export function DispatchClient({
  lang,
  branches,
  rows,
}: {
  lang: Lang;
  branches: { id: string; name: string }[];
  rows: Row[];
}) {
  const [sendState, sendAction] = useFormState(recordDispatch, initial);
  const [recvState, recvAction] = useFormState(recordReceipt, initial);
  const [open, setOpen] = useState(false);

  const waiting = rows.filter((r) => r.received === null);

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center justify-between border-b border-surface-100 pb-2 dark:border-surface-800">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            <Truck className="h-4 w-4 text-brand-600" /> {t("md_new", lang)}
          </h2>
          <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(!open)}>
            {t("md_record", lang)}
          </Button>
        </div>

        {sendState.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{sendState.error}</p>}
        {sendState.notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{sendState.notice}</p>}

        {open && (
          <form action={sendAction} className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("md_chiller", lang)} *</Label>
              <Select name="branch_id" defaultValue="">
                <option value="">—</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t("md_date", lang)}</Label>
              <Input type="date" name="dispatch_date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <Label>{t("md_shift", lang)}</Label>
              <Select name="shift" defaultValue="morning">
                <option value="morning">{t("md_morning", lang)}</option>
                <option value="evening">{t("md_evening", lang)}</option>
              </Select>
            </div>
            <div>
              <Label>{t("md_sent", lang)} *</Label>
              <Input type="number" step="0.001" name="dispatched_liters" />
            </div>
            <div>
              <Label>{t("md_vehicle", lang)}</Label>
              <Input name="vehicle_name" />
            </div>
            <div>
              <Label>{t("md_driver", lang)}</Label>
              <Input name="driver_name" />
            </div>
            <div>
              <Label>FAT %</Label>
              <Input type="number" step="0.01" name="fat_percentage" />
            </div>
            <div>
              <Label>SNF %</Label>
              <Input type="number" step="0.01" name="snf_percentage" />
            </div>
            <div className="col-span-2">
              <Label>{t("md_notes", lang)}</Label>
              <Textarea name="notes" rows={2} />
            </div>
            <div className="col-span-2">
              <SubmitButton lang={lang} />
            </div>
          </form>
        )}
      </Card>

      {/* Jin ki raseed nahi aayi -- ye pehle, kyunke yehi wo qatar hai jo
          bhool jane par hamesha ke liye adhoori reh jati hai. */}
      {waiting.length > 0 && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between border-b border-surface-100 pb-2 dark:border-surface-800">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
              <PackageCheck className="h-4 w-4 text-amber-600" /> {t("md_awaiting", lang)}
            </h2>
            <Badge tone="amber">{waiting.length}</Badge>
          </div>

          {recvState.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{recvState.error}</p>}

          {waiting.map((r) => (
            <form
              key={r.id}
              action={recvAction}
              className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700"
            >
              <input type="hidden" name="dispatch_id" value={r.id} />
              <div>
                <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                  {r.chiller} — {r.date} · {t(r.shift === "morning" ? "md_morning" : "md_evening", lang)}
                </p>
                <p className="text-xs text-surface-500">
                  {t("md_sent", lang)}: {r.sent.toLocaleString()} L
                  {r.vehicle ? ` · ${r.vehicle}` : ""}
                  {r.driver ? ` · ${r.driver}` : ""}
                </p>
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <Label>{t("md_received", lang)}</Label>
                  <Input type="number" step="0.001" name="received_liters" className="w-32" />
                </div>
                <Button type="submit" size="sm">
                  {t("md_save_receipt", lang)}
                </Button>
              </div>
            </form>
          ))}
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="border-b border-surface-100 pb-2 font-display text-base font-semibold text-surface-900 dark:border-surface-800 dark:text-surface-100">
          {t("md_history", lang)}
        </h2>

        {rows.length === 0 ? (
          <p className="text-sm text-surface-500">{t("md_none", lang)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-left text-xs text-surface-500 dark:border-surface-800">
                  <th className="py-2 pr-3">{t("md_date", lang)}</th>
                  <th className="py-2 pr-3">{t("md_chiller", lang)}</th>
                  <th className="py-2 pr-3">{t("md_sent", lang)}</th>
                  <th className="py-2 pr-3">{t("md_received", lang)}</th>
                  <th className="py-2">{t("md_shortage", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-surface-50 dark:border-surface-900">
                    <td className="py-2 pr-3 text-surface-500">
                      {r.date} · {t(r.shift === "morning" ? "md_morning" : "md_evening", lang)}
                    </td>
                    <td className="py-2 pr-3">{r.chiller}</td>
                    <td className="py-2 pr-3">{r.sent.toLocaleString()}</td>
                    <td className="py-2 pr-3">
                      {r.received === null ? (
                        <span className="text-amber-600">{t("md_waiting", lang)}</span>
                      ) : (
                        r.received.toLocaleString()
                      )}
                    </td>
                    <td className="py-2">
                      {/* Kami ka adad laal hai. Poore safhe ka maqsad
                          yehi khana hai -- baqi sab us tak pahunchne ka
                          raasta hai. */}
                      {r.shortage === null ? (
                        "—"
                      ) : r.shortage > 0 ? (
                        <span className="font-medium text-red-600">
                          {r.shortage.toLocaleString()} L ({r.shortagePct}%)
                        </span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function SubmitButton({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("md_saving", lang) : t("md_save", lang)}
    </Button>
  );
}
