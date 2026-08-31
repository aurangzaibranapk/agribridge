"use client";
import { useState } from "react";
import { Eye, EyeOff, Download, Layers } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface DocItem {
  label: string;
  url: string;
}

export function DocumentViewer({ documents }: { documents: DocItem[] }) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const lang = useLang();
  const [viewAll, setViewAll] = useState(false);

  if (documents.length === 0) return null;

  function toggleOne(label: string) {
    setViewAll(false);
    setOpenLabel(openLabel === label ? null : label);
  }

  function isImage(url: string) {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  }

  async function downloadAll() {
    for (const doc of documents) {
      const a = document.createElement("a");
      a.href = doc.url;
      a.download = doc.label;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  const shown = viewAll ? documents : documents.filter((d) => d.label === openLabel);

  return (
    <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">{t("c_documents", lang)}</p>
        <div className="flex gap-1.5">
          <button
            onClick={() => { setViewAll(!viewAll); setOpenLabel(null); }}
            className="flex items-center gap-1 rounded-lg border border-surface-200 px-2 py-1 text-xs text-surface-600 hover:bg-surface-50"
          >
            <Layers className="h-3 w-3" /> {viewAll ? "Sab Band Karein" : "Sab Dekhein"}
          </button>
          <button onClick={downloadAll} className="flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 text-xs text-brand-700 hover:bg-brand-100">
            <Download className="h-3 w-3" /> Sab Download
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {documents.map((doc) => (
          <div key={doc.label} className="flex items-center gap-1">
            <button
              onClick={() => toggleOne(doc.label)}
              className="flex items-center gap-1 rounded-lg border border-surface-200 px-2.5 py-1 text-xs text-surface-600 hover:bg-surface-50 dark:border-surface-700"
            >
              {openLabel === doc.label ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />} {doc.label}
            </button>
            <a href={doc.url} download={doc.label} className="rounded-lg border border-surface-200 p-1 text-surface-500 hover:bg-surface-50" title={t("c_download", lang)}>
              <Download className="h-3 w-3" />
            </a>
          </div>
        ))}
      </div>

      {shown.length > 0 && (
        <div className="mt-3 space-y-3">
          {shown.map((doc) => (
            <div key={doc.label} className="overflow-hidden rounded-lg border border-surface-200 dark:border-surface-700">
              <p className="border-b border-surface-100 bg-surface-50 px-2 py-1 text-xs font-medium text-surface-600 dark:border-surface-800 dark:bg-surface-800">
                {doc.label}
              </p>
              {isImage(doc.url) ? (
                <img src={doc.url} alt={doc.label} className="max-h-[400px] w-full object-contain bg-surface-50" />
              ) : (
                <iframe src={doc.url} className="h-[400px] w-full" title={doc.label} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}