"use client";
import { useState } from "react";
import { Briefcase, MapPin } from "lucide-react";
import { ApplyForm } from "./apply-form";

interface Vacancy {
  id: string;
  title: string;
  designation: string | null;
  description: string | null;
  requirements: string | null;
  branch_name: string | null;
}

export function VacancyList({ vacancies }: { vacancies: Vacancy[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [applyId, setApplyId] = useState<string | null>(null);

  if (vacancies.length === 0) {
    return <p className="rounded-card border border-dashed border-surface-200 bg-white p-8 text-center text-surface-400">Abhi koi vacancy khali nahi hai.</p>;
  }

  return (
    <div className="space-y-3">
      {vacancies.map((v) => (
        <div key={v.id} className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-brand-600" />
              <p className="font-medium text-surface-900">{v.title}</p>
            </div>
            {v.branch_name && (
              <span className="flex items-center gap-1 text-xs text-surface-500">
                <MapPin className="h-3 w-3" /> {v.branch_name}
              </span>
            )}
          </div>
          {v.description && <p className="mt-2 text-sm text-surface-600">{v.description}</p>}
          {v.requirements && <p className="mt-1 text-xs text-surface-400">Requirements: {v.requirements}</p>}

          {applyId === v.id ? (
            <ApplyForm vacancyId={v.id} onClose={() => setApplyId(null)} />
          ) : (
            <button
              onClick={() => setApplyId(v.id)}
              className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Apply Karein
            </button>
          )}
        </div>
      ))}
    </div>
  );
}