"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { aajKaKhana } from "@/lib/utils/format";
import { useFormState, useFormStatus } from "react-dom";
import { Smartphone, FileText, Wallet, AlertTriangle, CheckCircle2, Clock, HandCoins, Banknote, Printer, MessageCircle, X } from "lucide-react";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input, Label, Select } from "@/components/ui/form";
import { PersonPicker, PartyStrip, NameSuggest, type PersonOption } from "@/components/ui/person-picker";
import {
  createLoadTransaction,
  attachProviderTid,
  settleBill,
  reverseLoadTransaction,
  confirmLoadCommission,
  type LoadState,
} from "@/actions/load-bill";
import {
  giveCustomerLoan,
  takeCustomerRepayment,
  type UdhaarState,
} from "@/actions/customer-udhaar";

const initial: LoadState = {};
const udhaarInitial: UdhaarState = {};

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
  /** NULL = ye account har provider ke liye hai. */
  providerId: string | null;
  providerName: string;
  /** NULL = balance parha nahi ja saka. Sifar se alag baat. */
  float: number | null;
}
interface Txn {
  id: string;
  number: string;
  kind: string;
  reference: string;
  billCategory: string | null;
  principal: number;
  serviceCharge: number | null;
  commissionExpected: number | null;
  commissionConfirmed: number | null;
  commissionStatus: string;
  method: string;
  tid: string | null;
  status: string;
  settled: boolean;
  customer: string | null;
  waqt: string;
  provider: string;
}
interface LedgerTxn {
  id: string;
  description: string;
  amount: number;
  createdAt: string;
  kind: "udhaar" | "recovery";
}
type DeskTransaction = {
  id: string;
  kind: "load" | "bill" | "udhaar" | "recovery";
  customer: string;
  provider: string;
  reference: string;
  amount: number;
  serviceCharge: number;
  status: string;
  waqt: string;
  note?: string;
  source?: Txn;
};

// Malik (7 September): "50 ka load kabhi nahi hota, minimum 100 rupay hai."
const RAQAM = [100, 200, 500, 1000];
const BILL_CATEGORY_LABELS: Record<string, string> = {
  electricity: "Electricity",
  gas: "Gas",
  internet: "Internet / PTCL",
  postpaid: "Mobile postpaid",
  other: "Other",
};

function rs(n: number): string {
  return `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

type DeskSlip = {
  title: string;
  date: string;
  customer: string;
  contact?: string;
  provider?: string;
  reference?: string;
  amount: number;
  serviceCharge?: number;
  total: number;
  account?: string;
  floatAccount?: string;
  paymentMethod?: string;
  billCategory?: string;
  status: string;
  receiptNo?: string;
  note?: string;
};

function printDeskSlip(slip: DeskSlip) {
  const popup = window.open("", "_blank", "width=420,height=720");
  if (!popup) {
    window.alert("Receipt print nahi hui. Browser mein pop-ups allow karke dobara Print dabayein.");
    return;
  }
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
  const safe = (value: string) => value.replace(/[&<>\"']/g, (char) => entities[char] ?? char);
  const row = (label: string, value?: string) => value ? `<div class="row"><span>${safe(label)}</span><b>${safe(value)}</b></div>` : "";
  const charge = slip.serviceCharge ? row("Service charge", rs(slip.serviceCharge)) : "";
  popup.document.open();
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(slip.title)}</title><style>
    *{box-sizing:border-box}body{margin:0;background:#f3f6f4;color:#17251e;font:13px Arial,sans-serif}.paper{width:80mm;min-height:120mm;margin:12px auto;background:#fff;padding:6mm 5mm}.brand{text-align:center;border-bottom:1px dashed #9aa79f;padding-bottom:10px}.brand-mark{display:inline-grid;width:34px;height:34px;place-items:center;border-radius:50%;background:#eaf5ed;color:#087a42;font-weight:700;font-size:18px}.brand h1{font-size:17px;margin:7px 0 2px}.brand p{margin:0;color:#66736b;font-size:10px}.title{text-align:center;font-weight:700;font-size:15px;margin:12px 0 3px}.status{text-align:center;color:#087a42;font-size:10px;margin-bottom:10px}.row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid #edf1ee;font-size:11px}.row span{color:#627067}.row b{text-align:right;max-width:52%;overflow-wrap:anywhere}.total{margin-top:5px;padding:10px 0;border-top:1px solid #b7c7bd;border-bottom:1px dashed #9aa79f;font-size:14px}.total b{font-size:17px}.note{padding:8px 0;font-size:10px;color:#59675f;overflow-wrap:anywhere}.foot{text-align:center;margin-top:14px;padding-top:9px;border-top:1px dashed #9aa79f;color:#68756d;font-size:10px;line-height:1.5}.actions{display:flex;justify-content:center;margin:10px auto}.actions button{border:0;border-radius:7px;background:#087a42;color:white;padding:9px 18px;font-weight:700;cursor:pointer}@media print{@page{size:80mm auto;margin:3mm}body{background:#fff}.paper{width:74mm;min-height:0;margin:0 auto;padding:2mm 1mm}.actions{display:none}}
  </style></head><body><article class="paper"><header class="brand"><span class="brand-mark">A</span><h1>AgriBridge</h1><p>Al Rana Traders · Staff Sales Desk</p></header><div class="title">${safe(slip.title)}</div><div class="status">${safe(slip.status)}</div>${row("Date & time", slip.date)}${row("Receipt no.", slip.receiptNo)}${row("Customer", slip.customer)}${row("Mobile", slip.contact)}${row("Provider / network", slip.provider)}${row("Bill type", slip.billCategory)}${row("Reference", slip.reference)}${row("Float account", slip.floatAccount)}${row("Payment received in", slip.paymentMethod || slip.account)}${row("Amount", rs(slip.amount))}${charge}<div class="row total"><span>${slip.title.includes("Udhaar") ? "Udhaar amount" : slip.title.includes("Recovery") ? "Received" : "Customer pays"}</span><b>${rs(slip.total)}</b></div>${slip.note ? `<div class="note"><b>Note:</b> ${safe(slip.note)}</div>` : ""}<footer class="foot">${slip.receiptNo || slip.status === "Transaction recorded" ? "Please keep this receipt for your record." : "Preview slip · transaction save hone ke baad final receipt print karein."}<br>Thank you · Shukriya</footer></article><div class="actions"><button onclick="window.print()">Print receipt</button></div></body></html>`);
  popup.document.close();
  window.setTimeout(() => { popup.focus(); popup.print(); }, 300);
}

