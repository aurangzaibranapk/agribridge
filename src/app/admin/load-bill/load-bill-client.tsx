"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Smartphone, FileText, Wallet, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input, Label, Select } from "@/components/ui/form";
import {
  createLoadTransaction,
  attachProviderTid,
  settleBill,
  reverseLoadTransaction,
  type LoadState,
} from "@/actions/load-bill";

const initial: LoadState = {};

interface Provider {
  id: string;
  name: string;
  kind: string;
  billCategory: string | null;
}
interface Account {
  id: string;
  title: string;
  accountRef: string | null;
  providerId: string;
  providerName: string;
  /** NULL = balance parha nahi ja saka. Sifar se alag baat. */
  float: number | null;
}
interface Txn {
  id: string;
  number: string;
  kind: string;
  reference: string;
  principal: number;
  serviceCharge: number | null;
  commissionExpected: number | null;
  commissionStatus: string;
  method: string;
  tid: string | null;
  status: string;
  settled: boolean;
  customer: string | null;
  waqt: string;
  provider: string;
}

const RAQAM = [50, 100, 200, 500, 1000];

function rs(n: number): string {
  return `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Darj ho raha hai…" : label}
    </Button>
  );
}

export function LoadBillClient({
  providers,
  accounts,
  financeAccounts,
  today,
  canReverse,
}: {
  providers: Provider[];
  accounts: Account[];
  financeAccounts: { id: string; name: string }[];
  today: Txn[];
  canReverse: boolean;
}) {
  const [kind, setKind] = useState<"load" | "bill">("load");
  const [state, action] = useFormState(createLoadTransaction, initial);
  const [tidState, tidAction] = useFormState(attachProviderTid, initial);
  const [settleState, settleAction] = useFormState(settleBill, initial);
  const [revState, revAction] = useFormState(reverseLoadTransaction, initial);

  // Jis qism ka kaam ho raha hai, sirf us ke provider dikhein.
  const kaamKeAccounts = useMemo(() => {
    const ok = new Set(
      providers.filter((p) => p.kind === "both" || p.kind === kind).map((p) => p.id)
    );
    return accounts.filter((a) => ok.has(a.providerId));
  }, [accounts, providers, kind]);

  const [accountId, setAccountId] = useState(kaamKeAccounts[0]?.id ?? accounts[0]?.id ?? "");
  const [principal, setPrincipal] = useState("");
  const [serviceCharge, setServiceCharge] = useState("");
  const [method, setMethod] = useState("cash");
  const [settled, setSettled] = useState(true);

  const chunaHua = accounts.find((a) => a.id === accountId) ?? null;
  const raqam = Number(principal.replace(/,/g, "")) || 0;
  const charge = Number(serviceCharge.replace(/,/g, "")) || 0;
  const kamPara =
    chunaHua?.float !== null && chunaHua !== null && raqam > 0 && chunaHua.float! < raqam;

  const aajKaKaam = today.filter((t) => t.status !== "wapas");
  const handled = aajKaKaam.reduce((s, t) => s + t.principal, 0);
  const kamaya = aajKaKaam.reduce((s, t) => s + (t.serviceCharge ?? 0), 0);
  const sabootBaqi = aajKaKaam.filter((t) => t.status === "saboot_baqi").length;
  const adaBaqi = aajKaKaam.filter((t) => t.kind === "bill" && !t.settled).length;

  const paighaam = state.error ?? tidState.error ?? settleState.error ?? revState.error;
  const khushKhabri = state.notice ?? tidState.notice ?? settleState.notice ?? revState.notice;

  return (
    <div className="space-y-4">
      {/* -------- Float ke khane -------- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {accounts.map((a) => (
          <Card key={a.id} className="py-3">
            <p className="flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400">
              <Wallet className="h-3.5 w-3.5" /> {a.providerName}
            </p>
            <p className="mt-0.5 truncate text-xs text-surface-400" title={a.title}>
              {a.title}
            </p>
            <p className="mt-1 font-display text-xl font-semibold tabular-nums text-surface-900 dark:text-white">
              {a.float === null ? "—" : rs(a.float)}
            </p>
            {a.float === null && (
              <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                Balance parha nahi ja saka
              </p>
            )}
          </Card>
        ))}
      </div>

      {paighaam && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {paighaam}
          </p>
        </Card>
      )}
      {khushKhabri && !paighaam && (
        <Card className="border-brand-200 bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/20">
          <p className="flex items-start gap-2 text-sm text-brand-800 dark:text-brand-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {khushKhabri}
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* -------- Form -------- */}
        <Card>
          <div className="mb-4 flex gap-2">
            {(["load", "bill"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex flex-1 items-center gap-2 rounded-lg border px-4 py-3 text-left transition ${
                  kind === k
                    ? "border-brand-500 bg-brand-50 dark:border-brand-600 dark:bg-brand-950/30"
                    : "border-surface-200 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800/50"
                }`}
              >
                {k === "load" ? (
                  <Smartphone className="h-5 w-5 text-brand-600" />
                ) : (
                  <FileText className="h-5 w-5 text-brand-600" />
                )}
                <span>
                  <span className="block text-sm font-semibold text-surface-900 dark:text-white">
                    {k === "load" ? "Mobile Load" : "Bill Payment"}
                  </span>
                  <span className="block text-[11px] text-surface-500">
                    {k === "load" ? "Customer ka mobile load" : "Bijli, gas, internet"}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <form action={action} className="space-y-3">
            <input type="hidden" name="kind" value={kind} />

            <div>
              <Label htmlFor="account_id">Provider ka account</Label>
              <Select
                id="account_id"
                name="account_id"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
              >
                {kaamKeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.providerName} — {a.title}
                    {a.float !== null ? ` (${rs(a.float)})` : ""}
                  </option>
                ))}
              </Select>
            </div>

            {kind === "bill" && (
              <div>
                <Label htmlFor="bill_category">Bill ki qism</Label>
                <Select id="bill_category" name="bill_category" defaultValue="">
                  <option value="">— chunein —</option>
                  <option value="electricity">Bijli</option>
                  <option value="gas">Gas</option>
                  <option value="internet">Internet / PTCL</option>
                  <option value="postpaid">Mobile postpaid</option>
                  <option value="other">Deegar</option>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="reference">
                {kind === "load" ? "Mobile number" : "Consumer / reference number"}
              </Label>
              <Input
                id="reference"
                name="reference"
                required
                inputMode="numeric"
                placeholder={kind === "load" ? "0301 2345678" : "118752345678"}
              />
            </div>

            <div>
              <Label htmlFor="principal">{kind === "load" ? "Load ki raqam" : "Bill ki raqam"}</Label>
              {kind === "load" && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {RAQAM.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setPrincipal(String(r))}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                        principal === String(r)
                          ? "border-brand-500 bg-brand-50 font-semibold text-brand-800 dark:bg-brand-950/30 dark:text-brand-200"
                          : "border-surface-200 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800"
                      }`}
                    >
                      Rs {r}
                    </button>
                  ))}
                </div>
              )}
              <Input
                id="principal"
                name="principal"
                required
                inputMode="decimal"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                placeholder="1000"
              />
              {kamPara && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Is account mein sirf {rs(chunaHua!.float!)} float hai.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="service_charge">Customer se extra (service charge)</Label>
              <Input
                id="service_charge"
                name="service_charge"
                inputMode="decimal"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(e.target.value)}
                placeholder="khali chhor dein agar extra nahi liya"
              />
              <p className="mt-1 text-[11px] text-surface-500">
                Khali = customer se kuch extra nahi liya. Sifar likhne ki zaroorat nahi.
              </p>
            </div>

            <div>
              <Label htmlFor="payment_method">Customer ne kaise diya</Label>
              <Select
                id="payment_method"
                name="payment_method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank / Card</option>
                <option value="wallet">Wallet</option>
                <option value="khata">Khata (udhaar)</option>
              </Select>
            </div>

            {method === "bank" && (
              <div>
                <Label htmlFor="finance_account_id">Kaunse khate mein aaya</Label>
                <Select id="finance_account_id" name="finance_account_id" required>
                  <option value="">— chunein —</option>
                  {financeAccounts.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="customer_name">Customer ka naam (marzi ka)</Label>
              <Input id="customer_name" name="customer_name" placeholder="chhora ja sakta hai" />
            </div>

            {/* Saboot -- is poore safhe ki sab se ahem cheez. */}
            <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-3 dark:border-brand-900/40 dark:bg-brand-950/20">
              <Label htmlFor="provider_tid">Provider ki TID / reference</Label>
              <Input id="provider_tid" name="provider_tid" placeholder="Jazz/Easypaisa app se copy karein" />
              <p className="mt-1 text-[11px] leading-relaxed text-brand-800/80 dark:text-brand-200/80">
                AgriBridge load khud nahi bhejta — wo provider ki app se jata hai. Ye TID hi is baat ka
                saboot hai ke kaam waqai hua. Abhi na ho to baad mein bhi lag sakti hai; tab tak qatar par
                <b> &ldquo;saboot baqi&rdquo;</b> likha rahega.
              </p>
            </div>

            {kind === "bill" && (
              <label className="flex items-start gap-2 rounded-lg border border-surface-200 p-3 dark:border-surface-800">
                <input
                  type="checkbox"
                  name="float_settled"
                  checked={settled}
                  onChange={(e) => setSettled(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-xs leading-relaxed text-surface-600 dark:text-surface-300">
                  <b>Bill provider tak pahunch gaya.</b> Nishan hata dein agar paisa abhi hamare paas hai
                  (provider band tha, raat ko jama hoga) — tab wo paisa hamara nahi, customer ka bojh hai.
                </span>
              </label>
            )}

            <div className="rounded-lg bg-surface-50 p-3 text-sm dark:bg-surface-800/50">
              <div className="flex justify-between">
                <span className="text-surface-500">Customer dega</span>
                <span className="font-semibold tabular-nums text-surface-900 dark:text-white">
                  {rs(raqam + charge)}
                </span>
              </div>
              <div className="mt-1 flex justify-between text-xs">
                <span className="text-surface-400">Is mein apni aamdani</span>
                <span className="tabular-nums text-surface-500">{charge ? rs(charge) : "—"}</span>
              </div>
            </div>

            <Submit label={kind === "load" ? "Load ho gaya — darj karein" : "Bill jama hua — darj karein"} />
          </form>
        </Card>

        {/* -------- Aaj ka hisaab -------- */}
        <div className="space-y-3">
          <Card className="py-3">
            <p className="text-xs text-surface-500 dark:text-surface-400">Aaj handle hua</p>
            <p className="font-display text-2xl font-semibold tabular-nums text-surface-900 dark:text-white">
              {rs(handled)}
            </p>
            <p className="mt-0.5 text-[11px] text-surface-400">{aajKaKaam.length} qatarein</p>
          </Card>
          <Card className="py-3">
            <p className="text-xs text-surface-500 dark:text-surface-400">Aaj ki apni aamdani</p>
            <p className="font-display text-2xl font-semibold tabular-nums text-surface-900 dark:text-white">
              {kamaya ? rs(kamaya) : "—"}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-surface-400">
              Sirf service charge. Company ki commission is mein nahi — wo statement ki tasdeeq ke baad
              aamdani banti hai.
            </p>
          </Card>
          {sabootBaqi > 0 && (
            <Card className="border-amber-200 bg-amber-50 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900 dark:text-amber-200">
                <Clock className="h-4 w-4" /> {sabootBaqi} par saboot baqi
              </p>
              <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                Provider ki TID lagayein — neeche fehrist mein.
              </p>
            </Card>
          )}
          {adaBaqi > 0 && (
            <Card className="border-amber-200 bg-amber-50 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {adaBaqi} bill abhi provider tak nahi pahunche
              </p>
              <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                Ye paisa hamare paas hai magar hamara nahi.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* -------- Aaj ki qatarein -------- */}
      <Card className="p-0">
        <p className="border-b border-surface-100 px-5 py-3 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
          Aaj ki qatarein
        </p>
        {today.length === 0 ? (
          <p className="px-5 py-6 text-sm text-surface-500 dark:text-surface-400">Aaj abhi koi qatar nahi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800/50">
                <tr>
                  <th className="px-4 py-2">Waqt</th>
                  <th className="px-4 py-2">Number</th>
                  <th className="px-4 py-2">Provider</th>
                  <th className="px-4 py-2">Reference</th>
                  <th className="px-4 py-2 text-right">Raqam</th>
                  <th className="px-4 py-2 text-right">Service charge</th>
                  <th className="px-4 py-2 text-right">Commission</th>
                  <th className="px-4 py-2">Halat</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {today.map((t) => (
                  <tr key={t.id} className="border-t border-surface-100 dark:border-surface-800">
                    <td className="px-4 py-2 text-xs tabular-nums text-surface-500">
                      {new Date(t.waqt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{t.number}</td>
                    <td className="px-4 py-2">{t.provider}</td>
                    <td className="px-4 py-2 tabular-nums">{t.reference}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{rs(t.principal)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {t.serviceCharge === null ? "—" : rs(t.serviceCharge)}
                    </td>
                    <td className="px-4 py-2 text-right text-xs">
                      {t.commissionStatus === "muntazir" ? (
                        <span className="text-surface-400">
                          {t.commissionExpected === null
                            ? "qaida nahi"
                            : `~${rs(t.commissionExpected)} muntazir`}
                        </span>
                      ) : t.commissionStatus === "nahi_mili" ? (
                        <span className="text-red-600">nahi mili</span>
                      ) : (
                        <span className="text-brand-700">tasdeeq shuda</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {t.status === "wapas" ? (
                        <Badge tone="red">wapas</Badge>
                      ) : t.status === "saboot_baqi" ? (
                        <Badge tone="amber">saboot baqi</Badge>
                      ) : !t.settled ? (
                        <Badge tone="amber">ada baqi</Badge>
                      ) : (
                        <Badge tone="green">darj</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {t.status === "saboot_baqi" && (
                          <form action={tidAction} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={t.id} />
                            <Input
                              name="provider_tid"
                              placeholder="TID"
                              className="h-8 w-28 text-xs"
                              required
                            />
                            <Button type="submit" size="sm" variant="secondary">
                              Lagayein
                            </Button>
                          </form>
                        )}
                        {t.kind === "bill" && !t.settled && t.status !== "wapas" && (
                          <form action={settleAction}>
                            <input type="hidden" name="id" value={t.id} />
                            <Button type="submit" size="sm" variant="secondary">
                              Ada ho gaya
                            </Button>
                          </form>
                        )}
                        {canReverse && t.status !== "wapas" && (
                          <form action={revAction} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={t.id} />
                            <Input name="reason" placeholder="wapas ki wajah" className="h-8 w-32 text-xs" required />
                            <Button type="submit" size="sm" variant="ghost">
                              Wapas
                            </Button>
                          </form>
                        )}
                      </div>
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
