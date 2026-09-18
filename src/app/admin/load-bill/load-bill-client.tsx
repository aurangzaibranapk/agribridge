"use client";

import { useEffect, useMemo, useState } from "react";
import { aajKaKhana } from "@/lib/utils/format";
import { useFormState, useFormStatus } from "react-dom";
import {
  Smartphone,
  FileText,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HandCoins,
  Banknote,
  Activity,
  Search,
  UserRound,
  Phone,
  Percent,
  Info,
  X,
} from "lucide-react";
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
  type UdhaarReceipt,
} from "@/actions/customer-udhaar";
import { SimpleReceiptModal } from "@/components/load-bill/simple-receipt-modal";

const initial: LoadState = {};
const udhaarInitial: UdhaarState = {};

// Malik (16 September): "AgriBridge load BHEJTA nahi" -- isi tarah ye
// safha khud ek dukan nahi, Al Rana Traders ka counter hai. Receipt par
// yehi naam jata hai, chahe kaam kisi bhi shop se ho raha ho.
const SELLER_NAME = "Al Rana Traders";

interface ReceiptRowData {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "red" | "amber";
}

interface ReceiptData {
  title: string;
  txnNumber: string;
  date: string;
  rows: ReceiptRowData[];
  totalLabel: string;
  totalValue: string;
  customerName?: string | null;
  customerPhone?: string | null;
  footerNote?: string | null;
}

function methodDisplay(method: string): string {
  if (method === "cash") return "Cash";
  if (method === "bank") return "Bank";
  if (method === "wallet") return "Customer Wallet";
  if (method === "khata") return "Khata (Udhaar)";
  return method;
}

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

// Malik (7 September): "50 ka load kabhi nahi hota, minimum 100 rupay hai."
const RAQAM = [100, 200, 500, 1000];

// Malik (16 September, Staff Sales Desk): udhaar KIS liye diya/liya —
// sirf reporting ke liye, ledger ka khata (1100/1150) hamesha wahi ek
// rehta hai chahe qism koi bhi ho. Pehla hamesha default.
const UDHAAR_CATEGORIES = [
  "Raqam / Cash Udhaar",
  "FMCG Udhaar",
  "Khaad Udhaar",
  "Wanda Udhaar",
  "Pesticide Udhaar",
  "Milk Payment Incoming",
  "Machinery Khata",
];