function whatsappPhone(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("0") ? `92${digits.slice(1)}` : digits;
}

function ledgerCustomerName(description: string) {
  const recovery = description.match(/^Udhaar wapas aaya:\s*Rs\s*[\d,.]+\s*[—-]\s*(.*?)(?:\s+\([^)]*\))*$/i);
  if (recovery?.[1]) return recovery[1].trim();
  return description.replace(/^Naqad udhaar\s*[—-]?\s*/, "").split(" (")[0].trim() || "Customer";
}

/**
 * Number ke pehle chaar hindson se network ka ANDAZA -- pakka jawab
 * nahi (number portability ki wajah se koi bhi prefix hamesha sach
 * nahi bolta). Sirf ek shuruaat, staff hamesha badal sakta hai.
 */
const NETWORK_PREFIX: Record<string, string> = {
  "0300": "Jazz", "0301": "Jazz", "0302": "Jazz", "0303": "Jazz", "0304": "Jazz",
  "0305": "Jazz", "0306": "Jazz", "0307": "Jazz", "0308": "Jazz", "0309": "Jazz",
  "0310": "Zong", "0311": "Zong", "0312": "Zong", "0313": "Zong", "0314": "Zong",
  "0315": "Zong", "0316": "Zong", "0317": "Zong", "0318": "Zong", "0319": "Zong",
  "0320": "Jazz", "0321": "Jazz", "0322": "Jazz", "0323": "Jazz", "0324": "Jazz",
  "0325": "Jazz", "0326": "Jazz", "0327": "Jazz", "0328": "Jazz", "0329": "Jazz",
  "0330": "Ufone", "0331": "Ufone", "0332": "Ufone", "0333": "Jazz", "0334": "Jazz",
  "0335": "Ufone", "0336": "Ufone", "0337": "Ufone",
  "0340": "Telenor", "0341": "Telenor", "0342": "Telenor", "0343": "Telenor",
  "0344": "Telenor", "0345": "Telenor", "0346": "Telenor", "0347": "Telenor",
};

