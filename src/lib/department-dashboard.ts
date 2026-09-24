import { createServiceClient } from "@/lib/supabase/service";

import { aajKaKhana } from "@/lib/utils/format";
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

async function count(run: () => PromiseLike<{ count: number | null; error?: unknown }>): Promise<number | null> {
  try {
    const { count: c, error } = await run();
    if (error) return null;
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
  return aajKaKhana();
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
    const { data, error } = (await apply(client.from(table).select(column))) as {
      data: Array<Record<string, unknown>> | null;
      error?: unknown;
    };
    if (error) return null;
    return (data ?? []).reduce((total: number, row) => total + Number(row[column] ?? 0), 0);
  } catch {
    return null;
  }
}

export async function tilesFor(key: string, branchId: string | null): Promise<Tile[]> {
  const s = service();
  const t = today();

  switch (key) {
    case "branches": {
      const [branches, shops, warehouses, transfers] = await Promise.all([
        count(() => s.from("branches").select("id", { count: "exact", head: true }).eq("is_active", true)),
        count(() => s.from("shops").select("id", { count: "exact", head: true }).eq("is_active", true)),
        count(() => s.from("warehouses").select("id", { count: "exact", head: true })),
        count(() => s.from("stock_transfers").select("id", { count: "exact", head: true }).in("status", ["requested", "approved", "in_transit"])),
      ]);
      return [{ label: "Active branches", value: n(branches), href: "/admin/branches" }, { label: "Active shops", value: n(shops), href: "/admin/shops" }, { label: "Warehouses", value: n(warehouses), href: "/admin/inventory/warehouses" }, { label: "Transfers moving", value: n(transfers), href: "/admin/stock-transfers", tone: transfers ? "warn" : "normal" }];
    }

    case "shops": {
      const [shops, todaySales, openShifts, rent] = await Promise.all([
        count(() => s.from("shops").select("id", { count: "exact", head: true }).eq("is_active", true)),
        sum("pos_sales", "total_amount", (q: any) => q.gte("created_at", t)),
        count(() => s.from("pos_shifts").select("id", { count: "exact", head: true }).is("closed_at", null)),
        count(() => s.from("shop_rent_agreements").select("id", { count: "exact", head: true }).eq("is_active", true)),
      ]);
      return [{ label: "Active shops", value: n(shops), href: "/admin/shops" }, { label: "Aaj ki retail sale", value: rs(todaySales), href: "/admin/pos" }, { label: "Open shifts", value: n(openShifts), href: "/admin/reports/pos-shifts", tone: openShifts ? "warn" : "normal" }, { label: "Rent agreements", value: n(rent), href: "/admin/shop-rent" }];
    }

    case "ordering": {
      const [requests, approved, transit, receiving] = await Promise.all([
        count(() => s.from("agri_orders").select("id", { count: "exact", head: true }).eq("status", "pending")),
        count(() => s.from("agri_orders").select("id", { count: "exact", head: true }).eq("status", "approved")),
        count(() => s.from("agri_orders").select("id", { count: "exact", head: true }).eq("status", "dispatched")),
        count(() => s.from("agri_orders").select("id", { count: "exact", head: true }).eq("status", "delivered")),
      ]);
      return [{ label: "Requests pending", value: n(requests), href: "/admin/agri-orders", tone: requests ? "warn" : "normal" }, { label: "Ready to dispatch", value: n(approved), href: "/admin/agri-orders", tone: approved ? "warn" : "normal" }, { label: "In transit", value: n(transit), href: "/admin/agri-orders" }, { label: "Receiving", value: n(receiving), href: "/admin/agri-orders" }];
    }

    case "grain": {
      const [bought, sold, revenue, stock] = await Promise.all([
        sum("grain_procurement_entries", "weight_kg", (q: any) => q.gte("entry_date", monthStart())),
        sum("grain_sales", "quantity_kg", (q: any) => q.gte("sale_date", monthStart())),
        sum("grain_sales", "total_amount", (q: any) => q.gte("sale_date", monthStart())),
        sum("v_grain_warehouse_stock", "maujood_kg", (q: any) => q.gt("maujood_kg", 0)),
      ]);
      return [{ label: "Month purchased", value: bought == null ? "—" : `${Math.round(bought).toLocaleString()} kg`, href: "/admin/grain-procurement" }, { label: "Month sold", value: sold == null ? "—" : `${Math.round(sold).toLocaleString()} kg`, href: "/admin/grain-procurement/sell" }, { label: "Sales value", value: rs(revenue), href: "/admin/grain-procurement/dashboard" }, { label: "Available grain", value: stock == null ? "—" : `${Math.round(stock).toLocaleString()} kg`, href: "/admin/grain-procurement/warehouse" }];
    }

    case "product": {
      const [active, pending, edits, reorder] = await Promise.all([
        count(() => s.from("products").select("id", { count: "exact", head: true }).eq("is_active", true)),
        count(() => s.from("products").select("id", { count: "exact", head: true }).eq("status", "pending")),
        count(() => s.from("product_edit_requests").select("id", { count: "exact", head: true }).eq("status", "pending")),
        count(() => s.from("inventory").select("id", { count: "exact", head: true }).lte("quantity", 0)),
      ]);
      return [{ label: "Active products", value: n(active), href: "/admin/products" }, { label: "Products pending", value: n(pending), href: "/admin/products/pending", tone: pending ? "warn" : "normal" }, { label: "Edits pending", value: n(edits), href: "/admin/products/pending-edits", tone: edits ? "warn" : "normal" }, { label: "Reorder attention", value: n(reorder), href: "/admin/products/reorder", tone: reorder ? "alert" : "normal" }];
    }

    case "fuel": {
      const [milkFuel, machineFuel, vehicles] = await Promise.all([
        sum("fuel_logs", "fuel_cost", (q: any) => q.gte("log_date", monthStart())),
        sum("machinery_fuel_logs", "amount", (q: any) => q.gte("log_date", monthStart()).eq("verification_status", "verified")),
        count(() => s.from("vehicles").select("id", { count: "exact", head: true }).eq("is_active", true)),
      ]);
      return [{ label: "Milk route fuel", value: rs(milkFuel), href: "/admin/milk-collection/fuel" }, { label: "Machinery diesel", value: rs(machineFuel), href: "/admin/machinery-rental/diesel" }, { label: "Active vehicles", value: n(vehicles), href: "/admin/vehicles" }];
    }

    case "generator": {
      const [logs, fuel, runtime] = await Promise.all([
        count(() => s.from("generator_logs").select("id", { count: "exact", head: true }).gte("log_date", monthStart())),
        sum("generator_logs", "diesel_liters_purchased", (q: any) => q.gte("log_date", monthStart())),
        sum("generator_logs", "hours_run", (q: any) => q.gte("log_date", monthStart())),
      ]);
      return [{ label: "Month log entries", value: n(logs), href: "/admin/milk-collection/generator" }, { label: "Fuel consumed", value: fuel == null ? "—" : `${Math.round(fuel * 10) / 10} L`, href: "/admin/milk-collection/generator" }, { label: "Runtime", value: runtime == null ? "—" : `${Math.round(runtime * 10) / 10} h`, href: "/admin/milk-collection/generator" }];
    }

    case "fleet": {
      const [vehicles, drivers, openLogs, maintenance] = await Promise.all([
        count(() => s.from("vehicles").select("id", { count: "exact", head: true }).eq("is_active", true)),
        count(() => s.from("drivers").select("id", { count: "exact", head: true }).eq("is_active", true)),
        count(() => s.from("vehicle_daily_logs").select("id", { count: "exact", head: true }).is("closing_km", null)),
        count(() => s.from("maintenance_logs").select("id", { count: "exact", head: true }).gte("service_date", monthStart())),
      ]);
      return [{ label: "Active vehicles", value: n(vehicles), href: "/admin/vehicles" }, { label: "Active drivers", value: n(drivers), href: "/admin/drivers" }, { label: "Open trip logs", value: n(openLogs), href: "/admin/my-vehicle", tone: openLogs ? "warn" : "normal" }, { label: "Month maintenance", value: n(maintenance), href: "/admin/milk-collection/maintenance" }];
    }

    case "farmers": {
      const [farmers, loans, wallets, pending] = await Promise.all([
        count(() => s.from("farmers").select("id", { count: "exact", head: true })),
        count(() => s.from("farmer_loans").select("id", { count: "exact", head: true }).eq("status", "active")),
        count(() => s.from("wallets").select("id", { count: "exact", head: true }).eq("owner_type", "farmer")),
        count(() => s.from("credit_requests").select("id", { count: "exact", head: true }).eq("status", "pending")),
      ]);
      return [{ label: "Registered farmers", value: n(farmers), href: "/admin/farmers" }, { label: "Active loans", value: n(loans), href: "/admin/farmer-loans" }, { label: "Farmer wallets", value: n(wallets), href: "/admin/wallets" }, { label: "Credit requests", value: n(pending), href: "/admin/credit-requests", tone: pending ? "warn" : "normal" }];
    }

    case "dealers":
    case "buyers":
    case "suppliers": {
      const table = key;
      const [total, active] = await Promise.all([
        count(() => (s.from(table as "dealers").select("id", { count: "exact", head: true }) as any)),
        count(() => (s.from(table as "dealers").select("id", { count: "exact", head: true }).eq("is_active", true) as any)),
      ]);
      return [{ label: `Total ${key}`, value: n(total), href: `/admin/${key}` }, { label: "Active accounts", value: n(active), href: `/admin/${key}` }];
    }

    case "crm": {
      const [messages, newMessages, dealers, buyers] = await Promise.all([
        count(() => s.from("contact_messages").select("id", { count: "exact", head: true })),
        count(() => s.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new")),
        count(() => s.from("dealers").select("id", { count: "exact", head: true })),
        count(() => s.from("buyers").select("id", { count: "exact", head: true })),
      ]);
      return [{ label: "Total conversations", value: n(messages), href: "/admin/messages" }, { label: "New follow-ups", value: n(newMessages), href: "/admin/contact-messages", tone: newMessages ? "warn" : "normal" }, { label: "Dealer contacts", value: n(dealers), href: "/admin/dealers" }, { label: "Buyer contacts", value: n(buyers), href: "/admin/buyers" }];
    }

    case "audit": {
      const [approvals, anomalies, stockCount, openLogs] = await Promise.all([
        count(() => s.from("whatsapp_submissions").select("id", { count: "exact", head: true }).eq("status", "pending")),
        count(() => s.from("anomaly_findings").select("id", { count: "exact", head: true }).eq("status", "open")),
        count(() => s.from("stock_counts").select("id", { count: "exact", head: true }).eq("status", "draft")),
        count(() => s.from("vehicle_daily_logs").select("id", { count: "exact", head: true }).is("closing_km", null)),
      ]);
      return [{ label: "Pending approvals", value: n(approvals), href: "/admin/submissions", tone: approvals ? "alert" : "normal" }, { label: "Open anomalies", value: n(anomalies), href: "/admin/anomalies", tone: anomalies ? "alert" : "normal" }, { label: "Stock counts open", value: n(stockCount), href: "/admin/stock-count", tone: stockCount ? "warn" : "normal" }, { label: "Incomplete logs", value: n(openLogs), href: "/admin/field-watch", tone: openLogs ? "warn" : "normal" }];
    }

    case "website": {
      const [slides, posts, messages, media] = await Promise.all([
        count(() => s.from("hero_slides").select("id", { count: "exact", head: true }).eq("is_active", true)),
        count(() => s.from("blog_posts").select("id", { count: "exact", head: true }).eq("status", "published")),
        count(() => s.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new")),
        count(() => s.from("media_library").select("id", { count: "exact", head: true })),
      ]);
      return [{ label: "Active slides", value: n(slides), href: "/admin/hero-slides" }, { label: "Published posts", value: n(posts), href: "/admin/blog" }, { label: "New enquiries", value: n(messages), href: "/admin/contact-messages", tone: messages ? "warn" : "normal" }, { label: "Media assets", value: n(media), href: "/admin/media-library" }];
    }

    case "ai": {
      const [suggestions, actions, logs, instructions] = await Promise.all([
        count(() => s.from("ai_purchase_suggestions").select("id", { count: "exact", head: true }).eq("status", "pending")),
        count(() => s.from("bridge_ai_action_requests").select("id", { count: "exact", head: true }).eq("status", "pending")),
        count(() => s.from("bridge_ai_activity_log").select("id", { count: "exact", head: true }).gte("created_at", t)),
        // ai_report_instructions ek hi settings row rakhta hai -- "active"
        // ka koi khana nahi, is liye sirf itna dekha jata hai ke likhi hui
        // hai ya nahi.
        count(() => s.from("ai_report_instructions").select("id", { count: "exact", head: true })),
      ]);
      return [{ label: "Suggestions pending", value: n(suggestions), href: "/admin/ai-suggestions", tone: suggestions ? "warn" : "normal" }, { label: "Actions for review", value: n(actions), href: "/admin/bridge-ai/action-requests", tone: actions ? "alert" : "normal" }, { label: "AI activity today", value: n(logs), href: "/admin/bridge-ai/activity-log" }, { label: "Active instructions", value: n(instructions), href: "/admin/ai-instructions" }];
    }

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
