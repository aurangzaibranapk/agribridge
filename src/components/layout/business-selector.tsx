"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Building2, Store, Sprout, Wheat, Milk, Truck, Stethoscope } from "lucide-react";
import { setBusinessContext, type BusinessContext } from "@/actions/business-context";

const OPTIONS: { value: BusinessContext; label: string; icon: any }[] = [
  { value: "master", label: "Master View", icon: Building2 },
  { value: "karyana", label: "Al Rana Traders (Karyana)", icon: Store },
  { value: "agri_inputs", label: "Agri Inputs", icon: Sprout },
  { value: "grain_procurement", label: "Grain Procurement", icon: Wheat },
  { value: "dairy", label: "Dairy", icon: Milk },
  { value: "machinery_fleet", label: "Machinery & Fleet", icon: Truck },
  { value: "vet", label: "Vets", icon: Stethoscope },
];

export function BusinessSelector({ current }: { current: BusinessContext }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentOption = OPTIONS.find((o) => o.value === current) ?? OPTIONS[0];
  const CurrentIcon = currentOption.icon;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      {loading && (
        <>
          <style>{`
            @keyframes topbar-slide {
              0%   { transform: scaleX(0);    opacity: 1; }
              70%  { transform: scaleX(0.88); opacity: 1; }
              100% { transform: scaleX(0.96); opacity: 1; }
            }
            @keyframes topbar-pulse {
              0%, 100% { opacity: 1; }
              50%       { opacity: 0.65; }
            }
          `}</style>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              height: "3px",
              zIndex: 9999,
              background: "#16a34a",
              transformOrigin: "left center",
              animation:
                "topbar-slide 2.5s cubic-bezier(0.1,0.7,0.4,1) forwards, topbar-pulse 1s ease-in-out infinite",
            }}
          />
        </>
      )}
      <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-100 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-200"
      >
        <CurrentIcon className="h-4 w-4 text-brand-600" />
        <span className="hidden sm:inline">{currentOption.label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-surface-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-surface-200 bg-white shadow-lg dark:border-surface-800 dark:bg-surface-900">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <form key={opt.value} action={setBusinessContext}>
                <input type="hidden" name="business" value={opt.value} />
                <button
                  type="submit"
                  onClick={() => { setOpen(false); setLoading(true); }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-surface-50 dark:hover:bg-surface-800 ${
                    opt.value === current ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/20 dark:text-brand-300" : "text-surface-700 dark:text-surface-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {opt.label}
                </button>
              </form>
            );
          })}
        </div>
      )}
      </div>
    </>
  );
}