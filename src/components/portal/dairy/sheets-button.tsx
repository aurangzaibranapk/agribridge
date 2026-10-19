"use client";
/** CSV download + naya Google Sheet tab (File → Import se CSV daalein). */
export function SheetsButton({ href, label, help }: { href: string; label: string; help: string }) {
  return (
    <a href={href} title={help} onClick={() => window.open("https://sheets.new", "_blank", "noopener,noreferrer")} className="rounded-xl bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700">📊 {label}</a>
  );
}
