"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/ui/layout-primitives";
import { Search, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Feature {
  section: string;
  label: string;
  href: string;
  description: string;
  who: string;
  addedDate?: string; // YYYY-MM-DD — 7 din tak "Naya" badge dikhe ga
}

function isNew(dateStr?: string): boolean {
  if (!dateStr) return false;
  const added = new Date(dateStr).getTime();
  const now = Date.now();
  return now - added < 7 * 24 * 60 * 60 * 1000;
}

const ALL_FEATURES: Feature[] = [
  // ── MASTER COMMAND ──────────────────────────────────────────────────────────
  { section: "Master Command", label: "Owner Command Center", href: "/admin/command-center", description: "Aaj ka saara paisa, departmental performance, attention queue, aur zaroori actions — ek jagah par.", who: "Malik / Admin" },

  // ── BUSINESS ────────────────────────────────────────────────────────────────
  { section: "Business", label: "Kisan", href: "/admin/farmers", description: "Tamam kisanon ki fehrist, unka profile, khata, aur kharid-farookht ka record.", who: "Admin / Staff" },
  { section: "Business", label: "Dealer", href: "/admin/dealers", description: "Dealers ki fehrist, unka khata, aur unke saath lain-dain.", who: "Admin / Staff" },
  { section: "Business", label: "Kharidar", href: "/admin/buyers", description: "Maal khareedne wale gahak — bulk buyers — unka profile aur statement.", who: "Admin / Staff" },
  { section: "Business", label: "Supplier", href: "/admin/suppliers", description: "Maal dene wale suppliers ki fehrist, payable balance, aur payment history.", who: "Admin / Staff" },
  { section: "Business", label: "Sab Suppliers Statement", href: "/admin/suppliers/all-statement", description: "Har supplier ka yaksaan statement — kitna dena baqi hai, kitna dia gaya.", who: "Admin / Malik" },
  { section: "Business", label: "Sarmayakar", href: "/admin/investors", description: "Sarmayakaron (investors) ki fehrist, unka lagaya hua paisa, aur returns.", who: "Malik" },
  { section: "Business", label: "Shaakhein", href: "/admin/branches", description: "Karobar ki tamam shaakhein (branches) — naam, jagah, aur in-charge.", who: "Admin" },
  { section: "Business", label: "Shaakh ki Jagah", href: "/admin/branches/locations", description: "Har shaakh ki GPS location aur address ka record.", who: "Admin" },
  { section: "Business", label: "Dukanein", href: "/admin/shops", description: "Tamam dukanen — naam, code, business type, aur status.", who: "Admin" },
  { section: "Business", label: "Dukan ka Kiraya aur Bill", href: "/admin/shop-rent", description: "Har dukan ka mahi-wari kiraya, bijli bill, aur payment history.", who: "Admin / Finance" },
  { section: "Business", label: "Driver aur Gaariyan", href: "/admin/drivers", description: "Drivers ki fehrist, unke lisence, gaari assignment, aur transport record.", who: "Admin" },
  { section: "Business", label: "Gaariyan (Rozana)", href: "/admin/vehicles", description: "Gaariyon ka rozana ka hisaab — tel, marammat, safar.", who: "Admin / Staff" },
  { section: "Business", label: "Gahak ka Khata (CRM)", href: "/admin/crm", description: "Gahakoon ka poora rishta — kharid history, udhaar, aur follow-up.", who: "Admin / Sales Staff" },

  // ── SALES ───────────────────────────────────────────────────────────────────
  { section: "Sales", label: "POS (Point of Sale)", href: "/admin/pos", description: "Dukan par sale karo — barcode scan, stock ghate, aur bill bane.", who: "Cashier / Sales Staff" },
  { section: "Sales", label: "AgriBridge Ordering", href: "/admin/agri-orders", description: "AgriBridge app se aane wale online orders ka management.", who: "Admin / Staff" },
  { section: "Sales", label: "Order", href: "/admin/bridge-orders", description: "Tamam bridge orders — pending, processing, aur complete.", who: "Admin / Staff" },
  { section: "Sales", label: "Fasal ke Order", href: "/admin/produce-orders", description: "Kisanon ki fasal (produce) ke orders — buying aur logistics.", who: "Admin / Procurement" },
  { section: "Sales", label: "Dealer ke Order", href: "/admin/dealer-orders", description: "Dealers se aane wale bulk orders ka track aur processing.", who: "Admin / Sales" },

  // ── PURCHASES ───────────────────────────────────────────────────────────────
  { section: "Purchases", label: "Supplier Purchase Bill", href: "/admin/purchases/supplier-bill", description: "Naya bill banao — supplier se maal aaya, qeemat aur miqdar darj karo. Bill save hone par GRN queue mein jata hai.", who: "Purchase Staff / Admin", addedDate: "2026-09-25" },
  { section: "Purchases", label: "Kharid (Purchases)", href: "/admin/purchases", description: "Tamam purchase orders ki fehrist — draft, received, aur approved.", who: "Admin / Purchase Staff" },
  { section: "Purchases", label: "Anaj ka Dashboard", href: "/admin/grain-procurement/dashboard", description: "Anaj kharid ka overview — total aaya, becha, baqi, aur nafa.", who: "Malik / Admin" },
  { section: "Purchases", label: "Anaj ki Kharid", href: "/admin/grain-procurement", description: "Kisanon se anaj (grain) khareedna — rates, miqdar, aur payment.", who: "Procurement Staff" },
  { section: "Purchases", label: "Grain Bechein (Sell)", href: "/admin/grain-procurement/sell", description: "Khareda hua anaj bechna — buyer, rate, aur delivery.", who: "Admin / Procurement" },
  { section: "Purchases", label: "Kisan ki Adaigi", href: "/admin/grain-procurement/payments", description: "Kisanon ko anaj ki adaigi — pending payments aur history.", who: "Finance / Admin" },
  { section: "Purchases", label: "Anaj ka Godam", href: "/admin/grain-procurement/warehouse", description: "Anaj ka godam — kaunsa anaj kitna hai, kahan hai.", who: "Warehouse Staff" },
  { section: "Purchases", label: "Machinery se Grain Leads", href: "/admin/grain/leads", description: "Machinery bookings se milne wale grain leads — harvest karne wale kisan.", who: "Procurement Staff" },
  { section: "Purchases", label: "AI ki Kharid Tajweez", href: "/admin/ai-suggestions", description: "AI ka mashwara — sales history dekh kar bata hai kya kharidna chahiye.", who: "Malik / Purchase Head" },

  // ── INVENTORY ───────────────────────────────────────────────────────────────
  { section: "Inventory", label: "Cheezein (Products)", href: "/admin/products", description: "Tamam products ki fehrist — naam, category, rates, barcode, aur image.", who: "Admin / Product Manager" },
  { section: "Inventory", label: "Product Setup", href: "/admin/products/setup", description: "Incomplete products — jo baracode missing hain, rate nahi laga, image nahi — ek jagah fix karo.", who: "Admin / Product Manager" },
  { section: "Inventory", label: "Product ki Bunyadi Fehrist", href: "/admin/products/masters", description: "Products ke masters — company, category, aur unit types manage karo.", who: "Admin" },
  { section: "Inventory", label: "Product Cycles (Shops)", href: "/admin/product-cycles", description: "Do kaam: (1) Shop product rotation — dukanen mein kaunsa maal bhejein. (2) Daily Stock Count Cycle — roz ek batch products ki ginti.", who: "Admin / Warehouse", addedDate: "2026-09-25" },
  { section: "Inventory", label: "Stock (Inventory)", href: "/admin/inventory", description: "Har product ka current stock — kaunsa godam mein kitna hai.", who: "Admin / Warehouse" },
  { section: "Inventory", label: "Stock Statement", href: "/admin/stock-statement", description: "Stock ki mufassal report — opening, aaya, gaya, closing.", who: "Malik / Admin" },
  { section: "Inventory", label: "Stock ka Khata (Ledger)", href: "/admin/stock-ledger", description: "Har product ki movement history — kab aaya, kab gaya, kahan gaya.", who: "Admin / Accounts" },
  { section: "Inventory", label: "Maal Bhejein (Transfer)", href: "/admin/stock-transfers", description: "Ek jagah se doosri jagah maal transfer karo — godam se dukan ya branch.", who: "Warehouse / Admin" },
  { section: "Inventory", label: "Wapsi ka Maal", href: "/admin/agri-returns", description: "Gahak ne maal wapas kiya — stock mein wapas daro aur hisaab theek karo.", who: "Sales Staff / Admin" },
  { section: "Inventory", label: "Maal ki Ginti (Stock Count)", href: "/admin/stock-count", description: "Physical stock count — system ka adad aur asali ginti milao, farq nikalo.", who: "Warehouse / Admin" },
  { section: "Inventory", label: "Godam (Warehouses)", href: "/admin/inventory/warehouses", description: "Tamam godam — naam, jagah, aur is mein rakha hua maal.", who: "Admin" },
  { section: "Inventory", label: "Maal Aana (Receiving / GRN)", href: "/admin/inventory/receiving", description: "Aane wale maal ki ginti karo (GRN) — system mein stock barhao.", who: "Receiving / Warehouse Staff" },

  // ── AGRICULTURE ─────────────────────────────────────────────────────────────
  { section: "Agriculture", label: "Khaad (Fertilizer)", href: "/admin/fertilizer", description: "Fertilizer products, stock, aur kisanon ko bechne ka hisaab.", who: "Agri Staff / Admin" },
  { section: "Agriculture", label: "Spray / Zehar (Pesticide)", href: "/admin/pesticide", description: "Pesticide aur spray products, stock, aur sales.", who: "Agri Staff / Admin" },
  { section: "Agriculture", label: "Beej (Seeds)", href: "/admin/seeds", description: "Beej (seeds) ka stock, brands, aur kisanon ko bechna.", who: "Agri Staff / Admin" },
  { section: "Agriculture", label: "Wanda", href: "/admin/wanda", description: "Jaanwaron ka chara (wanda) — stock aur sales ka hisaab.", who: "Agri Staff / Admin" },
  { section: "Agriculture", label: "Machinery Dashboard", href: "/admin/machinery-rental/dashboard", description: "Machinery rental ka overview — total bookings, income, aur vendor payable.", who: "Malik / Admin" },
  { section: "Agriculture", label: "Machine ki Booking", href: "/admin/machinery-rental", description: "Naya machinery booking banao — kisan, machine, acres, rate.", who: "Booking Staff / Admin" },
  { section: "Agriculture", label: "Tamam Bookings", href: "/admin/machinery-rental/list", description: "Saari machinery bookings ki fehrist — pending, complete, aur cancelled.", who: "Admin / Staff" },
  { section: "Agriculture", label: "Machinery Reports", href: "/admin/machinery-rental/reports", description: "Machinery income, vendor payments, aur performance reports.", who: "Malik / Admin" },
  { section: "Agriculture", label: "Grocery", href: "/admin/grocery", description: "Grocery products ka stock aur sales.", who: "Staff / Admin" },

  // ── DAIRY ───────────────────────────────────────────────────────────────────
  { section: "Dairy", label: "Doodh Jama Karein", href: "/admin/milk-collection/collect", description: "Roz subah doodh jama karo — kisan, litre, FAT, SNF darj karo.", who: "Milk Collection Staff" },
  { section: "Dairy", label: "Khud Laaya Hua Doodh", href: "/admin/milk-collection/walk-in", description: "Jo kisan khud doodh le kar aaya — walk-in entry.", who: "Milk Collection Staff" },
  { section: "Dairy", label: "Chiller — FAT", href: "/admin/milk-collection/chiller", description: "Chiller mein rakha doodh aur uski FAT reading.", who: "Dairy Staff" },
  { section: "Dairy", label: "Doodh ki Tasdeeq", href: "/admin/milk-collection/verify", description: "Collected doodh ki tasdeeq karein — quality aur quantity confirm.", who: "Dairy Supervisor" },
  { section: "Dairy", label: "Doodh Collection", href: "/admin/milk-collection", description: "Tamam doodh collection ka record — routes, kisaan, date.", who: "Dairy Admin" },
  { section: "Dairy", label: "Route aur Kami", href: "/admin/milk-collection/routes", description: "Doodh collection routes — kaunse route par kitni kami aayi.", who: "Dairy Supervisor" },
  { section: "Dairy", label: "Tel ka Hisaab (Fuel)", href: "/admin/milk-collection/fuel", description: "Gaari ka tel — roz ka kharcha aur route wise consumption.", who: "Dairy Staff / Finance" },
  { section: "Dairy", label: "Generator ka Hisaab", href: "/admin/milk-collection/generator", description: "Generator ka diesel aur operation cost.", who: "Dairy Staff / Finance" },
  { section: "Dairy", label: "Gaari aur Marammat", href: "/admin/milk-collection/maintenance", description: "Gaari ki maintenance — kab kya theek hua, kitna kharcha aaya.", who: "Dairy Staff / Finance" },
  { section: "Dairy", label: "Fi Litre Kharcha", href: "/admin/milk-collection/cost-per-liter", description: "Har litre doodh jama karne ki total cost — tel, mazdoori, sab milake.", who: "Malik / Dairy Head" },
  { section: "Dairy", label: "Company Billing aur Nafa", href: "/admin/milk-collection/billing", description: "Dairy company ko doodh ka bill aur nafa nuqsan.", who: "Malik / Finance" },

  // ── FINANCE ─────────────────────────────────────────────────────────────────
  { section: "Finance", label: "Paisa Kahan Hai (Money Trail)", href: "/admin/money-trail", description: "Paisa kahan se aaya, kahan gaya — complete trail.", who: "Malik / Finance" },
  { section: "Finance", label: "Shaam ka Hisaab", href: "/admin/shaam-ka-hisaab", description: "Din khatam hone par saara paisa gineo — cash, bank, aur farq.", who: "Finance Staff / Admin" },
  { section: "Finance", label: "Raat ki Cash Ginti", href: "/admin/cash-close", description: "Raat ko dukan band karne se pehle cash ginti — system se compare.", who: "Cashier / Branch Head" },
  { section: "Finance", label: "Cash Haath Badalna", href: "/admin/cash-handover", description: "Ek se doosre staff ko cash dena — handover record.", who: "Finance / Cashier" },
  { section: "Finance", label: "Bank se Milaan", href: "/admin/bank-reconcile", description: "System ka bank balance aur asli bank statement milao.", who: "Finance / Accounts" },
  { section: "Finance", label: "Miqdar aur Paisa", href: "/admin/quantity-money", description: "Quantity aur value dono ek jagah — stock value vs cash position.", who: "Malik / Finance" },
  { section: "Finance", label: "Roz ka Milaan (Reconciliation)", href: "/admin/reconciliation", description: "Roz ka hisaab milao — sales, expenses, aur cash.", who: "Finance / Admin" },
  { section: "Finance", label: "Paisa Kahan Se Nikal Raha Hai (Leakage)", href: "/admin/leakage", description: "Nuqsan dhundho — kahan paisa zyada ja raha hai, kahan ghatar hai.", who: "Malik / Audit" },
  { section: "Finance", label: "Kis Ne Kya Kiya (Audit Trail)", href: "/admin/audit-trail", description: "Har bade transaction ka trail — kisne darj kiya, kisne badla.", who: "Malik / Audit" },
  { section: "Finance", label: "Ghair-maamooli Tarteeb (Anomalies)", href: "/admin/anomalies", description: "Unusual transactions ya patterns — system ne kuch ghalat mahsoos kiya.", who: "Malik / Audit" },
  { section: "Finance", label: "Nafa Nuqsan Shop-wise (P&L)", href: "/admin/reports/pnl", description: "Har shop ka nafa nuqsan — income, cost, aur margin.", who: "Malik" },
  { section: "Finance", label: "Finance ki Qatar", href: "/admin/finance/queue", description: "Finance se awaiting actions — pending approvals, pending payments.", who: "Finance Head" },
  { section: "Finance", label: "Adaigi ka Tareeqa", href: "/admin/finance/payment-mapping", description: "Payment methods ka mapping — cash, bank, wallet kahan use hota hai.", who: "Finance / Admin" },
  { section: "Finance", label: "Paisa & Khata (Kharche)", href: "/admin/kharche", description: "Company expenses — kharche darj karo, approve karo, hisaab rakho.", who: "Finance / Admin" },
  { section: "Finance", label: "Load & Bill", href: "/admin/load-bill", description: "Load (recharge) aur bill payments ka hisaab.", who: "Finance / Staff" },
  { section: "Finance", label: "Khaton ka Adjustment (Settlements)", href: "/admin/settlements", description: "Khaton ka aapas mein adjustment — udhaar settle karo.", who: "Finance / Admin" },
  { section: "Finance", label: "Cash Book", href: "/admin/finance", description: "GL accounts, journal entries, aur cashbook — poora finance ledger.", who: "Finance / Accounts" },
  { section: "Finance", label: "Bank", href: "/admin/finance/banks", description: "Bank accounts ka record — balance, transactions.", who: "Finance / Admin" },
  { section: "Finance", label: "Khata (Party Ledger)", href: "/admin/khata", description: "Parties (suppliers, dealers) ka khata — kitna dena, kitna lena.", who: "Finance / Admin" },
  { section: "Finance", label: "Staff Khata", href: "/admin/staff-khata", description: "Staff ki salary ka khata — baqi, advance, aur katauti.", who: "HR / Finance" },
  { section: "Finance", label: "Shop ka Udhaar aur Advance", href: "/admin/branch-credit", description: "Dukan ko diya hua advance aur unse milna wala udhaar.", who: "Finance / Admin" },
  { section: "Finance", label: "Udhaar ki Darkhwastein", href: "/admin/credit-requests", description: "Udhaar ki requests — kaun ne maanga, kitna, approve ya reject.", who: "Finance Head / Malik" },
  { section: "Finance", label: "Kisan ka Udhaar", href: "/admin/farmer-credit", description: "Kisanon ka udhaar — khareed par udhaar, aur wapasi.", who: "Finance / Agri Staff" },
  { section: "Finance", label: "Kisan ke Qarze (Loans)", href: "/admin/farmer-loans", description: "Kisanon ko diye gaye qarze (loans) — amount, date, wapasi.", who: "Finance / Admin" },
  { section: "Finance", label: "Batwe (Wallets)", href: "/admin/wallets", description: "Digital wallets — JazzCash, Easypaisa — company ke transactions.", who: "Finance / Admin" },
  { section: "Finance", label: "Mera Batwa", href: "/admin/my-wallet", description: "Apna batwa — aapka personal digital wallet balance.", who: "Staff" },
  { section: "Finance", label: "Adaigiyan (Payouts)", href: "/admin/payouts", description: "Tamam adaigiyan — kise kitna dia gaya, baqi kya hai.", who: "Finance / Admin" },

  // ── RATES ───────────────────────────────────────────────────────────────────
  { section: "Rates", label: "Rate Master", href: "/admin/rate-master", description: "Products ki sale aur trade rates bulk mein set karo — category wise ya product wise.", who: "Admin / Malik" },

  // ── REPORTS ─────────────────────────────────────────────────────────────────
  { section: "Reports", label: "Reports (Main)", href: "/admin/reports", description: "Sab reports ka hub — yahan se koi bhi report kholo.", who: "Malik / Admin" },
  { section: "Reports", label: "Doodh Report", href: "/admin/reports/milk", description: "Doodh collection ki mufassal report — date wise, route wise.", who: "Malik / Dairy Head" },
  { section: "Reports", label: "Sale Report", href: "/admin/reports/sales", description: "Sales ki report — product wise, shop wise, date range.", who: "Malik / Sales Head" },
  { section: "Reports", label: "Kharid Report", href: "/admin/reports/purchases", description: "Purchases ki report — supplier wise, product wise, month wise.", who: "Malik / Purchase Head" },
  { section: "Reports", label: "Stock Reports", href: "/admin/reports/inventory", description: "Current stock snapshot — har product kitna hai, kahan hai.", who: "Malik / Warehouse" },
  { section: "Reports", label: "Stock Value Report", href: "/admin/reports/stock-value", description: "Stock ki qeemat — har category (Wanda, Pesticide, Seed, Grocery) ki cost value aur sale value. Kab kitna aaya, kia value this, baqi kia hy.", who: "Malik / Finance", addedDate: "2026-09-25" },
  { section: "Reports", label: "Finance Report", href: "/admin/reports/finance", description: "Finance ka summary — income, expenses, bank balance.", who: "Malik / Finance" },
  { section: "Reports", label: "Udhaar Report", href: "/admin/reports/credit", description: "Tamam udhaar — kaun kaun kitna baqi hai.", who: "Malik / Finance" },
  { section: "Reports", label: "Anaj Kharid Report", href: "/admin/reports/procurement", description: "Anaj kharid ki report — kisan wise, date wise, quantity aur value.", who: "Malik / Procurement Head" },
  { section: "Reports", label: "Audit Center (Nuqsan)", href: "/admin/reports/audit", description: "Nuqsan aur ghaltiyon ki report — kahan kya ghata.", who: "Malik / Audit" },

  // ── WEBSITE CMS ─────────────────────────────────────────────────────────────
  { section: "Website CMS", label: "Website Dashboard", href: "/admin/dashboard", description: "Website ka overview — traffic, pages, aur updates.", who: "Admin" },
  { section: "Website CMS", label: "Hero Slider", href: "/admin/hero-slides", description: "Website ka main banner — tasveerein aur text.", who: "Admin" },
  { section: "Website CMS", label: "Blog", href: "/admin/blog", description: "Blog articles likhein aur publish karein.", who: "Admin / Content" },
  { section: "Website CMS", label: "Gahakon ki Raye (Testimonials)", href: "/admin/testimonials", description: "Gahakoon ki taarif aur feedback website par.", who: "Admin" },
  { section: "Website CMS", label: "Tasveerein (Gallery)", href: "/admin/gallery", description: "Photo gallery — dukan, products, events.", who: "Admin" },
  { section: "Website CMS", label: "Media Library", href: "/admin/media-library", description: "Tamam upload ki gayi files — tasveerein, documents.", who: "Admin" },
  { section: "Website CMS", label: "Aam Sawalat (FAQs)", href: "/admin/faqs", description: "Website par aksar pooche jane wale sawal aur jawab.", who: "Admin" },
  { section: "Website CMS", label: "Static Pages", href: "/admin/static-pages", description: "About us, contact, services jaise fixed pages.", who: "Admin" },
  { section: "Website CMS", label: "Menu", href: "/admin/menus", description: "Website ka navigation menu — links aur tarteeb.", who: "Admin" },
  { section: "Website CMS", label: "Website ke Paighaam", href: "/admin/contact-messages", description: "Website ke contact form se aane wale paighaam.", who: "Admin / Sales" },
  { section: "Website CMS", label: "Sarmayakar ke Sawal", href: "/admin/investor-inquiries", description: "Website par investors ki inquiries.", who: "Admin / Malik" },

  // ── ADMINISTRATION ──────────────────────────────────────────────────────────
  { section: "Administration", label: "Paighaam (Messages)", href: "/admin/messages", description: "Internal messages — staff aur admin ke darmiyan.", who: "Staff / Admin" },
  { section: "Administration", label: "Abram (AI Assistant)", href: "/admin/bridge-ai", description: "AI assistant Abram — sawaal poochho, kaam karwao.", who: "Admin / Malik" },
  { section: "Administration", label: "Abram Activity Log", href: "/admin/bridge-ai/activity-log", description: "Abram ne kya kiya — har action ka log.", who: "Admin / Malik" },
  { section: "Administration", label: "Abram Action Requests", href: "/admin/bridge-ai/action-requests", description: "Abram ne jo actions karne ko kaha — pending approval.", who: "Malik / Admin" },
  { section: "Administration", label: "AI ki Hidayaat", href: "/admin/ai-instructions", description: "AI ko dene wali hiddayaat aur rules — system behavior customize karo.", who: "Malik / Admin" },
  { section: "Administration", label: "AI ka Khata", href: "/admin/ai-usage", description: "AI usage aur cost — kitne tokens kharch hue.", who: "Malik" },
  { section: "Administration", label: "Platform / Clients", href: "/admin/platform", description: "Platform clients aur integrations ka management.", who: "Admin" },
  { section: "Administration", label: "Naukri ki Jagahein", href: "/admin/job-vacancies", description: "Naukri ki khali jagahein post karo — recruitment.", who: "HR / Admin" },
  { section: "Administration", label: "Naukri ki Darkhwastein", href: "/admin/job-applications", description: "Job applications — kaun ne apply kiya, interview status.", who: "HR / Admin" },
  { section: "Administration", label: "HR Dashboard", href: "/admin/hr-dashboard", description: "HR ka overview — staff count, attendance, pending salaries.", who: "HR Head / Admin" },
  { section: "Administration", label: "Staff (HR)", href: "/admin/hr", description: "Tamam staff ka record — joining, salary, role.", who: "HR / Admin" },
  { section: "Administration", label: "Staff Salary Khata", href: "/admin/staff-khata", description: "Staff ki salary — kitni di gayi, kitni baqi hai.", who: "HR / Finance" },
  { section: "Administration", label: "Staff WhatsApp", href: "/admin/hr/whatsapp", description: "Staff ko WhatsApp messages bhejo — bulk ya individual.", who: "HR / Admin" },
  { section: "Administration", label: "Hazri Record", href: "/admin/hr/attendance-log", description: "Staff ki hazri ka poora log — kab aaya, kab gaya.", who: "HR / Admin" },
  { section: "Administration", label: "Hazri Board", href: "/admin/hr/attendance/board", description: "Aaj ki hazri board — kaun present hai, kaun absent.", who: "HR / Admin" },
  { section: "Administration", label: "Manzoori Inbox (Submissions)", href: "/admin/submissions", description: "Staff ki bhejji gayi requests — approve ya reject karo.", who: "Admin / Malik" },
  { section: "Administration", label: "Maidan ki Nigrani (Field Watch)", href: "/admin/field-watch", description: "Field staff ki activity — GPS, check-in, check-out.", who: "Admin / Supervisor" },
  { section: "Administration", label: "Dashboard aur Feature Manager", href: "/admin/dashboard-manager", description: "Kaunsa feature kisay dikhega — role-wise feature on/off.", who: "Admin" },
  { section: "Administration", label: "Meri Team (Head)", href: "/admin/my-department", description: "Apni team dekhein aur manage karein — department head ka view.", who: "Department Head" },
  { section: "Administration", label: "Staff & Access Control", href: "/admin/staff-access", description: "Staff ki permissions — kaun kya dekh sakta hai, kya nahi.", who: "Admin" },
  { section: "Administration", label: "Users aur Role", href: "/admin/users", description: "Tamam users — role assign karo, account enable/disable.", who: "Admin" },
  { section: "Administration", label: "Ittilaat (Notifications)", href: "/admin/notifications", description: "System notifications — kya hua, kab hua.", who: "Admin / Staff" },
  { section: "Administration", label: "Kaam ka Record (Activity Logs)", href: "/admin/activity-logs", description: "Tamam users ki activity — login, changes, deletions.", who: "Admin / Audit" },
  { section: "Administration", label: "Website Settings", href: "/admin/settings", description: "Website ki bunyadi settings — naam, logo, contact.", who: "Admin" },
];

const SECTIONS = ["Sab", "🆕 Naya", ...Array.from(new Set(ALL_FEATURES.map((f) => f.section)))];

const SECTION_COLORS: Record<string, string> = {
  "Master Command": "bg-brand-100 text-brand-800 dark:bg-brand-950/40 dark:text-brand-300",
  Business: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  Sales: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  Purchases: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  Inventory: "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  Agriculture: "bg-lime-100 text-lime-800 dark:bg-lime-950/40 dark:text-lime-300",
  Dairy: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300",
  Finance: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  Rates: "bg-pink-100 text-pink-800 dark:bg-pink-950/40 dark:text-pink-300",
  Reports: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
  "Website CMS": "bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300",
  Administration: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
};

export default function ErpDirectoryPage() {
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState("Sab");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_FEATURES.filter((f) => {
      const sectionOk = activeSection === "Sab"
        ? true
        : activeSection === "🆕 Naya"
        ? isNew(f.addedDate)
        : f.section === activeSection;
      const textOk = !q || f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || f.section.toLowerCase().includes(q) || f.who.toLowerCase().includes(q);
      return sectionOk && textOk;
    });
  }, [search, activeSection]);

  return (
    <div className="space-y-0">
      <PageHeader
        title="ERP ka Naqsha"
        description={`Tamam ${ALL_FEATURES.length} features — section, naam, kaam, aur URL.`}
      />

      {/* Search + Filter */}
      <div className="sticky top-0 z-20 border-b border-surface-200 bg-white px-4 py-3 dark:border-surface-800 dark:bg-surface-950">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder="Feature dhundho — naam, kaam, kaun..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-surface-200 bg-surface-50 py-2 pl-9 pr-3 text-sm text-surface-900 focus:border-brand-500 focus:outline-none dark:border-surface-700 dark:bg-surface-900 dark:text-white"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SECTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeSection === s
                    ? s === "🆕 Naya"
                      ? "bg-emerald-600 text-white"
                      : "bg-brand-600 text-white"
                    : s === "🆕 Naya"
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1.5 text-xs text-surface-400">{filtered.length} feature mil{filtered.length === 1 ? "a" : "e"}</p>
      </div>

      {/* Table */}
      <div className="px-4 py-4">
        <div className="overflow-x-auto rounded-xl border border-surface-200 dark:border-surface-800">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="bg-surface-50 text-left text-xs font-semibold text-surface-500 dark:bg-surface-800">
                <th className="w-28 px-4 py-3">Section</th>
                <th className="w-52 px-4 py-3">Feature / Safha</th>
                <th className="px-4 py-3">Kaam kya hai</th>
                <th className="w-36 px-4 py-3">Kaun use kare</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-surface-400">
                    Koi feature nahi mila — search badlein ya section filter hataein.
                  </td>
                </tr>
              ) : (
                filtered.map((f, i) => (
                  <tr key={i} className={`border-t border-surface-100 transition-colors hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-900/50 ${isNew(f.addedDate) ? "bg-emerald-50/60 dark:bg-emerald-950/20" : ""}`}>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${SECTION_COLORS[f.section] ?? "bg-surface-100 text-surface-700"}`}>
                        {f.section}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-surface-900 dark:text-white">{f.label}</span>
                        {isNew(f.addedDate) && (
                          <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">NAYA</span>
                        )}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-surface-400">{f.href}</div>
                    </td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{f.description}</td>
                    <td className="px-4 py-3 text-xs text-surface-500">{f.who}</td>
                    <td className="px-4 py-3">
                      <Link href={f.href} className="rounded p-1 text-surface-400 hover:text-brand-600">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
