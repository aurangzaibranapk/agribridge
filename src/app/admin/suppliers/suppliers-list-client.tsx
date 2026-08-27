"use client";
import { useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { updateSupplierStatus, deleteSupplier, type ActionState } from "@/actions/suppliers";
import { DeleteButton } from "@/components/admin/delete-button";
import { SupplierForm } from "./supplier-form";
import { Edit, FileText, FileCheck } from "lucide-react";

const initialState: ActionState = {};

interface Supplier {
  id: string;
  name: string;
  company_name: string | null;
  contact_person: string | null;
  phone_number: string | null;
  email: string | null;
  address: string | null;
  credit_limit: number | null;
  current_payable: number | null;
  cnic_number: string | null;
  cnic_document_url: string | null;
  ntn_number: string | null;
  ntn_document_url: string | null;
  tax_status: string | null;
  is_active: boolean;
  status: string;
  bank_name: string | null;
  bank_account_title: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
}

export function SuppliersListClient({ suppliers }: { suppliers: Supplier[] }) {
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-2">
        {suppliers.map((s) => (
          <div key={s.id} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-surface-900 dark:text-white">{s.name} {s.company_name ? `(${s.company_name})` : ""}</p>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-surface-500">
                  {s.contact_person && <span>{s.contact_person}</span>}
                  {s.phone_number && <span>{s.phone_number}</span>}
                  {s.email && <span>{s.email}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {s.tax_status === "filer" ? (
                    <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700"><FileCheck className="h-3 w-3" /> Filer</span>
                  ) : (
                    <span className="rounded-full bg-surface-100 px-2 py-0.5 text-xs text-surface-500">Non-Filer</span>
                  )}
                  <StatusBadge status={s.status} />
                </div>
                {Number(s.current_payable) > 0 && (
                  <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    Payable: Rs {Number(s.current_payable).toLocaleString()}
                  </p>
                )}
                {s.cnic_document_url && <a href={s.cnic_document_url} target="_blank" rel="noopener noreferrer" className="mr-2 text-xs text-brand-600 hover:underline">CNIC Dekhein</a>}
                {s.ntn_document_url && <a href={s.ntn_document_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">NTN Dekhein</a>}
              </div>
              <div className="flex flex-col gap-1.5">
                <button onClick={() => setEditingSupplier(s)} className="flex items-center gap-1 rounded-lg border border-surface-200 px-2 py-1 text-xs text-surface-600 hover:bg-surface-50">
                  <Edit className="h-3 w-3" /> Edit
                </button>
                <Link href={`/admin/suppliers/${s.id}/statement`} className="flex items-center gap-1 rounded-lg border border-surface-200 px-2 py-1 text-xs text-surface-600 hover:bg-surface-50">
                  <FileText className="h-3 w-3" /> Statement
                </Link>
                <StatusButtons supplierId={s.id} currentStatus={s.status} />
                <DeleteButton id={s.id} action={deleteSupplier} />
              </div>
            </div>
          </div>
        ))}
        {suppliers.length === 0 && <p className="rounded-card border border-dashed border-surface-200 bg-white p-8 text-center text-surface-400">Koi supplier nahi hai.</p>}
      </div>

      <SupplierForm editSupplier={editingSupplier} onDoneEditing={() => setEditingSupplier(null)} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">Active</span>;
  if (status === "suspended") return <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">Suspended</span>;
  return <span className="rounded-full bg-surface-100 px-2 py-0.5 text-xs text-surface-500">Inactive</span>;
}

function StatusButtons({ supplierId, currentStatus }: { supplierId: string; currentStatus: string }) {
  const [, formAction] = useFormState(updateSupplierStatus, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={supplierId} />
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => e.target.form?.requestSubmit()}
        className="w-full rounded-lg border border-surface-200 px-2 py-1 text-xs"
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="suspended">Suspended</option>
      </select>
    </form>
  );
}