function rs(n: number): string {
  return `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

/** Mobile Load / Bill Payment ki qatar se receipt ka data. */
function txnReceipt(t: Txn): ReceiptData {
  const rows: ReceiptRowData[] = [
    { label: t.kind === "load" ? "Network" : "Provider", value: t.provider },
    { label: t.kind === "load" ? "Mobile Number" : "Consumer / Reference No.", value: t.reference },
    { label: t.kind === "load" ? "Load Amount" : "Bill Amount", value: rs(t.principal) },
  ];
  if (t.serviceCharge) rows.push({ label: "Service Charge", value: rs(t.serviceCharge) });
  rows.push({ label: "Payment Method", value: methodDisplay(t.method) });
  if (t.kind === "bill") {
    rows.push({
      label: "Status",
      value: t.settled ? "Provider tak pahunch gaya" : "Abhi float mein — ada baqi",
      tone: t.settled ? undefined : "amber",
    });
  }
  return {
    title: t.kind === "load" ? "Mobile Load" : "Bill Payment",
    txnNumber: t.number,
    date: t.waqt,
    rows,
    totalLabel: "Total",
    totalValue: rs(t.principal + (t.serviceCharge ?? 0)),
    customerName: t.customer,
    // Load ka "reference" khud customer ka mobile number hai. Bill ka
    // reference consumer number hai -- kisi ka mobile number nahi, is
    // liye WhatsApp button wahan number khali chhoR kar khud khulega.
    customerPhone: t.kind === "load" ? t.reference : null,
    footerNote:
      t.status === "saboot_baqi"
        ? "Saboot baqi — provider ki TID abhi lagni baqi hai."
        : t.tid
          ? `Provider TID: ${t.tid}`
          : null,
  };
}

/** Udhaar / Recovery ki UdhaarReceipt se receipt ka data. */
function udhaarReceipt(kaam: "diya" | "wapsi", r: UdhaarReceipt): ReceiptData {
  const diya = kaam === "diya";
  const baqiKhali = Math.abs(r.balanceAfter) < 0.005;
  const credit = r.balanceAfter < -0.005;
  return {
    title: diya ? "Udhaar" : "Recovery",
    txnNumber: r.entryNumber,
    date: r.date,
    rows: [
      { label: "Category", value: r.category ?? "—" },
      { label: diya ? "Amount Given" : "Amount Received", value: rs(r.amount) },
      { label: diya ? "Paid From" : "Received In", value: r.method },
      ...(r.reference ? [{ label: "Reference", value: r.reference }] : []),
    ],
    totalLabel: diya ? "Balance Due" : credit ? "Credit Balance" : "Balance Remaining",
    totalValue: baqiKhali ? "Rs 0 — Clear" : rs(Math.abs(r.balanceAfter)),
    customerName: r.name,
    customerPhone: r.phone,
    footerNote: diya
      ? "Ye udhaar hai — bikri nahi, sirf naqad udhaar."
      : credit
        ? "Zyada aaya paisa credit mein jama — agli udhaar ya kharche mein khud katega."
        : null,
  };
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
  shops,
  defaultShopId,
  providers,
  accounts,
  financeAccounts,
  customers,
  farmers,
  today,
  canReverse,
  cashInHand,
  todayRecovery,
}: {
  /** POS se aate waqt kaunsa khana khula ho — "Mobile Load" ya "Bill Payment". */
  shuruKind: "load" | "bill";
  /** Shaam ko "is shop se kitna hua" poochne ke liye (425) -- account se nahi nikalta. */
  shops: { id: string; name: string }[];
  defaultShopId: string | null;
  providers: Provider[];
  accounts: Account[];
  financeAccounts: { id: string; name: string }[];
  customers: { id: string; name: string; balance: number | null }[];
  farmers: { id: string; name: string; phone: string | null; cnic: string | null; farmerCode: string }[];
  today: Txn[];
  canReverse: boolean;
  /** finance_accounts (cash type) ka balance jama -- honest adad, andaza nahi. */
  cashInHand: number;
  /** Ledger se seedha — customer/kisan udhaar ki aaj ki wapasi (page.tsx dekhein). */
  todayRecovery: number;
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
  const [txnFilter, setTxnFilter] = useState<"all" | "load" | "bill" | "udhaar" | "receive" | "pending">("all");
  const kind: "load" | "bill" = tab === "load" || tab === "bill" ? tab : "load";
  const [state, action] = useFormState(createLoadTransaction, initial);
  const [tidState, tidAction] = useFormState(attachProviderTid, initial);
  const [settleState, settleAction] = useFormState(settleBill, initial);
  const [revState, revAction] = useFormState(reverseLoadTransaction, initial);
  const [commState, commAction] = useFormState(confirmLoadCommission, initial);
  const [loanState, loanAction] = useFormState(giveCustomerLoan, udhaarInitial);
  const [wapsiState, wapsiAction] = useFormState(takeCustomerRepayment, udhaarInitial);

  /**
   * Receipt/Slip -- Print aur WhatsApp ke liye.
   *
   * Malik (16 September): "Mobile Load, Bill Payment, Udhaar aur
   * Recovery -- chaaron ke liye proper related Print Receipt/Slip
   * banayein... WhatsApp receipt add karein, jisme sirf us transaction
   * ki correct information ho."
   *
   * Char taraf se ek hi jaga jama hota hai: Udhaar/Recovery server ka
   * verified balance deta hai (isi liye us se banta hai), Load/Bill
   * abhi jo form mein tha wohi save hua hai is liye usi se ban jata
   * hai -- dono soorton mein jo dikhta hai wahi sach hai, andaza nahi.
   */
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  function showReceipt(data: ReceiptData) {
    setReceipt(data);
    setReceiptOpen(true);
  }
  useEffect(() => {
    if (loanState.success && loanState.receipt) showReceipt(udhaarReceipt("diya", loanState.receipt));
  }, [loanState]);
  useEffect(() => {
    if (wapsiState.success && wapsiState.receipt) showReceipt(udhaarReceipt("wapsi", wapsiState.receipt));
  }, [wapsiState]);

  const [showTransactions, setShowTransactions] = useState(false);

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

  /**
   * Udhaar/Payment Receive tab ka apna banda aur baqi khane — yahan
   * (parent mein) taake "Live Summary" panel usay turant dikha sake.
   */
  const [udhaarParty, setUdhaarParty] = useState<PersonOption | null>(null);
  const [udhaarAmount, setUdhaarAmount] = useState("");
  const [udhaarAccount, setUdhaarAccount] = useState("cash");
  const [udhaarCategory, setUdhaarCategory] = useState(UDHAAR_CATEGORIES[0]);
  const [udhaarReference, setUdhaarReference] = useState("");

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
  const [shopId, setShopId] = useState(defaultShopId ?? "");
  const [principal, setPrincipal] = useState("");
  const [serviceCharge, setServiceCharge] = useState("");
  const [reference, setReference] = useState("");
  const [providerTid, setProviderTid] = useState("");

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
  const [billCategory, setBillCategory] = useState("");

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
  const [savePending, setSavePending] = useState(false);

  const chunaHua = accounts.find((a) => a.id === accountId) ?? null;
  const raqam = Number(principal.replace(/,/g, "")) || 0;
  const charge = Number(serviceCharge.replace(/,/g, "")) || 0;
  const kamPara =
    chunaHua?.float !== null && chunaHua !== null && raqam > 0 && chunaHua.float! < raqam;

  const aajKaKaam = today.filter((t) => t.status !== "wapas");
  const handled = aajKaKaam.reduce((s, t) => s + t.principal, 0);
  const sabootBaqi = aajKaKaam.filter((t) => t.status === "saboot_baqi").length;
  const staffIncome = charge;
  const selectedProvider = kaamKeProviders.find((p) => p.id === providerId)?.name ?? "—";
  const selectedFinanceAccount = financeAccounts.find((a) => a.id === udhaarAccount)?.name;
  const filteredTransactions = today.filter((t) => {
    if (txnFilter === "all") return true;
    if (txnFilter === "pending") return t.status === "saboot_baqi" || !t.settled;
    return t.kind === txnFilter;
  });

  // Load/Bill save hote hi wohi form-state se receipt bhi ban jati hai
  // -- server yahi qadrein bina badle darj karta hai (principal/charge/
  // reference), is liye ye "andaza" nahi, jo save hua wahi hai.
  useEffect(() => {
    if (!state.success || !state.txnNumber) return;
    showReceipt(
      txnReceipt({
        id: state.txnNumber,
        number: state.txnNumber,
        kind,
        reference,
        principal: raqam,
        serviceCharge: charge || null,
        commissionExpected: null,
        commissionConfirmed: null,
        commissionStatus: "muntazir",
        method,
        tid: providerTid || null,
        status: providerTid ? "darj" : "saboot_baqi",
        settled,
        customer: mainParty?.name ?? null,
        waqt: new Date().toISOString(),
        provider: selectedProvider,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const paighaam =
    state.error ?? tidState.error ?? settleState.error ?? revState.error ?? commState.error ?? loanState.error ?? wapsiState.error;
  const khushKhabri =
    state.notice ?? tidState.notice ?? settleState.notice ?? revState.notice ?? commState.notice ?? loanState.notice ?? wapsiState.notice;

  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (event.key === "F1") { event.preventDefault(); setTab("load"); }
      if (event.key === "F2") { event.preventDefault(); setTab("bill"); }
      if (event.key === "F3") { event.preventDefault(); setTab("udhaar"); }
      if (event.key === "F4") { event.preventDefault(); setTab("receive"); }
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pb-1">
      {/* -------- Aaj ka khulasa: Float, Cash, Sales, Recovery, Pending Proof -------- */}
      <div className="grid shrink-0 grid-cols-2 gap-4 pb-1 md:grid-cols-5">
        <Card className="flex min-h-24 items-center gap-4 border-brand-200 px-5 py-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Wallet className="h-7 w-7" /></div>
          <div><p className="text-sm text-surface-600">Float Balance</p><p className="mt-1 font-display text-2xl font-bold tabular-nums text-surface-950 dark:text-white">{accounts.some((a) => a.float === null) ? "—" : rs(accounts.reduce((s, a) => s + (a.float ?? 0), 0))}</p></div>
        </Card>
        <Card className="flex min-h-24 items-center gap-4 px-5 py-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Banknote className="h-7 w-7" /></div>
          <div><p className="text-sm text-surface-600">Cash in Hand</p><p className="mt-1 font-display text-2xl font-bold tabular-nums text-surface-950 dark:text-white">{rs(cashInHand)}</p></div>
        </Card>
        <Card className="flex min-h-24 items-center gap-4 px-5 py-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Activity className="h-7 w-7" /></div>
          <div><p className="text-sm text-surface-600">Today Sales</p><p className="mt-1 font-display text-2xl font-bold tabular-nums text-surface-950 dark:text-white">{rs(handled)}</p></div>
        </Card>
        <Card className="flex min-h-24 items-center gap-4 px-5 py-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><HandCoins className="h-7 w-7" /></div>
          <div><p className="text-sm text-surface-600">Today Recovery</p><p className="mt-1 font-display text-2xl font-bold tabular-nums text-surface-950 dark:text-white">{rs(todayRecovery)}</p></div>
        </Card>
        <Card className="flex min-h-24 items-center gap-4 border-amber-200 bg-amber-50/40 px-5 py-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700"><FileText className="h-7 w-7" /></div>
          <div><p className="text-sm text-surface-600">Pending Proof</p><p className="mt-1 font-display text-2xl font-bold tabular-nums text-surface-950 dark:text-white">{sabootBaqi}</p></div>
        </Card>
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

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem_2.75rem]">
        {/* -------- Form -------- */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
            {(
              [
                { key: "load", title: "Mobile Load", sub: "Customer ka mobile load", Icon: Smartphone },
                { key: "bill", title: "Bill Payment", sub: "Bijli, gas, internet", Icon: FileText },
                { key: "udhaar", title: "Udhaar", sub: "Dukan se naqad gaya", Icon: HandCoins },
                { key: "receive", title: "Payment Receive", sub: "Wapas aaya / credit jama", Icon: Banknote },
              ] as const
            ).map(({ key, title, sub, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex min-h-16 items-center gap-3 rounded-xl border px-5 py-3 text-left transition ${
                  tab === key
                    ? "border-brand-700 bg-brand-700 text-white shadow-sm dark:border-brand-600 dark:bg-brand-800"
                    : "border-surface-200 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800/50"
                }`}
              >
                <Icon className={`h-7 w-7 shrink-0 ${tab === key ? "text-white" : "text-brand-700"}`} />
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold ${tab === key ? "text-white" : "text-surface-900 dark:text-white"}`}>{title}</span>
                  <span className={`block truncate text-xs ${tab === key ? "text-brand-100" : "text-surface-500"}`}>{sub}</span>
                </span>
              </button>
            ))}
          </div>

          <Card className="min-h-0 flex-1 overflow-hidden px-5 py-4">
          <div className="min-h-0 h-full overflow-y-auto pr-1">
          {tab === "udhaar" || tab === "receive" ? (
            <UdhaarForm
              kaam={tab === "udhaar" ? "diya" : "wapsi"}
              people={udhaarPeople}
              financeAccounts={financeAccounts}
              loanAction={loanAction}
              wapsiAction={wapsiAction}
              party={udhaarParty}
              onPartyChange={setUdhaarParty}
              amount={udhaarAmount}
              onAmountChange={setUdhaarAmount}
              account={udhaarAccount}
              onAccountChange={setUdhaarAccount}
              category={udhaarCategory}
              onCategoryChange={setUdhaarCategory}
              reference={udhaarReference}
              onReferenceChange={setUdhaarReference}
            />
          ) : (
          <form id="load-bill-form" action={action} className="grid grid-cols-1 gap-x-8 gap-y-3 xl:grid-cols-2">
            <input type="hidden" name="kind" value={kind} />
            <h2 className="xl:col-span-2 text-lg font-bold text-surface-950 dark:text-white">{kind === "load" ? "Mobile Load Details" : "Bill Payment Details"}</h2>

            {/* Malik (7 September): "Customer select karein... Result
                Existing Farmer/Member/Customer master se aaye." Ye
                chunaHua yahin se mobile number aur naam auto-fill karta
                hai (neeche), aur "khata" method par isi ka party_type/
                party_id ledger mein jata hai. */}
            <div>
              <Label htmlFor="main_party">Customer / Guest</Label>
              <PersonPicker people={udhaarPeople} partyTypeName="party_type" partyIdName="party_id" onChange={setMainParty} />
              {mainParty && (
                <div className="mt-2">
                  <PartyStrip person={mainParty} />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="reference">{kind === "load" ? "Mobile Number" : "Consumer / Reference Number"}</Label>
              <Input
                id="reference"
                name="reference"
                required
                inputMode="numeric"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={kind === "load" ? "0301 2345678" : "118752345678"}
              />
            </div>

            <div>
              <Label htmlFor="paisa_kahan">Payment Received In</Label>
              <Select id="paisa_kahan" value={paisaKahan} onChange={(e) => setPaisaKahan(e.target.value)}>
                <option value="cash">Cash — Golak mein aaya</option>
                {financeAccounts.map((f) => <option key={f.id} value={`acct:${f.id}`}>{f.name}</option>)}
                <option value="wallet">Customer ke apne wallet se</option>
                <option value="khata">Khata — udhaar likh dein</option>
              </Select>
              <input type="hidden" name="payment_method" value={method} />
              <input type="hidden" name="finance_account_id" value={chunaHuaKhata} />
            </div>

            <div>
              <Label htmlFor="account_id">From Account</Label>
              <Select id="account_id" name="account_id" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
                {kaamKeAccounts.map((a) => <option key={a.id} value={a.id}>{a.title}{a.float !== null ? ` (${rs(a.float)})` : " (khata juRa nahi)"}</option>)}
              </Select>
            </div>

            {/* Malik (18 September): "Ye kaam kis shop mein ho raha
                hai" wala khana yahan dikhana hi nahi chahiye -- POS
                pehle se khula hota hai, us ke counter se hi shop maloom
                hai. Khamoshi se wohi (defaultShopId) bhej dete hain.
                Agar kisi ke paas na khula shift ho na profile shop
                (dono khali), tab hi ye chunna padta hai -- warna staff
                ko ek fazool sawal roz poochha jata. */}
            {shopId ? (
              <input type="hidden" name="shop_id" value={shopId} />
            ) : (
              <div>
                <Label htmlFor="shop_id">Ye kaam kis shop mein ho raha hai</Label>
                <Select id="shop_id" name="shop_id" value={shopId} onChange={(e) => setShopId(e.target.value)} required>
                  <option value="">— shop chunein —</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="service_charge">Service Charge</Label>
              <div className="relative"><Percent className="absolute left-3 top-2.5 h-4 w-4 text-brand-700" /><Input className="pl-10" id="service_charge" name="service_charge" inputMode="decimal" value={serviceCharge} onChange={(e) => setServiceCharge(e.target.value)} placeholder="20" /></div>
            </div>

            {kind === "load" && (
              <div>
                <Label htmlFor="provider_id">Network</Label>
                <Select
                  id="provider_id"
                  name="provider_id"
                  required
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
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
              <div className="space-y-3">
                <div>
                  <Label htmlFor="provider_id">Kis cheez ka bill</Label>
                  <Select id="provider_id" name="provider_id" required value={providerId} onChange={(event) => setProviderId(event.target.value)}>
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
                  <Select id="bill_category" name="bill_category" value={billCategory} onChange={(event) => setBillCategory(event.target.value)}>
                    <option value="">— chunein —</option>
                    <option value="electricity">Bijli</option>
                    <option value="gas">Gas</option>
                    <option value="internet">Internet / PTCL</option>
                    <option value="postpaid">Mobile postpaid</option>
                    <option value="other">Deegar</option>
                  </Select>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="provider_tid">Provider TID / Reference</Label>
              <Input id="provider_tid" name="provider_tid" disabled={savePending} value={providerTid} onChange={(event) => setProviderTid(event.target.value)} placeholder="Jazz/Easypaisa app se copy karein" />
            </div>

            <div>
              <Label>Quick Amount</Label>
              {kind === "load" && (
                <div className="flex flex-wrap gap-2">
                  {RAQAM.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setPrincipal(String(r))}
                      className={`min-w-20 rounded-lg border px-3 py-2 text-sm transition ${
                        principal === String(r)
                          ? "border-brand-700 bg-brand-700 font-semibold text-white"
                          : "border-surface-200 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800"
                      }`}
                    >
                      Rs {r}
                    </button>
                  ))}
                </div>
              )}
              <Label className="mt-3 block" htmlFor="principal">Custom Amount</Label>
              <Input id="principal" name="principal" required inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="Enter amount" />
              {kamPara && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Is account mein sirf {rs(chunaHua!.float!)} float hai.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 rounded-lg py-1 text-sm text-surface-700 dark:text-surface-200">
                <input type="checkbox" checked={savePending} onChange={(e) => setSavePending(e.target.checked)} className="mt-0.5 h-4 w-4 rounded" />
                <span><b>Save as Pending Proof</b><span className="mt-1 block text-xs font-normal text-surface-500">Nishan laga dein agar abhi customer ne paisa nahi diya.</span></span>
              </label>
              <div className="flex gap-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-xs text-surface-600">
                <Info className="h-5 w-5 shrink-0 text-brand-700" />
                <span>Customer ko load milte hi SMS aayega.<br />Network issues ki surat mein transaction ko Pending Proof mein save kar sakte hain.</span>
              </div>
            </div>

            {/* Khata par likhna hai to KIS ka khata -- ye ab upar
                "Customer" wale khane se hi tay hota hai (7 September ka
                naya design). Pehle ye sawal sirf method === "khata" par
                alag se poocha jata tha; ab customer poori transaction
                ke liye ek hi baar chunte hain, aur wohi party_type/
                party_id hidden khane (upar wale PersonPicker mein) is
                udhaar ke ledger mein jate hain -- cash par server
                khud unhein nazarandaz kar deta hai. */}

            <div className="hidden">
              <Label htmlFor="customer_name">Customer ka naam</Label>
              <NameSuggest
                key={mainParty ? `${mainParty.type}:${mainParty.id}` : "guest"}
                id="customer_name"
                name="customer_name"
                people={udhaarPeople}
                defaultValue={mainParty?.name ?? ""}
                placeholder="Guest / Walk-in — chhora ja sakta hai"
              />
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

          </form>
          )}
          </div>
          </Card>
        </div>

        {/* -------- Live Summary -------- */}
        <div className="min-h-0 space-y-3">
          <Card className="h-full border-surface-200 bg-white px-5 py-4 dark:bg-surface-900">
            <p className="text-lg font-bold text-surface-950 dark:text-white">{tab === "load" ? "Live Load Summary" : tab === "bill" ? "Live Bill Summary" : tab === "udhaar" ? "Live Udhaar Summary" : "Live Recovery Summary"}</p>
            <p className="mt-2 flex items-center gap-2 border-b border-surface-200 pb-3 text-xs text-brand-700"><span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Ready to process</p>
            <div className="mt-4 space-y-4 text-sm">
              {(tab === "load" || tab === "bill") && <>
                <div className="flex justify-between gap-3"><span className="flex items-center gap-2 text-surface-500"><UserRound className="h-4 w-4 text-brand-700" /> Customer</span><b className="max-w-[9rem] truncate">{mainParty?.name ?? "Walk-in"}</b></div>
                <div className="flex justify-between gap-3"><span className="flex items-center gap-2 text-surface-500"><Phone className="h-4 w-4 text-brand-700" /> {kind === "load" ? "Mobile" : "Reference"}</span><b className="truncate">{reference || "—"}</b></div>
                <div className="flex justify-between gap-3"><span className="text-surface-500">{kind === "load" ? "Network" : "Bill Provider"}</span><b className="truncate">{selectedProvider}</b></div>
                {kind === "bill" && <div className="flex justify-between gap-3"><span className="text-surface-500">Bill Type</span><b>{billCategory || "—"}</b></div>}
                <div className="flex justify-between gap-3"><span className="text-surface-500">From Account</span><b className="max-w-[9rem] truncate">{chunaHua?.title ?? "—"}</b></div>
                <div className="flex justify-between"><span className="flex items-center gap-2 text-surface-500"><Banknote className="h-4 w-4 text-brand-700" /> {kind === "load" ? "Load Amount" : "Bill Amount"}</span><b>{rs(raqam)}</b></div>
                <div className="flex justify-between"><span className="flex items-center gap-2 text-surface-500"><Percent className="h-4 w-4 text-brand-700" /> Service Charge</span><b>{charge ? rs(charge) : "—"}</b></div>
                <div className="border-t border-surface-200 pt-4 flex justify-between text-base"><span>Customer Pays</span><b>{rs(raqam + charge)}</b></div>
                <div className="flex justify-between text-base"><span className="text-brand-700">Staff Income</span><b className="text-brand-700">{staffIncome ? rs(staffIncome) : "—"}</b></div>
                <div className="flex justify-between gap-3"><span className="text-surface-500">Provider TID</span><b className="max-w-[9rem] truncate">{providerTid || "Pending"}</b></div>
              </>}
              {(tab === "udhaar" || tab === "receive") && <>
                <div className="flex justify-between gap-3"><span className="flex items-center gap-2 text-surface-500"><UserRound className="h-4 w-4 text-brand-700" /> {tab === "udhaar" ? "Party" : "Customer"}</span><b className="max-w-[9rem] truncate">{udhaarParty?.name ?? "—"}</b></div>
                <div className="flex justify-between gap-3"><span className="text-surface-500">{tab === "udhaar" ? "Category" : "Account / Khata"}</span><b>{udhaarCategory}</b></div>
                {tab === "receive" && <div className="flex justify-between"><span className="text-surface-500">Previous Balance</span><b>{udhaarParty?.balance == null ? "—" : rs(udhaarParty.balance)}</b></div>}
                <div className="flex justify-between"><span className="text-surface-500">{tab === "udhaar" ? "Amount" : "Amount Received"}</span><b>{rs(Number(udhaarAmount) || 0)}</b></div>
                {tab === "receive" && <div className="flex justify-between"><span className="text-surface-500">Remaining Balance</span><b>{udhaarParty?.balance == null ? "—" : rs(Math.max(0, udhaarParty.balance - (Number(udhaarAmount) || 0)))}</b></div>}
                <div className="flex justify-between gap-3"><span className="text-surface-500">{tab === "udhaar" ? "Paid From Account" : "Payment Received In"}</span><b className="max-w-[9rem] truncate">{udhaarAccount === "cash" ? "Cash / Golak" : selectedFinanceAccount ?? "Account"}</b></div>
                {udhaarReference && <div className="flex justify-between gap-3"><span className="text-surface-500">Reference</span><b className="truncate">{udhaarReference}</b></div>}
              </>}
            </div>
            {(tab === "load" || tab === "bill") && (
              <div className="mt-6 border-t border-surface-200 pt-4">
                <Button type="submit" form="load-bill-form" className="h-12 w-full text-base"><CheckCircle2 className="mr-2 h-5 w-5" /> {kind === "load" ? "Load Complete — Save" : "Bill Complete — Save"}</Button>
                <div className="mt-3 grid grid-cols-2 gap-2">
                <Button type="button" variant="secondary" size="sm" disabled={!receipt} onClick={() => setReceiptOpen(true)}>
                  Print Receipt
                </Button>
                <Button type="button" variant="secondary" size="sm" disabled={!receipt} onClick={() => setReceiptOpen(true)}>
                  WhatsApp
                </Button>
                </div>
                {!receipt && <p className="mt-2 text-[11px] text-surface-400">Save karne ke baad receipt yahan se khul sakegi.</p>}
              </div>
            )}
            {(tab === "udhaar" || tab === "receive") && (
              <div className="mt-6 border-t border-surface-200 pt-4">
                <Button type="submit" form={tab === "udhaar" ? "udhaar-form" : "receive-form"} className="h-12 w-full text-base"><CheckCircle2 className="mr-2 h-5 w-5" /> {tab === "udhaar" ? "Udhaar Entry — Save" : "Payment Received — Save"}</Button>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button type="button" variant="secondary" size="sm" disabled={!receipt} onClick={() => setReceiptOpen(true)}>
                    {tab === "udhaar" ? "Print Slip" : "Print Receipt"}
                  </Button>
                  <Button type="button" variant="secondary" size="sm" disabled={!receipt} onClick={() => setReceiptOpen(true)}>
                    WhatsApp
                  </Button>
                </div>
                {!receipt && <p className="mt-2 text-[11px] text-surface-400">Save karne ke baad receipt yahan se khul sakegi.</p>}
              </div>
            )}
          </Card>
        </div>
        <button
          type="button"
          onClick={() => setShowTransactions(true)}
          className="hidden h-64 self-start rounded-xl border border-surface-200 bg-white text-xs font-medium text-surface-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 [writing-mode:vertical-rl] dark:bg-surface-900 dark:text-surface-200 lg:block"
        >
          ‹&nbsp;&nbsp; Today&apos;s Transactions
        </button>
      </div>

      {/* -------- Aaj ki qatarein -------- */}
      {showTransactions && <button type="button" aria-label="Close transactions" onClick={() => setShowTransactions(false)} className="fixed inset-0 z-40 bg-black/25" />}
      <Card className={`${showTransactions ? "fixed" : "hidden"} bottom-4 right-4 top-20 z-50 w-[min(58rem,calc(100vw-2rem))] overflow-hidden p-0 shadow-2xl`}>
        <div className="flex items-center justify-between gap-3 border-b border-surface-100 px-4 py-2 dark:border-surface-800">
          <p className="text-base font-bold text-surface-900 dark:text-white">{tab === "udhaar" ? "Today's Udhaar Entries" : tab === "receive" ? "Today's Recovery Transactions" : "Today's Transactions"}</p>
          <div className="flex items-center gap-1">
            <Search className="mr-1 h-3 w-3 text-surface-400" />
            {(["all", "load", "bill", "pending"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setTxnFilter(filter)}
                className={`rounded-full border px-2.5 py-1 text-[11px] capitalize transition ${txnFilter === filter ? "border-brand-600 bg-brand-600 text-white" : "border-surface-200 text-surface-500 hover:bg-surface-50 dark:border-surface-700"}`}
              >
                {filter}
              </button>
            ))}
            <button type="button" onClick={() => setShowTransactions(false)} className="ml-2 rounded-lg p-1.5 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
        </div>
        {today.length === 0 ? (
          <p className="px-5 py-6 text-sm text-surface-500 dark:text-surface-400">Aaj abhi koi qatar nahi.</p>
        ) : (
          <div className="h-[calc(100%-2.6rem)] overflow-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800/50">
                <tr>
                  <th className="px-4 py-2">Time</th>
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
                {filteredTransactions.map((t) => (
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
                      {t.commissionStatus === "tasdeeq" ? (
                        <span className="font-medium text-brand-700 tabular-nums">
                          {t.commissionConfirmed === null ? "tasdeeq shuda" : rs(t.commissionConfirmed)}
                        </span>
                      ) : t.commissionStatus === "nahi_mili" ? (
                        <span className="text-red-600">nahi mili</span>
                      ) : (
                        <span className="text-surface-400">
                          {t.commissionExpected === null
                            ? "qaida nahi"
                            : `~${rs(t.commissionExpected)} muntazir`}
                        </span>
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
                        {t.status !== "wapas" && (
                          <Button type="button" size="sm" variant="ghost" onClick={() => showReceipt(txnReceipt(t))}>
                            Receipt
                          </Button>
                        )}
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
                        {canReverse &&
                          t.status === "darj" &&
                          t.commissionStatus === "muntazir" && (
                            <form action={commAction} className="flex items-center gap-1">
                              <input type="hidden" name="id" value={t.id} />
                              <Input
                                name="rakam"
                                inputMode="decimal"
                                placeholder="commission"
                                className="h-8 w-24 text-xs"
                                required
                              />
                              <Select name="kahan" className="h-8 w-28 text-xs" defaultValue="float">
                                <option value="float">float mein</option>
                                {financeAccounts.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name}
                                  </option>
                                ))}
                              </Select>
                              <Button type="submit" size="sm" variant="secondary">
                                Mil gayi
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

      {receiptOpen && receipt && (
        <SimpleReceiptModal
          onClose={() => setReceiptOpen(false)}
          sellerName={SELLER_NAME}
          title={receipt.title}
          txnNumber={receipt.txnNumber}
          date={receipt.date}
          rows={receipt.rows}
          totalLabel={receipt.totalLabel}
          totalValue={receipt.totalValue}
          customerName={receipt.customerName}
          customerPhone={receipt.customerPhone}
          footerNote={receipt.footerNote}
        />
      )}
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
  party,
  onPartyChange,
  amount,
  onAmountChange,
  account,
  onAccountChange,
  category,
  onCategoryChange,
  reference,
  onReferenceChange,
}: {
  kaam: "diya" | "wapsi";
  people: PersonOption[];
  financeAccounts: { id: string; name: string }[];
  loanAction: (fd: FormData) => void;
  wapsiAction: (fd: FormData) => void;
  /** Parent mein rakhe hain (Live Summary panel ko dikhane ke liye). */
  party: PersonOption | null;
  onPartyChange: (person: PersonOption | null) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  account: string;
  onAccountChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  reference: string;
  onReferenceChange: (value: string) => void;
}) {
  const diya = kaam === "diya";
  const formId = diya ? "udhaar-form" : "receive-form";
  const remaining = party?.balance == null ? null : Math.max(0, party.balance - (Number(amount) || 0));

  return (
    <form id={formId} action={diya ? loanAction : wapsiAction} className="grid grid-cols-1 gap-x-8 gap-y-2.5 xl:grid-cols-2">
      <h2 className="xl:col-span-2 text-lg font-bold text-surface-950 dark:text-white">{diya ? "Udhaar Entry Details" : "Payment Receive Details"}</h2>
      <div className="space-y-2.5">
        <div>
          <Label htmlFor="udhaar_customer">{diya ? "Dukan / Party" : "Customer / Guest"}</Label>
          <PersonPicker
            people={people}
            partyTypeName="party_type"
            partyIdName="party_id"
            onChange={onPartyChange}
          />
          {party && (
            <div className="mt-2">
              <PartyStrip person={party} />
            </div>
          )}
        </div>
        {/* Malik (18 September): "jo pehle wala kaam wo pehle hona
            chahiye" -- Wapsi (recovery) mein "abhi kitna baqi hai" wo
            sawal hai jo Amount se PEHLE dekhna hota hai (faisla isi se
            hota hai), is liye Category se pehle aata hai; Udhaar
            (diya) mein ye sawal hai hi nahi, wahan tarteeb wahi purani. */}
        {!diya && (
          <div>
            <Label>Outstanding Balance</Label>
            <Input readOnly value={party?.balance == null ? "—" : rs(party.balance)} />
          </div>
        )}
        <div>
          <Label htmlFor="udhaar_category">{diya ? "Udhaar Category" : "Recovery Type"}</Label>
          <Select id="udhaar_category" value={category} onChange={(e) => onCategoryChange(e.target.value)}>
            {UDHAAR_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        {diya && (
          <div>
            <Label htmlFor="udhaar_wajah">Description / Reason</Label>
            <Input id="udhaar_wajah" name="wajah" placeholder="Udhaar ka maqsad / wajah" />
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        <div>
          <Label htmlFor="udhaar_rakam">{diya ? "Amount" : "Amount Received"}</Label>
          <Input
            id="udhaar_rakam"
            name="rakam"
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder={diya ? "Enter amount" : "Enter received amount"}
          />
        </div>
        {!diya && (
          <div>
            <Label>Remaining Balance</Label>
            <Input readOnly value={remaining == null ? "—" : rs(remaining)} />
          </div>
        )}
        <div>
          <Label htmlFor="udhaar_khata">{diya ? "Amount Paid From Account" : "Payment Received In"}</Label>
          {diya ? (
            // Malik (18 September): "Udhaar ki payment sirf cash se
            // dena hai — kisi bank account ya card/QR se staff ko
            // allow nahi, wo sirf cash se de sakta hai." Dropdown
            // dikhana hi ghalat tha: dikhata hai ke koi aur raasta
            // chuna ja sakta hai, jab ke nahi ja sakta.
            <>
              <Input id="udhaar_khata" readOnly value="Cash / Golak" />
              <input type="hidden" name="kahan_se" value="cash" />
            </>
          ) : (
            <Select id="udhaar_khata" name="kahan_aaya" value={account} onChange={(e) => onAccountChange(e.target.value)}>
              <option value="cash">Cash / Golak</option>
              {financeAccounts.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div>
          <Label htmlFor="udhaar_reference">Reference / Transaction ID</Label>
          <Input id="udhaar_reference" name="reference" value={reference} onChange={(e) => onReferenceChange(e.target.value)} placeholder="Enter reference or transaction ID" />
        </div>
        <div>
          <Label htmlFor="udhaar_tareekh">Kis din</Label>
          <Input id="udhaar_tareekh" name="tareekh" type="date" defaultValue={aajKaKhana()} />
        </div>
      </div>

      <input type="hidden" name="category" value={category} />

      <div className="xl:col-span-2 flex gap-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-xs text-surface-700">
        <Info className="h-5 w-5 shrink-0 text-brand-700" />
        <span>
          {diya
            ? "Category aur account sahi select karein — FMCG, Khaad, Wanda, Pesticide aur Milk ka hisaab alag rahega."
            : "Customer ko receipt issue karein aur payment ko sahi separate khate mein update karein."}
        </span>
      </div>
    </form>
  );
}
