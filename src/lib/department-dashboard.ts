import { createServiceClient } from "@/lib/supabase/service";

/**
 * Har department ke dashboard ke aankre.
 *
 * Har khana alag query hai, aur har query apni ghalti khud sambhalti hai
 * -- ek khana na bane to us ki jagah "—" aa jata hai aur baqi dashboard
 * chalta rehta hai. Poora safha girana is se kahin bura hota: banda
 * subah kaam shuru nahi kar pata aur us ki wajah bhi nazar nahi aati.
 *
 * Aankre soch samajh kar chune gaye hain: har khana wo cheez hai jis par
 * us department ko AAJ kuch karna hai. "Kul kitne product hain" jaisi
 * baat dashboard par jagah nahi leti -- wo report ka kaam hai.
 */

export interface Tile {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: "normal" | "warn" | "alert";
}

const service = () => createServiceClient();

async function count(run: () => PromiseLike<{ count: number | null }>): Promise<number | null> {
  try {
    const { count: c } = await run();
    return c ?? 0;
  } catch {
    return null;
  }
}

function n(value: number | null): string {
  return value == null ? "—" : value.toLocaleString();
}

function rs(value: number | null): string {
  return value == null ? "—" : `Rs ${Math.round(value).toLocaleString()}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Kisi khane ka jorh. Yahan `any` jaan boojh kar hai: table ka naam
 * chalte waqt tay hota hai, is liye Supabase ke types yahan madad nahi
 * kar sakte. Har call ka natija upar ke function mein sanbhala jata hai.
 */
async function sum(table: string, column: string, apply: (q: any) => any): Promise<number | null> {
  try {
    const client = service() as unknown as {
      from: (t: string) => { select: (c: string) => unknown };
    };
    const { data } = (await apply(client.from(table).select(column))) as {
      data: Array<Record<string, unknown>> | null;
    };
    return (data ?? []).reduce((total: number, row) => total + Number(row[column] ?? 0), 0);
  } catch {
    return null;
  }
}

export async function tilesFor(key: string, branchId: string | null): Promise<Tile[]> {
  const s = service();
  const t = today();

  switch (key) {
    case "sales": {
      const [sales, amount, pendingOrders, returns] = await Promise.all([
        count(() => s.from("pos_sales").select("id", { count: "exact", head: true }).gte("created_at", t)),
        sum("pos_sales", "total_amount", (q: any) => q.gte("created_at", t)),
        count(() => s.from("agri_orders").select("id", { count: "exact", head: true }).in("status", ["draft", "pending", "sales_verified", "finance_verified"])),
        count(() => s.from("agri_order_returns").select("id", { count: "exact", head: true }).eq("status", "pending")),
      ]);
      return [
        { label: "Aaj ki bikri", value: n(sales), hint: rs(amount), href: "/admin/pos" },
        { label: "Order chal rahe", value: n(pendingOrders), href: "/admin/agri-orders", tone: "warn" },
        { label: "Return pending", value: n(returns), href: "/admin/agri-returns", tone: returns ? "warn" : "normal" },
      ];
    }

    case "finance": {
      const [submissions, expenses, monthExpense, cash] = await Promise.all([
        count(() => s.from("whatsapp_submissions").select("id", { count: "exact", head: true }).eq("status", "pending")),
        count(() => s.from("company_expense_requests").select("id", { count: "exact", head: true }).eq("status", "pending")),
        sum("company_expense_requests", "amount", (q: any) => q.gte("created_at", monthStart()).eq("status", "approved")),
        sum("finance_accounts", "current_balance", (q: any) => q.eq("is_active", true)),
      ]);
      return [
        { label: "Approval ke intezar mein", value: n(submissions), href: "/admin/submissions", tone: submissions ? "alert" : "normal" },
        { label: "Kharche pending", value: n(expenses), href: "/admin/company-expenses", tone: expenses ? "warn" : "normal" },
        { label: "Is mahine ke kharche", value: rs(monthExpense), href: "/admin/company-expenses" },
        { label: "Khaton mein maujood", value: rs(cash), href: "/admin/finance" },
      ];
    }

    case "warehouse": {
      const [toDispatch, returns, pendingProducts] = await Promise.all([
        count(() => s.from("agri_orders").select("id", { count: "exact", head: true }).eq("status", "approved")),
        count(() => s.from("agri_order_returns").select("id", { count: "exact", head: true }).eq("status", "pending")),
        count(() => s.from("products").select("id", { count: "exact", head: true }).eq("status", "pending")),
      ]);
      return [
        { label: "Dispatch ke intezar mein", value: n(toDispatch), href: "/admin/agri-orders", tone: toDispatch ? "alert" : "normal" },
        { label: "Return aane wale", value: n(returns), href: "/admin/agri-returns", tone: returns ? "warn" : "normal" },
        { label: "Naye product pending", value: n(pendingProducts), href: "/admin/products/pending" },
      ];
    }

    case "procurement": {
      const [openPurchases, monthAmount] = await Promise.all([
        count(() => s.from("purchases").select("id", { count: "exact", head: true }).neq("status", "completed")),
        sum("purchases", "total_amount", (q: any) => q.gte("purchase_date", monthStart())),
      ]);
      return [
        { label: "Khareed chal rahi", value: n(openPurchases), href: "/admin/purchases", tone: "warn" },
        { label: "Is mahine ki khareed", value: rs(monthAmount), href: "/admin/purchases" },
      ];
    }

    case "dairy": {
      const [entries, liters, pendingFat, walkIn] = await Promise.all([
        count(() => s.from("milk_entries").select("id", { count: "exact", head: true }).eq("entry_date", t)),
        sum("milk_entries", "quantity_liters", (q: any) => q.eq("entry_date", t).neq("status", "rejected")),
        count(() => s.from("milk_entries").select("id", { count: "exact", head: true }).eq("status", "pending_fat")),
        count(() => s.from("milk_entries").select("id", { count: "exact", head: true }).eq("entry_date", t).eq("collection_source", "self_delivery")),
      ]);
      return [
        { label: "Aaj ka doodh", value: liters == null ? "—" : `${Math.round(liters * 10) / 10} L`, hint: `${n(entries)} entries` },
        { label: "FAT ka intezar", value: n(pendingFat), href: "/admin/milk-collection/chiller", tone: pendingFat ? "alert" : "normal" },
        { label: "Kisan khud laya", value: n(walkIn), href: "/admin/milk-collection/walk-in" },
      ];
    }

    case "machinery": {
      const [todayBookings, running, monthAmount] = await Promise.all([
        count(() => s.from("machinery_bookings").select("id", { count: "exact", head: true }).eq("booking_date", t)),
        count(() => s.from("machinery_bookings").select("id", { count: "exact", head: true }).is("completed_at", null)),
        sum("machinery_bookings", "total_amount", (q: any) => q.gte("booking_date", monthStart())),
      ]);
      return [
        { label: "Aaj ki booking", value: n(todayBookings), href: "/admin/machinery-rental/list" },
        { label: "Chal rahi hain", value: n(running), href: "/admin/machinery-rental", tone: running ? "warn" : "normal" },
        { label: "Is mahine ka kaam", value: rs(monthAmount), href: "/admin/machinery-rental/dashboard" },
      ];
    }

    case "hr": {
      const [staff, present, applications, noPhone] = await Promise.all([
        count(() => s.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true).neq("role", "farmer")),
        count(() => s.from("attendance_records").select("id", { count: "exact", head: true }).eq("attendance_date", t)),
        count(() => s.from("job_applications").select("id", { count: "exact", head: true }).eq("status", "applied")),
        count(() => s.from("staff_details").select("profile_id", { count: "exact", head: true }).is("whatsapp_verified_at", null)),
      ]);
      return [
        { label: "Fa'aal staff", value: n(staff), href: "/admin/hr" },
        { label: "Aaj hazir", value: n(present), href: "/admin/hr/attendance-log" },
        { label: "Nayi darkhwastein", value: n(applications), href: "/admin/job-applications", tone: applications ? "warn" : "normal" },
        { label: "WhatsApp tasdeeq baqi", value: n(noPhone), href: "/admin/hr/whatsapp", tone: noPhone ? "warn" : "normal" },
      ];
    }

    case "admin_office": {
      const [messages, inquiries] = await Promise.all([
        count(() => s.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new")),
        count(() => s.from("investor_inquiries").select("id", { count: "exact", head: true })),
      ]);
      return [
        { label: "Naye paighaam", value: n(messages), href: "/admin/contact-messages", tone: messages ? "warn" : "normal" },
        { label: "Investor ke sawal", value: n(inquiries), href: "/admin/investor-inquiries" },
      ];
    }

    case "manager": {
      const scope = (q: any) => (branchId ? q.eq("branch_id", branchId) : q);
      const [submissions, milkVerify, orders, returns] = await Promise.all([
        count(() => scope(s.from("whatsapp_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"))),
        count(() => s.from("milk_entries").select("id", { count: "exact", head: true }).eq("status", "priced")),
        count(() => s.from("agri_orders").select("id", { count: "exact", head: true }).in("status", ["pending", "sales_verified", "finance_verified"])),
        count(() => scope(s.from("agri_order_returns").select("id", { count: "exact", head: true }).eq("status", "pending"))),
      ]);
      return [
        { label: "Aap ke faisle ke muntazir", value: n(submissions), href: "/admin/submissions", tone: submissions ? "alert" : "normal" },
        { label: "Doodh verify baqi", value: n(milkVerify), href: "/admin/milk-collection/verify", tone: milkVerify ? "warn" : "normal" },
        { label: "Order chal rahe", value: n(orders), href: "/admin/agri-orders" },
        { label: "Return pending", value: n(returns), href: "/admin/agri-returns", tone: returns ? "warn" : "normal" },
      ];
    }

    default:
      return [];
  }
}
