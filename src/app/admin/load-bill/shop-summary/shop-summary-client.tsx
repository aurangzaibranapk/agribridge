"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, FileText, Banknote, HandCoins, ShoppingBag } from "lucide-react";
import { Card } from "@/components/ui/layout-primitives";
import { Input, Label, Select } from "@/components/ui/form";

interface Hisaab {
  shopName: string;
  loadPrincipal: number;
  loadCount: number;
  billPrincipal: number;
  billCount: number;
  lbCash: number;
  lbKhata: number;
  lbBank: number;
  lbWallet: number;
  posSaleTotal: number;
  posKhataTotal: number;
  posSaleCount: number;
  posCash: number;
  posBankTransfer: number;
  posCard: number;
  posJazzcash: number;
  posEasypaisa: number;
  posQr: number;
  posWaseelaCard: number;
}

function rs(n: number): string {
  return `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

function Qatar({ label, value, strong }: { label: ReactNode; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-surface-500 dark:text-surface-400">{label}</span>
      <span className={`tabular-nums ${strong ? "font-semibold text-surface-900 dark:text-white" : "text-surface-800 dark:text-surface-200"}`}>
        {value}
      </span>
    </div>
  );
}

export function ShopSummaryClient({
  shopId,
  tareekh,
  aaj,
  shops,
  hisaab,
}: {
  shopId: string;
  tareekh: string;
  aaj: string;
  shops: { id: string; name: string }[];
  hisaab: Hisaab;
}) {
  const router = useRouter();

  function jao(next: { shop?: string; tareekh?: string }) {
    const p = new URLSearchParams({ shop: shopId, tareekh, ...next });
    router.push(`/admin/load-bill/shop-summary?${p.toString()}`);
  }

  const lbTotal = hisaab.loadPrincipal + hisaab.billPrincipal;
  const naqadKul = hisaab.lbCash + hisaab.posCash;
  const udhaarKul = hisaab.lbKhata + hisaab.posKhataTotal;
  const digitalKul =
    hisaab.lbBank +
    hisaab.lbWallet +
    hisaab.posBankTransfer +
    hisaab.posCard +
    hisaab.posJazzcash +
    hisaab.posEasypaisa +
    hisaab.posQr +
    hisaab.posWaseelaCard;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <Label htmlFor="shop">Shop</Label>
          <Select id="shop" value={shopId} onChange={(e) => jao({ shop: e.target.value })}>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="dt">Tareekh</Label>
          <Input id="dt" type="date" value={tareekh} max={aaj} onChange={(e) => jao({ tareekh: e.target.value })} />
        </div>
      </Card>

      {/* -------- Khulasa: teen bade adad -------- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="py-3">
          <p className="flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400">
            <Banknote className="h-3.5 w-3.5" /> Naqad (Cash)
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-surface-900 dark:text-white">
            {rs(naqadKul)}
          </p>
          <p className="mt-0.5 text-[11px] text-surface-400">Load/Bill {rs(hisaab.lbCash)} + Sale {rs(hisaab.posCash)}</p>
        </Card>
        <Card className="py-3">
          <p className="flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400">
            <HandCoins className="h-3.5 w-3.5" /> Udhaar (Khata)
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
            {rs(udhaarKul)}
          </p>
          <p className="mt-0.5 text-[11px] text-surface-400">Load/Bill {rs(hisaab.lbKhata)} + Sale {rs(hisaab.posKhataTotal)}</p>
        </Card>
        <Card className="py-3">
          <p className="flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400">
            <ShoppingBag className="h-3.5 w-3.5" /> Digital (Bank/Card/Wallet)
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-surface-900 dark:text-white">
            {rs(digitalKul)}
          </p>
          <p className="mt-0.5 text-[11px] text-surface-400">Bank, Card, JazzCash, Easypaisa, QR — sab jama</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* -------- Load & Bill -------- */}
        <Card>
          <p className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">Load &amp; Bill — is shop se</p>
          <dl>
            <Qatar
              label={
                <span className="flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" /> Mobile Load
                </span>
              }
              value={`${rs(hisaab.loadPrincipal)} (${hisaab.loadCount})`}
            />
            <Qatar
              label={
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Bill Payment
                </span>
              }
              value={`${rs(hisaab.billPrincipal)} (${hisaab.billCount})`}
            />
            <div className="mt-1 border-t border-surface-100 pt-1 dark:border-surface-800">
              <Qatar label="Kul (Load + Bill)" value={rs(lbTotal)} strong />
            </div>
          </dl>
          <p className="mb-2 mt-4 text-xs font-medium text-surface-500 dark:text-surface-400">Payment kahan se aaya</p>
          <dl>
            <Qatar label="Cash" value={rs(hisaab.lbCash)} />
            <Qatar label="Khata (udhaar)" value={rs(hisaab.lbKhata)} />
            <Qatar label="Bank" value={rs(hisaab.lbBank)} />
            <Qatar label="Customer ka wallet" value={rs(hisaab.lbWallet)} />
          </dl>
        </Card>

        {/* -------- POS Sale -------- */}
        <Card>
          <p className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">
            Shop ki Sale (POS) — {hisaab.posSaleCount} bill
          </p>
          <dl>
            <Qatar label="Kul sale" value={rs(hisaab.posSaleTotal)} strong />
            <Qatar label="Ismein Khata (udhaar)" value={rs(hisaab.posKhataTotal)} />
          </dl>
          <p className="mb-2 mt-4 text-xs font-medium text-surface-500 dark:text-surface-400">Tareeqe ke hisaab se</p>
          <dl>
            <Qatar label="Cash" value={rs(hisaab.posCash)} />
            <Qatar label="Bank Transfer" value={rs(hisaab.posBankTransfer)} />
            <Qatar label="Card" value={rs(hisaab.posCard)} />
            <Qatar label="JazzCash" value={rs(hisaab.posJazzcash)} />
            <Qatar label="Easypaisa" value={rs(hisaab.posEasypaisa)} />
            <Qatar label="QR" value={rs(hisaab.posQr)} />
            <Qatar label="Waseela Card" value={rs(hisaab.posWaseelaCard)} />
          </dl>
        </Card>
      </div>

      <p className="text-[11px] leading-relaxed text-surface-400">
        {hisaab.shopName} — {tareekh}. Ye hisaab sirf un load/bill qataron ka hai jo yahan staff ne is shop
        ke naam darj ki hain; purani qatarein (425 se pehle ki) jin par shop chuni hi nahi gayi thi, kisi
        shop ke hisaab mein shamil nahi hongi.
      </p>
    </div>
  );
}
