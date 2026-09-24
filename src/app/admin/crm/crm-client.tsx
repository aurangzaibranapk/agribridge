"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/form";
import { Users, Truck, Building2, Briefcase } from "lucide-react";
import { CustomerActions } from "@/app/admin/crm/customer-actions";
import { AddCustomerButton, EditCustomerButton } from "@/app/admin/crm/customer-form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface Customer {
  id: string;
  name: string;
  phone_number: string;
  contact_person: string | null;
  email: string | null;
  address: string | null;
  credit_limit: number;
  payment_due_days: number;
  current_balance: number;
  is_active: boolean;
}

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone_number: string | null;
  current_payable: number;
}

interface Company {
  id: string;
  name: string;
  contact_person: string | null;
  phone_number: string | null;
}

interface Dealer {
  id: string;
  business_name: string;
  district: string | null;
  verification_status: string;
  current_payable: number;
}

const TABS = [
  { value: "customers", label: "Customers", icon: Users },
  { value: "suppliers", label: "Suppliers", icon: Truck },
  { value: "companies", label: "Companies", icon: Building2 },
  { value: "dealers", label: "Dealers", icon: Briefcase },
] as const;

export function CrmClient({
  customers,
  suppliers,
  companies,
  dealers,
}: {
  customers: Customer[];
  suppliers: Supplier[];
  companies: Company[];
  dealers: Dealer[];
}) {
  const [activeTab, setActiveTab] = useState<"customers" | "suppliers" | "companies" | "dealers">("customers");
  const lang = useLang();

  function statusTone(status: string) {
    if (status === "verified") return "green" as const;
    if (status === "pending") return "amber" as const;
    return "red" as const;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  activeTab === tab.value
                    ? "bg-brand-600 text-white"
                    : "bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-400"
                }`}
              >
                <Icon className="h-4 w-4" /> {tab.label}
              </button>
            );
          })}
        </div>
        {activeTab === "customers" && <AddCustomerButton />}
      </div>

      {activeTab === "customers" && (
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_name", lang)}</th>
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_phone", lang)}</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">{t("cr_khata_balance", lang)}</th>
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_status", lang)}</th>
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_edit", lang)}</th>
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_actions", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-4 py-3 font-medium text-surface-800 dark:text-surface-200">{c.name}</td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{c.phone_number}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${c.current_balance > 0 ? "text-red-600" : "text-surface-500"}`}>
                    Rs {c.current_balance.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={c.is_active ? "green" : "gray"}>{c.is_active ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <EditCustomerButton customer={c} />
                  </td>
                  <td className="px-4 py-3">
                    <CustomerActions customerId={c.id} isActive={c.is_active} />
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-surface-400">{t("cr_no_customers", lang)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "suppliers" && (
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_name", lang)}</th>
                <th className="px-4 py-3 font-medium text-surface-500">{t("fp_contact", lang)}</th>
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_phone", lang)}</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">{t("c_payable", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-4 py-3 font-medium text-surface-800 dark:text-surface-200">{s.name}</td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{s.contact_person ?? "-"}</td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{s.phone_number ?? "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-surface-800 dark:text-surface-200">
                    Rs {s.current_payable.toLocaleString()}
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-surface-400">{t("cr_no_suppliers", lang)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "companies" && (
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_name", lang)}</th>
                <th className="px-4 py-3 font-medium text-surface-500">{t("fp_contact", lang)}</th>
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_phone", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-4 py-3 font-medium text-surface-800 dark:text-surface-200">{c.name}</td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{c.contact_person ?? "-"}</td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{c.phone_number ?? "-"}</td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-surface-400">{t("cr_no_companies", lang)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "dealers" && (
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_business_name", lang)}</th>
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_district", lang)}</th>
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_status", lang)}</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">{t("c_payable", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {dealers.map((d) => (
                <tr key={d.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-4 py-3 font-medium text-surface-800 dark:text-surface-200">{d.business_name}</td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{d.district ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(d.verification_status)}>{d.verification_status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-surface-800 dark:text-surface-200">
                    Rs {d.current_payable.toLocaleString()}
                  </td>
                </tr>
              ))}
              {dealers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-surface-400">{t("dl_none_yet", lang)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}