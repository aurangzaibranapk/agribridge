"use client";

export function CopyUrlButton({ url }: { url: string }) {
  return (
    <input
      readOnly
      value={url}
      onClick={(e) => (e.target as HTMLInputElement).select()}
      className="mt-1 w-full rounded border border-surface-200 bg-surface-50 px-1 py-0.5 text-[10px] text-surface-500 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-400"
    />
  );
}