function andazaNetwork(mobile: string): string | null {
  const digits = mobile.replace(/\D/g, "");
  const prefix = digits.slice(0, 4);
  return NETWORK_PREFIX[prefix] ?? null;
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
  shuruKind,
  providers,
  accounts,
  financeAccounts,
  customers,
  farmers,
  today,
  ledgerToday,
  summary,
  canReverse,
}: {
  /** POS se aate waqt kaunsa khana khula ho — "Mobile Load" ya "Bill Payment". */
  shuruKind: "load" | "bill";
  providers: Provider[];
  accounts: Account[];
  financeAccounts: { id: string; name: string }[];
  customers: { id: string; name: string; balance: number | null }[];
  farmers: { id: string; name: string; phone: string | null; cnic: string | null; farmerCode: string }[];
  today: Txn[];
  ledgerToday: LedgerTxn[];
  summary: { floatBalance: number | null; cashReceived: number | null; volume: number | null; recovery: number | null; pendingProof: number | null };
  canReverse: boolean;
}) {
  /**
   * Chaar khane, ek hi safha.
   *
   * Malik (6 September): *"customer ke bana dein, POS ke upar jahan hum
   * load bill kar rahe hain wahan udhaar raqam bhi karein."*
   *
   * Malik (7 September ka spec): wireframe mein "Payment Receive" apna
   * alag khana hai, "Udhaar" ke andar chhupa hua toggle nahi -- warna
   * jo paisa wapas aaya (ya jis se overpayment credit banta hai) usay
   * dhoondne ke liye pehle "Udhaar" khol kar phir andar "Wapas aaya"
   * dabana parta, jabke ye dono alag kaam hain: ek paisa deta hai, ek
   * leta hai.
   *
   * Udhaar/Payment Receive ka `kind` nahi hota -- wo load ya bill hai hi
   * nahi. Is liye `tab` alag hai aur `kind` sirf pehle do khanon ke liye.
   */
  const [tab, setTab] = useState<"load" | "bill" | "udhaar" | "receive">(shuruKind);
  const kind: "load" | "bill" = tab === "load" || tab === "bill" ? tab : "load";
  const [state, action] = useFormState(createLoadTransaction, initial);
  const [tidState, tidAction] = useFormState(attachProviderTid, initial);
  const [settleState, settleAction] = useFormState(settleBill, initial);
  const [revState, revAction] = useFormState(reverseLoadTransaction, initial);
  const [commState, commAction] = useFormState(confirmLoadCommission, initial);
  const [loanState, loanAction] = useFormState(giveCustomerLoan, udhaarInitial);
  const [wapsiState, wapsiAction] = useFormState(takeCustomerRepayment, udhaarInitial);
  const submittedTabRef = useRef<"load" | "bill" | "udhaar" | "receive" | null>(null);
  const [lastSavedTab, setLastSavedTab] = useState<"load" | "bill" | "udhaar" | "receive" | null>(null);
  useEffect(() => {
    const submittedTab = submittedTabRef.current;
    if ((submittedTab === "load" || submittedTab === "bill") && state.success) setLastSavedTab(submittedTab);
    else if (submittedTab === "udhaar" && loanState.success) setLastSavedTab("udhaar");
    else if (submittedTab === "receive" && wapsiState.success) setLastSavedTab("receive");
  }, [state, loanState, wapsiState]);

  /**
   * Udhaar dukan ke customer ko bhi milta hai aur kisan ko bhi — is
   * liye picker donon ko ek hi fehrist mein dikhata hai.
   */
  const udhaarPeople: PersonOption[] = useMemo(
    () => [
      ...customers.map((c): PersonOption => ({ type: "customer", id: c.id, name: c.name, balance: c.balance })),
      ...farmers.map((f): PersonOption => ({ type: "farmer", id: f.id, name: f.name, phone: f.phone, cnic: f.cnic, subtitle: f.farmerCode })),
    ],
    [customers, farmers]
  );
  /**
   * Customer/kisan — ab sirf khata ke liye nahi, poori transaction ke
   * liye ek hi jagah se chuna jata hai (7 September ka naya design).
   * Mobile number aur naam isi se auto-fill hote hain; ledger ka
   * party_type/party_id bhi yahin se jate hain (server sirf "khata"
   * method par inhein istemal karta hai, baqi par khamoshi se nazarandaz
   * kar deta hai — is liye hamesha bhejna mehfooz hai).
   */
  const [mainParty, setMainParty] = useState<PersonOption | null>(null);
  const [ledgerParty, setLedgerParty] = useState<PersonOption | null>(null);
  const [typedCustomerName, setTypedCustomerName] = useState("");
  const [ledgerAmount, setLedgerAmount] = useState("");
  const [ledgerAccount, setLedgerAccount] = useState("cash");
  const [ledgerNote, setLedgerNote] = useState("");
  const [ledgerDate, setLedgerDate] = useState(aajKaKhana());
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  // Account ki fehrist provider se NAHI chhanti.
  //
  // Malik ka CBA account har provider ke liye ek hi hai (332). Us ko
  // "Jazz ka account" maan kar chhan dena us ko bill wale khane se ghayab
  // kar deta -- aur phir bill darj hi nahi hota.
  //
  // Chhanne wali cheez PROVIDER hai: mobile load par sirf network, bill
  // par sirf bill wale.
  const kaamKeAccounts = accounts;

  const kaamKeProviders = useMemo(
    () => providers.filter((p) => p.kind === "both" || p.kind === kind),
    [providers, kind]
  );

  const [accountId, setAccountId] = useState(kaamKeAccounts[0]?.id ?? accounts[0]?.id ?? "");
  const [principal, setPrincipal] = useState("");
  const [serviceCharge, setServiceCharge] = useState("");
  const [reference, setReference] = useState("");
  const [billCategory, setBillCategory] = useState("");

  // Customer chunte hi mobile number khud bhar jata hai -- magar sirf
  // Mobile Load ke liye (Bill Payment ka "reference" consumer number
  // hai, kisi ka mobile nahi), aur sirf jab khana khali ho, taake staff
  // ka apna likha number na mit jaye.
  useEffect(() => {
    if (kind === "load" && mainParty?.phone && !reference) {
      setReference(mainParty.phone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainParty]);

  // Network ka andaza number ke pehle chaar hindson se — sirf Jazz,
  // Zong, Ufone, Telenor tak, aur sirf TAJVEEZ hai. Number portability
  // ki wajah se hamesha sach nahi hoga, is liye staff hamesha badal
  // sakta hai.
  const andaza = useMemo(() => andazaNetwork(reference), [reference]);
  const [providerId, setProviderId] = useState("");

  useEffect(() => {
    if (kind !== "load" || !andaza || providerId) return;
    const milgaya = kaamKeProviders.find((p) => p.name.toLowerCase().includes(andaza.toLowerCase()));
    if (milgaya) setProviderId(milgaya.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [andaza, kind]);

  // Tab badalte hi provider ki fehrist badal jati hai (load vs bill) —
  // purana chuna hua provider doosri fehrist mein hoga hi nahi.
  useEffect(() => {
    setProviderId("");
  }, [kind]);
  /**
   * Ek hi khane se do cheezein.
   *
   * `paisaKahan` wo hai jo banda chunta hai: "cash", kisi khate ki id
   * (`acct:<id>`), "wallet" ya "khata". Us se `method` aur
   * `chunaHuaKhata` khud nikal aate hain, aur wohi server ko jate hain.
   * Server ka hisaab bilkul nahi badla -- sirf poochne ka tareeqa badla
   * hai.
   */
  const [paisaKahan, setPaisaKahan] = useState("cash");
  const khataChuna = paisaKahan.startsWith("acct:");
  const method = khataChuna ? "bank" : paisaKahan;
  const chunaHuaKhata = khataChuna ? paisaKahan.slice(5) : "";
  const [settled, setSettled] = useState(true);

  const chunaHua = accounts.find((a) => a.id === accountId) ?? null;
  const raqam = Number(principal.replace(/,/g, "")) || 0;
  const charge = Number(serviceCharge.replace(/,/g, "")) || 0;
  const kamPara =
    chunaHua?.float !== null && chunaHua !== null && raqam > 0 && chunaHua.float! < raqam;

  const customerPays = raqam + charge;
  const aajKaKaam = today.filter((t) => t.status !== "wapas");
  const kamaya = aajKaKaam.reduce((s, t) => s + (t.serviceCharge ?? 0), 0);
  const sabootBaqi = aajKaKaam.filter((t) => t.status === "saboot_baqi").length;
  const adaBaqi = aajKaKaam.filter((t) => t.kind === "bill" && !t.settled).length;
  const activeParty = tab === "udhaar" || tab === "receive" ? ledgerParty : mainParty;
  const amountForSlip = tab === "load" || tab === "bill" ? raqam : Number(ledgerAmount.replace(/,/g, "")) || 0;
  const chargeForSlip = tab === "load" || tab === "bill" ? charge : 0;
  const currentActionSucceeded = lastSavedTab === tab;
  const receivedIn = paisaKahan === "cash" ? "Cash" : paisaKahan === "wallet" ? "Customer wallet" : paisaKahan === "khata" ? "Customer khata" : financeAccounts.find((account) => account.id === paisaKahan.slice(5))?.name ?? "—";
  const ledgerAccountName = ledgerAccount === "cash" ? "Cash" : financeAccounts.find((account) => account.id === ledgerAccount)?.name ?? "—";
  const serviceTitle = tab === "load" ? "Mobile Load" : tab === "bill" ? "Bill Payment" : tab === "udhaar" ? "Udhaar" : "Recovery";
  const currentSlip: DeskSlip = {
    title: `${serviceTitle} Receipt`,
    date: tab === "udhaar" || tab === "receive"
      ? new Date(`${ledgerDate}T12:00:00`).toLocaleDateString("en-PK", { dateStyle: "medium" })
      : new Date().toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" }),
    customer: (tab === "load" || tab === "bill" ? typedCustomerName.trim() : "") || activeParty?.name || "Walk-in",
    contact: activeParty?.phone || (tab === "load" ? reference : undefined) || undefined,
    provider: tab === "load" ? kaamKeProviders.find((provider) => provider.id === providerId)?.name : tab === "bill" ? kaamKeProviders.find((provider) => provider.id === providerId)?.name : undefined,
    reference: tab === "load" || tab === "bill" ? reference || undefined : undefined,
    amount: amountForSlip,
    serviceCharge: chargeForSlip,
    total: amountForSlip + chargeForSlip,
    account: tab === "load" || tab === "bill" ? receivedIn : ledgerAccountName,
    floatAccount: tab === "load" || tab === "bill" ? chunaHua?.title : undefined,
    paymentMethod: tab === "load" || tab === "bill" ? receivedIn : ledgerAccountName,
    billCategory: tab === "bill" ? BILL_CATEGORY_LABELS[billCategory] : undefined,
    status: currentActionSucceeded ? "Transaction recorded" : "Preview only · transaction not saved",
    receiptNo: lastSavedTab === tab && (tab === "load" || tab === "bill") ? state.txnNumber : undefined,
    note: tab === "udhaar" || tab === "receive" ? ledgerNote || undefined : undefined,
  };
  const quickPhone = whatsappPhone(activeParty?.phone || (tab === "load" ? reference : ""));
  const whatsAppHref = `https://wa.me/${quickPhone}?text=${encodeURIComponent(`${currentSlip.title}\nCustomer: ${currentSlip.customer}\nAmount: ${rs(currentSlip.amount)}${currentSlip.serviceCharge ? `\nService charge: ${rs(currentSlip.serviceCharge)}` : ""}\nTotal: ${rs(currentSlip.total)}\n${currentSlip.status}`)}`;
  const [transactionFilter, setTransactionFilter] = useState<"all" | "load" | "bill" | "udhaar" | "recovery" | "pending">("all");
  const transactions: DeskTransaction[] = [
    ...today.map((t) => ({
      id: t.id,
      kind: (t.kind === "bill" ? "bill" : "load") as "load" | "bill",
      customer: t.customer || t.reference || "Walk-in",
      provider: t.provider,
      reference: t.reference,
      amount: t.principal,
      serviceCharge: t.serviceCharge ?? 0,
      status: t.status === "wapas" ? "wapas" : t.status === "saboot_baqi" ? "pending" : !t.settled ? "pending" : "complete",
      waqt: t.waqt,
      source: t,
    })),
    ...ledgerToday.map((t) => ({
      id: t.id,
      kind: t.kind,
      customer: ledgerCustomerName(t.description),
      provider: "—",
      reference: "—",
      amount: t.amount,
      serviceCharge: 0,
      status: "complete",
      waqt: t.createdAt,
      note: t.description,
    })),
  ].sort((a, b) => new Date(b.waqt).getTime() - new Date(a.waqt).getTime());
  const filteredTransactions = transactions.filter((t) => {
    if (transactionFilter === "all") return true;
    if (transactionFilter === "pending") return t.status === "pending";
    return t.kind === transactionFilter;
  });
  const currentTransactionKind = tab === "receive" ? "recovery" : tab;
  const currentTransactionCount = transactions.filter((transaction) => transaction.kind === currentTransactionKind).length;
  // Keep the whole day's list in one bounded table; its inner viewport scrolls.
  const visibleTransactions = filteredTransactions;

  const paighaam =
    state.error ?? tidState.error ?? settleState.error ?? revState.error ?? commState.error ?? loanState.error ?? wapsiState.error;
  const khushKhabri =
    state.notice ?? tidState.notice ?? settleState.notice ?? revState.notice ?? commState.notice ?? loanState.notice ?? wapsiState.notice;

  return (
    <div className="load-body">
      <section className="load-kpis grid grid-cols-2 gap-2 xl:grid-cols-5" aria-label="Aaj ka counter summary">
        {[
          { label: "Float balance", value: summary.floatBalance === null ? "Unavailable" : rs(summary.floatBalance), tone: "green" },
          { label: "Cash received today", value: summary.cashReceived === null ? "Unavailable" : rs(summary.cashReceived), tone: "blue" },
          { label: "Load & Bill today", value: summary.volume === null ? "Unavailable" : rs(summary.volume), tone: "green" },
          { label: "Recovery today", value: summary.recovery === null ? "Unavailable" : rs(summary.recovery), tone: "teal" },
          { label: "Pending proof", value: summary.pendingProof === null ? "Unavailable" : String(summary.pendingProof), tone: summary.pendingProof ? "amber" : "green" },
        ].map((metric) => (
          <div key={metric.label} className={`load-kpi load-kpi-${metric.tone}`}>
            <p>{metric.label}</p><strong>{metric.value}</strong>
          </div>
        ))}
      </section>
      <div className="load-account-strip" aria-label="Provider account float detail">
        <span>Accounts</span>
        {accounts.map((account) => (
          <span key={account.id} title={account.providerName === "—" ? "Har provider ke liye" : account.providerName}>
            <Wallet aria-hidden="true" /> {account.title}: <b>{account.float === null ? "Unavailable" : rs(account.float)}</b>
          </span>
        ))}
        {accounts.some((account) => account.float === null) && <span className="load-account-warning">Some account balances need reconciliation</span>}
      </div>

      {paighaam && (
        <Card className="load-alert border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {paighaam}
          </p>
        </Card>
      )}
      {khushKhabri && !paighaam && (
        <Card className="load-alert border-brand-200 bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/20">
          <p className="flex items-start gap-2 text-sm text-brand-800 dark:text-brand-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {khushKhabri}
          </p>
        </Card>
      )}

      <div className="load-entry-grid grid gap-3 lg:grid-cols-[minmax(0,1fr)_19rem]">
        {/* -------- Form -------- */}
        <Card className="load-entry-card">
          <div className="load-mode-tabs mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4" role="tablist" aria-label="Load Bill services">
            {(
              [
                { key: "load", title: "Mobile Load", sub: "Customer ka mobile load", Icon: Smartphone },
                { key: "bill", title: "Bill Payment", sub: "Bijli, gas, internet", Icon: FileText },
                { key: "udhaar", title: "Udhaar", sub: "Dukan se naqad gaya", Icon: HandCoins },
                { key: "receive", title: "Recovery", sub: "Payment receive / udhaar wapsi", Icon: Banknote },
              ] as const
            ).map(({ key, title, sub, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => { setTab(key); setLastSavedTab(null); }}
                role="tab"
                aria-selected={tab === key}
                className={`load-mode flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition ${
                  tab === key
                    ? "border-brand-500 bg-brand-50 dark:border-brand-600 dark:bg-brand-950/30"
                    : "border-surface-200 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800/50"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0 text-brand-600" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-surface-900 dark:text-white">{title}</span>
                  <span className="block truncate text-[11px] text-surface-500">{sub}</span>
                </span>
              </button>
            ))}
          </div>

          {tab === "udhaar" || tab === "receive" ? (
            <UdhaarForm
              kaam={tab === "udhaar" ? "diya" : "wapsi"}
              people={udhaarPeople}
              financeAccounts={financeAccounts}
              loanAction={loanAction}
              wapsiAction={wapsiAction}
              selectedPerson={ledgerParty}
              onPersonChange={(person) => { setLedgerParty(person); setLastSavedTab(null); }}
              amount={ledgerAmount}
              onAmountChange={(amount) => { setLedgerAmount(amount); setLastSavedTab(null); }}
              note={ledgerNote}
              onNoteChange={(note) => { setLedgerNote(note); setLastSavedTab(null); }}
              onSubmit={() => { submittedTabRef.current = tab; setLastSavedTab(null); }}
              date={ledgerDate}
              onDateChange={(date) => { setLedgerDate(date); setLastSavedTab(null); }}
              account={ledgerAccount}
              onAccountChange={(account) => { setLedgerAccount(account); setLastSavedTab(null); }}
            />
          ) : (
          <form action={action} onSubmit={() => { submittedTabRef.current = tab; setLastSavedTab(null); }} className="load-form space-y-3">
            <input type="hidden" name="kind" value={kind} />

            <div>
              <Label htmlFor="account_id">Paisa kis account se</Label>
              <Select
                id="account_id"
                name="account_id"
                value={accountId}
                onChange={(e) => { setAccountId(e.target.value); setLastSavedTab(null); }}
                required
              >
                {kaamKeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                    {a.float !== null ? ` (${rs(a.float)})` : " (khata juRa nahi)"}
                  </option>
                ))}
              </Select>
            </div>

            {/* Malik (7 September): "Customer select karein... Result
                Existing Farmer/Member/Customer master se aaye." Ye
                chunaHua yahin se mobile number aur naam auto-fill karta
                hai (neeche), aur "khata" method par isi ka party_type/
                party_id ledger mein jata hai. */}
            <div>
              <Label htmlFor="main_party">Customer (marzi ka — Guest bhi chal jata hai)</Label>
              <PersonPicker people={udhaarPeople} partyTypeName="party_type" partyIdName="party_id" onChange={(person) => { setMainParty(person); setTypedCustomerName(person?.name ?? ""); setLastSavedTab(null); }} />
              {mainParty && (
                <div className="mt-2">
                  <PartyStrip person={mainParty} />
                </div>
              )}
              <p className="mt-1 text-[11px] text-surface-500">
                Fehrist mein na ho to Guest/Walk-in maan kar aage barhein — har mobile-load customer ko
                farmer banana zaroori nahi.
              </p>
            </div>

            <div>
              <Label htmlFor="reference">
                {kind === "load" ? "Mobile number" : "Consumer / reference number"}
              </Label>
              <Input
                id="reference"
                name="reference"
                required
                inputMode="numeric"
                value={reference}
                onChange={(e) => { setReference(e.target.value); setLastSavedTab(null); }}
                placeholder={kind === "load" ? "0301 2345678" : "118752345678"}
              />
              {kind === "load" && mainParty?.phone && reference && reference !== mainParty.phone && (
                <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                  Profile number: {mainParty.phone} — load doosre number ({reference}) par ja raha hai.
                  Financial transaction phir bhi {mainParty.name} ke khate mein hi jayegi.
                </p>
              )}
            </div>

            {kind === "load" && (
              <div>
                <Label htmlFor="provider_id">Network</Label>
                <Select
                  id="provider_id"
                  name="provider_id"
                  required
                  value={providerId}
                  onChange={(e) => { setProviderId(e.target.value); setLastSavedTab(null); }}
                >
                  <option value="">— chunein —</option>
                  {kaamKeProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                {andaza && !providerId && (
                  <p className="mt-1 text-[11px] text-surface-500">Andaza: {andaza} — sahi na ho to badal dein.</p>
                )}
              </div>
            )}

            {kind === "bill" && (
              <>
                <div>
                  <Label htmlFor="provider_id">Kis cheez ka bill</Label>
                  <Select id="provider_id" name="provider_id" required defaultValue="" onChange={() => setLastSavedTab(null)}>
                    <option value="">— chunein —</option>
                    {kaamKeProviders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bill_category">Bill ki qism</Label>
                  <Select id="bill_category" name="bill_category" value={billCategory} onChange={(event) => { setBillCategory(event.target.value); setLastSavedTab(null); }}>
                    <option value="">— chunein —</option>
                    <option value="electricity">Bijli</option>
                    <option value="gas">Gas</option>
                    <option value="internet">Internet / PTCL</option>
                    <option value="postpaid">Mobile postpaid</option>
                    <option value="other">Deegar</option>
                  </Select>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="principal">{kind === "load" ? "Load ki raqam" : "Bill ki raqam"}</Label>
              {kind === "load" && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {RAQAM.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => { setPrincipal(String(r)); setLastSavedTab(null); }}
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
                onChange={(e) => { setPrincipal(e.target.value); setLastSavedTab(null); }}
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
              <Label htmlFor="paisa_kahan">Payment kahan aayi</Label>
              {/* EK FEHRIST, ASAL KHATON KE SATH.
                  Pehle yahan sirf qism likhi thi -- "Bank / Card",
                  "Wallet" -- aur khata chunne ka khana us ke BAAD alag
                  se khulta tha, wo bhi sirf "Bank" par.

                  Malik (6 September): *"yahan jo hamare ACTUAL account
                  hain wo aane chahiyen ke kis account mein payment hui
                  hai... jaise hi bank select hua hamein pata ho ga ye
                  is bank mein hai; JazzCash to pata hai, Easypaisa hai
                  to pata hai, QR code hai to pata hai."*

                  Wo theek keh rahe the. Counter par khara banda "qism"
                  nahi sochta -- wo ye sochta hai ke "paisa Easypaisa
                  mein aaya". Us se qism poochna aur phir khata poochna
                  do sawal hain jahan ek kaafi tha; aur usi do-qadam ki
                  wajah se 6 September ko wo "Wallet" chun baithe (jo is
                  nizam mein CUSTOMER ka jama shuda paisa hai, hamara
                  Easypaisa nahi) aur khate ka khana khula hi nahi.

                  Ab ek hi fehrist hai. Andar ki qism (`payment_method`)
                  aur khata (`finance_account_id`) chhupe hue khanon
                  mein jate hain -- server ka hisaab bilkul wahi rehta
                  hai. */}
              <Select
                id="paisa_kahan"
                value={paisaKahan}
                onChange={(e) => { setPaisaKahan(e.target.value); setLastSavedTab(null); }}
              >
                <option value="cash">Cash — golak mein aaya</option>
                {financeAccounts.map((f) => (
                  <option key={f.id} value={`acct:${f.id}`}>
                    {f.name}
                  </option>
                ))}
                <option value="wallet">Customer ke apne wallet se</option>
                <option value="khata">Khata — udhaar likh dein</option>
              </Select>
              <input type="hidden" name="payment_method" value={method} />
              <input type="hidden" name="finance_account_id" value={chunaHuaKhata} />
            </div>

            <div>
              <Label htmlFor="service_charge">Customer se extra (service charge)</Label>
              <Input
                id="service_charge"
                name="service_charge"
                inputMode="decimal"
                value={serviceCharge}
                onChange={(e) => { setServiceCharge(e.target.value); setLastSavedTab(null); }}
                placeholder="khali chhor dein agar extra nahi liya"
              />
              <p className="mt-1 text-[11px] text-surface-500">
                Khali = customer se kuch extra nahi liya. Sifar likhne ki zaroorat nahi.
              </p>
            </div>

            {/* Khata par likhna hai to KIS ka khata -- ye ab upar
                "Customer" wale khane se hi tay hota hai (7 September ka
                naya design). Pehle ye sawal sirf method === "khata" par
                alag se poocha jata tha; ab customer poori transaction
                ke liye ek hi baar chunte hain, aur wohi party_type/
                party_id hidden khane (upar wale PersonPicker mein) is
                udhaar ke ledger mein jate hain -- cash par server
                khud unhein nazarandaz kar deta hai. */}

            <div>
              <Label htmlFor="customer_name">Customer ka naam (marzi ka)</Label>
              <NameSuggest
                key={mainParty ? `${mainParty.type}:${mainParty.id}` : "guest"}
                id="customer_name"
                name="customer_name"
                people={udhaarPeople}
                defaultValue={mainParty?.name ?? ""}
                placeholder="Guest / Walk-in — chhora ja sakta hai"
                onChange={(name) => { setTypedCustomerName(name); setLastSavedTab(null); }}
              />
            </div>

            {/* Saboot -- is poore safhe ki sab se ahem cheez. */}
            <div className="load-form-wide load-form-evidence rounded-lg border border-brand-200 bg-brand-50/50 p-3 dark:border-brand-900/40 dark:bg-brand-950/20">
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
                  onChange={(e) => { setSettled(e.target.checked); setLastSavedTab(null); }}
                  className="mt-0.5"
                />
                <span className="text-xs leading-relaxed text-surface-600 dark:text-surface-300">
                  <b>Bill provider tak pahunch gaya.</b> Nishan hata dein agar paisa abhi hamare paas hai
                  (provider band tha, raat ko jama hoga) — tab wo paisa hamara nahi, customer ka bojh hai.
                </span>
              </label>
            )}

            <div className="load-form-wide load-form-total rounded-lg bg-surface-50 p-3 text-sm dark:bg-surface-800/50">
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
          )}
        </Card>

        {/* -------- Aaj ka hisaab -------- */}
        <aside className="load-live-summary" aria-live="polite">
          <div className="load-summary-title"><div><h2>Live Transaction Summary</h2><span><i /> {currentActionSucceeded ? "Saved · receipt ready" : "Ready to process"}</span></div><CheckCircle2 aria-hidden="true" /></div>
          <dl>
            <div><dt>Service</dt><dd>{serviceTitle}</dd></div>
            <div><dt>Customer</dt><dd>{(tab === "udhaar" || tab === "receive" ? ledgerParty?.name : mainParty?.name) || "Walk-in"}</dd></div>
            {tab === "load" || tab === "bill" ? <>
              <div><dt>{tab === "load" ? "Mobile / Account" : "Reference"}</dt><dd>{reference || "—"}</dd></div>
              <div><dt>{tab === "load" ? "Network" : "Provider"}</dt><dd>{kaamKeProviders.find((provider) => provider.id === providerId)?.name || "—"}</dd></div>
              {tab === "bill" && <div><dt>Bill type</dt><dd>{BILL_CATEGORY_LABELS[billCategory] || "—"}</dd></div>}
              <div><dt>Float account</dt><dd>{chunaHua?.title || "—"}</dd></div>
              <div><dt>Payment received in</dt><dd>{receivedIn}</dd></div>
              <div><dt>Amount</dt><dd>{rs(raqam)}</dd></div>
              <div><dt>Service charge</dt><dd>{rs(charge)}</dd></div>
              <div className="load-summary-total"><dt>Customer pays</dt><dd>{rs(customerPays)}</dd></div>
              <div className="load-summary-income"><dt>Staff income</dt><dd>{charge ? rs(charge) : "—"}</dd></div>
            </> : <>
              <div><dt>Accounting</dt><dd>{tab === "udhaar" ? "Customer balance increases" : "Customer balance decreases"}</dd></div>
              <div><dt>Amount</dt><dd>{rs(Number(ledgerAmount.replace(/,/g, "")) || 0)}</dd></div>
              <div><dt>Payment account</dt><dd>{ledgerAccount === "cash" ? "Cash" : financeAccounts.find((account) => account.id === ledgerAccount)?.name || "—"}</dd></div>
            </>}
          </dl>
          <div className="load-summary-footer">
            <p>Today&apos;s {serviceTitle} entries: <b>{currentTransactionCount}</b>{(tab === "load" || tab === "bill") ? <> · service income <b>{rs(kamaya)}</b></> : null}</p>
            {sabootBaqi > 0 && <p className="load-warning"><Clock aria-hidden="true" /> {sabootBaqi} proof pending</p>}
            {adaBaqi > 0 && <p className="load-warning">{adaBaqi} bill payment unsettled</p>}
          </div>
          <div className="load-summary-actions">
            <button type="button" onClick={() => printDeskSlip(currentSlip)} disabled={amountForSlip <= 0}>
              <Printer aria-hidden="true" /> {currentActionSucceeded ? "Print Receipt" : "Print Slip Preview"}
            </button>
            <a href={whatsAppHref} target="_blank" rel="noreferrer" aria-disabled={!quickPhone} tabIndex={quickPhone ? 0 : -1} className={!quickPhone ? "is-disabled" : ""}>
              <MessageCircle aria-hidden="true" /> WhatsApp
            </a>
          </div>
          {!currentActionSucceeded && <p className="load-slip-hint">Preview slip hai; final receipt ke liye pehle transaction save karein.</p>}
        </aside>
      </div>

      <section className="load-transactions desk-card" aria-label="Today's transactions">
        <div className="load-transactions-heading">
          <h2><FileText aria-hidden="true" /> Today&apos;s Transactions <span>({transactions.length})</span></h2>
          <div className="load-transaction-filters" role="tablist" aria-label="Filter transactions">
            {([
              ["all", "All"], ["load", "Load"], ["bill", "Bill"], ["udhaar", "Udhaar"], ["recovery", "Recovery"], ["pending", "Pending"],
            ] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={transactionFilter === key} onClick={() => setTransactionFilter(key)}>{label}</button>)}
          </div>
          <Link href="/admin/load-bill" className="load-view-all">View All →</Link>
        </div>
        <div className="load-transactions-table-wrap">
          <table className="load-transactions-table">
            <thead><tr><th>Time</th><th>Customer / Reference</th><th>Type</th><th className="text-right">Amount</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {visibleTransactions.map((transaction) => {
                const t = transaction.source;
                return <tr key={transaction.id}>
                  <td className="tabular-nums">{new Date(transaction.waqt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}</td>
                  <td><span className="load-transaction-customer">{transaction.customer}</span>{transaction.kind === "load" && <small>{transaction.reference}</small>}</td>
                  <td><span className={`load-kind-badge load-kind-${transaction.kind}`}>{transaction.kind === "load" ? "Mobile Load" : transaction.kind === "bill" ? "Bill Payment" : transaction.kind === "udhaar" ? "Udhaar" : "Recovery"}</span></td>
                  <td className="text-right tabular-nums">{rs(transaction.amount + transaction.serviceCharge)}</td>
                  <td>{transaction.status === "pending" ? <Badge tone="amber">Pending</Badge> : transaction.status === "wapas" ? <Badge tone="red">Reversed</Badge> : <Badge tone="green">Completed</Badge>}</td>
                  <td><div className="load-history-actions">
                    <button type="button" title="Print receipt" aria-label={`Print ${transaction.kind} receipt`} onClick={() => printDeskSlip({
                      title: `${transaction.kind === "load" ? "Mobile Load" : transaction.kind === "bill" ? "Bill Payment" : transaction.kind === "udhaar" ? "Udhaar" : "Recovery"} Receipt`,
                      date: new Date(transaction.waqt).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" }),
                      customer: transaction.customer,
                      contact: transaction.kind === "load" ? transaction.reference : undefined,
                      provider: transaction.provider === "—" ? undefined : transaction.provider,
                      billCategory: t?.billCategory ? BILL_CATEGORY_LABELS[t.billCategory] || t.billCategory : undefined,
                      reference: transaction.reference === "—" ? undefined : transaction.reference,
                      amount: transaction.amount,
                      serviceCharge: transaction.serviceCharge,
                      total: transaction.amount + transaction.serviceCharge,
                      account: t?.method,
                      paymentMethod: t?.method,
                      status: transaction.status === "pending" ? "Proof pending" : transaction.status === "wapas" ? "Reversed" : "Completed",
                      receiptNo: t?.number,
                      note: transaction.note,
                    })}><Printer aria-hidden="true" /></button>
                    {t ? <details className="load-row-actions"><summary>Manage</summary><div>
                    {t.status === "saboot_baqi" && <form action={tidAction}><input type="hidden" name="id" value={t.id}/><Input name="provider_tid" placeholder="Provider TID" required/><Button type="submit" size="sm" variant="secondary">Save TID</Button></form>}
                    {t.kind === "bill" && !t.settled && t.status !== "wapas" && <form action={settleAction}><input type="hidden" name="id" value={t.id}/><Button type="submit" size="sm" variant="secondary">Mark paid</Button></form>}
                    {canReverse && t.status === "darj" && t.commissionStatus === "muntazir" && <form action={commAction}><input type="hidden" name="id" value={t.id}/><Input name="rakam" inputMode="decimal" placeholder="Commission" required/><Select name="kahan" defaultValue="float"><option value="float">Provider float</option>{financeAccounts.map((account)=><option key={account.id} value={account.id}>{account.name}</option>)}</Select><Button type="submit" size="sm" variant="secondary">Confirm</Button></form>}
                    {canReverse && t.status !== "wapas" && <form action={revAction}><input type="hidden" name="id" value={t.id}/><Input name="reason" placeholder="Reason for reversal" required/><Button type="submit" size="sm" variant="ghost">Reverse</Button></form>}
                    </div></details> : <span className="text-surface-400">—</span>}
                  </div></td>
                </tr>;
              })}
              {visibleTransactions.length === 0 && <tr><td colSpan={6} className="load-empty-row">No transactions in this filter today.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <button type="button" className="load-quick-view-trigger" aria-expanded={quickViewOpen} onClick={() => setQuickViewOpen((open) => !open)}>
        {quickViewOpen ? <X aria-hidden="true" /> : <span aria-hidden="true">‹</span>} Customer Quick View
      </button>
      {quickViewOpen && <aside className="load-quick-view" role="dialog" aria-label="Customer Quick View">
        <div className="load-quick-view-heading"><h2>Customer Quick View</h2><button type="button" aria-label="Close" onClick={() => setQuickViewOpen(false)}><X aria-hidden="true" /></button></div>
        {activeParty ? <>
          <p className="load-quick-view-name">{activeParty.name}</p>
          <p>{activeParty.type === "farmer" ? "Farmer" : "Customer"}{activeParty.phone ? ` · ${activeParty.phone}` : ""}</p>
          <div className="load-quick-view-balance"><span>Known khata balance</span><b>{activeParty.balance == null ? "Not available" : rs(activeParty.balance)}</b></div>
          <Link href={activeParty.type === "farmer" ? `/admin/farmers/${activeParty.id}` : `/admin/crm/${activeParty.id}`} onClick={() => setQuickViewOpen(false)}>Open profile →</Link>
        </> : <p>Form mein customer ya farmer select karein; us ka quick detail yahan nazar aayega.</p>}
      </aside>}
    </div>
  );
}

/**
 * Naqad udhaar -- diya, aur wapas aaya.
 *
 * Do baatein jaan boojh kar:
 *
 * 1. **Customer chunte hi us ka baqi saamne aata hai.** Counter par
 *    faisla isi adad se badalta hai. Baqi maloom hi na ho to banda naya
 *    udhaar de deta hai -- aur yehi wajah hai ke ye adad chhupaya nahi
 *    ja sakta.
 *
 * 2. **NULL aur sifar alag likhe jate hain.** Jis customer ka hisaab
 *    abhi shuru hi nahi hua us ke saamne "Rs 0" likh dena jhoot hai --
 *    wahan "hisaab shuru nahi hua" likha jata hai.
 *
 * `kaam` ab bahar se, tab se tay hota hai ("Udhaar" bnam "Payment
 * Receive") -- pehle yahan andar ek toggle hota tha, jo malik ke asal
 * wireframe ("Payment Receive" apna alag khana) se match nahi karta
 * tha.
 */
function UdhaarForm({
  kaam,
  people,
  financeAccounts,
  loanAction,
  wapsiAction,
  selectedPerson,
  onPersonChange,
  amount,
  onAmountChange,
  note,
  onNoteChange,
  onSubmit,
  date,
  onDateChange,
  account,
  onAccountChange,
}: {
  kaam: "diya" | "wapsi";
  people: PersonOption[];
  financeAccounts: { id: string; name: string }[];
  loanAction: (fd: FormData) => void;
  wapsiAction: (fd: FormData) => void;
  selectedPerson: PersonOption | null;
  onPersonChange: (person: PersonOption | null) => void;
  amount: string;
  onAmountChange: (amount: string) => void;
  note: string;
  onNoteChange: (note: string) => void;
  onSubmit: () => void;
  date: string;
  onDateChange: (date: string) => void;
  account: string;
  onAccountChange: (account: string) => void;
}) {
  const chuna = selectedPerson;
  const diya = kaam === "diya";

  return (
    <form action={diya ? loanAction : wapsiAction} onSubmit={onSubmit} className="load-form space-y-3">
      <div>
        <Label htmlFor="udhaar_customer">Kis ka — customer ya kisan</Label>
        <PersonPicker
          people={people}
          partyTypeName="party_type"
          partyIdName="party_id"
          onChange={onPersonChange}
        />
        {chuna && (
          <div className="mt-2">
            <PartyStrip person={chuna} />
          </div>
        )}
        <p className="mt-1 text-[11px] text-surface-500">
          Fehrist mein na ho to pehle CRM ya Farmers par us ka indraj karein.
        </p>
      </div>

      <div>
        <Label htmlFor="udhaar_rakam">Raqam</Label>
        <Input id="udhaar_rakam" name="rakam" required inputMode="decimal" placeholder="5000" value={amount} onChange={(event) => onAmountChange(event.target.value)} />
      </div>

      <div>
        <Label htmlFor="udhaar_khata">{diya ? "Paisa kahan se gaya" : "Paisa kahan aaya"}</Label>
        <Select id="udhaar_khata" name={diya ? "kahan_se" : "kahan_aaya"} value={account} onChange={(event) => onAccountChange(event.target.value)}>
          <option value="cash">Cash — golak</option>
          {financeAccounts.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="udhaar_tareekh">Kis din</Label>
        <Input id="udhaar_tareekh" name="tareekh" type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
      </div>

      <div className="load-form-wide">
        <Label htmlFor="udhaar_wajah">Wajah / note (marzi ka)</Label>
        <Input
          id="udhaar_wajah"
          name="wajah"
          placeholder={diya ? "jaise: beej ke liye" : "jaise: fasal bikne par"}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      </div>

      <div className="load-form-wide rounded-lg bg-surface-50 p-3 text-xs leading-relaxed text-surface-600 dark:bg-surface-800/50 dark:text-surface-300">
        {diya ? (
          <>
            Ye <b>bikri nahi</b> hai — koi maal nahi gaya, sirf paisa gaya. Is liye is se nafa nahi banta;
            raqam <b>&ldquo;Customer se lena&rdquo;</b> par chali jati hai aur us ke khate mein nazar aati
            hai.
          </>
        ) : (
          <>
            Raqam customer ke khate se <b>kam</b> ho jayegi aur jis khate mein aayi us mein <b>baRh</b>
            jayegi — dono ek sath.
          </>
        )}
      </div>

      <Submit label={diya ? "Udhaar darj karein" : "Wapsi darj karein"} />
    </form>
  );
}
