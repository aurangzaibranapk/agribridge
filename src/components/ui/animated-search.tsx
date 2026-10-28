"use client";
/**
 * AnimatedSearch -- gol button jo khul kar lamba search box banta hai
 * (malik ne 19 October ko design approve kiya). Sirf dikhne ka andaz:
 * search ki logic wahi rehti hai jo page pehle se chala raha hai --
 * value/onChange/form submit seedha page ko jate hain.
 *
 * Mic sirf bol kar likhwata hai (dictation). Koi action khud nahi chalta.
 */
import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState, type InputHTMLAttributes } from "react";
import { Search, X, Mic, MicOff } from "lucide-react";
import { useLang } from "@/lib/i18n/lang-context";
import {
  DEFAULT_PLACEHOLDER, EASING, EXPAND_MS, LABELS, groupResults, isOpenShortcut, mergeDictation, nextActive, speechLang,
  type SearchLang, type SearchResult,
} from "@/lib/ui/animated-search";

export type AnimatedSearchProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  placeholder?: string | Partial<Record<SearchLang, string>>;
  lang?: SearchLang;
  /** Ctrl+K aur '/' -- sirf global topbar ke liye. */
  shortcut?: boolean;
  voice?: boolean;
  /** Jahan search hamesha khula rehna chahiye (POS). */
  defaultOpen?: boolean;
  expandedWidth?: string;
  results?: SearchResult[];
  onSelect?: (r: SearchResult) => void;
  className?: string;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "placeholder">;
};

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export const AnimatedSearch = forwardRef<HTMLInputElement, AnimatedSearchProps>(function AnimatedSearch(
  { value, defaultValue = "", onValueChange, placeholder, lang: langProp, shortcut = false, voice = true, defaultOpen = false,
    expandedWidth = "100%", results, onSelect, className = "", inputProps = {} },
  ref,
) {
  const ctxLang = useLang();
  const lang: SearchLang = langProp ?? (ctxLang as SearchLang);
  const L = LABELS[lang];
  const ph = typeof placeholder === "string" ? placeholder : placeholder?.[lang] ?? DEFAULT_PLACEHOLDER[lang];
  const rtl = lang === "ur";
  const uid = useId();
  const listId = `${uid}-list`;

  const [inner, setInner] = useState(defaultValue);
  const val = value ?? inner;
  const setVal = useCallback((v: string) => { if (value === undefined) setInner(v); onValueChange?.(v); }, [value, onValueChange]);

  const [open, setOpen] = useState(defaultOpen || !!val);
  const [active, setActive] = useState(-1);
  const [listening, setListening] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [reduced, setReduced] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const recRef = useRef<any>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  useEffect(() => {
    setReduced(prefersReducedMotion());
    setMicOk(typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  }, []);

  const openNow = useCallback(() => { setOpen(true); requestAnimationFrame(() => inputRef.current?.focus()); }, []);
  const close = useCallback(() => {
    recRef.current?.stop?.();
    setActive(-1);
    if (defaultOpen) { setVal(""); inputRef.current?.focus(); return; }
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [defaultOpen, setVal]);

  useEffect(() => {
    if (!shortcut) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const editable = !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
      if (isOpenShortcut(e, editable)) { e.preventDefault(); openNow(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut, openNow]);

  const list = results ?? [];
  const showList = open && list.length > 0;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!list.length) return;
      e.preventDefault(); setActive((a) => nextActive(a, list.length, e.key)); return;
    }
    if (e.key === "Enter" && active >= 0 && list[active]) { e.preventDefault(); onSelect?.(list[active]); setActive(-1); return; }
    inputProps.onKeyDown?.(e);
  }

  function toggleMic() {
    if (listening) { recRef.current?.stop?.(); setListening(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = speechLang(lang); rec.interimResults = false; rec.maxAlternatives = 1;
    // Sirf alfaz box mein -- form khud nahi chalta, koi action nahi.
    rec.onresult = (ev: any) => { const said = ev.results?.[0]?.[0]?.transcript ?? ""; setVal(mergeDictation(inputRef.current?.value ?? val, said)); inputRef.current?.focus(); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec; rec.start(); setListening(true);
  }

  const dur = reduced ? 0 : EXPAND_MS;
  const { className: inputClass = "", onKeyDown: _ignored, ...restInput } = inputProps;

  return (
    <div dir={rtl ? "rtl" : "ltr"} data-anim-search="" data-open={open ? "1" : "0"} className={`relative ${className}`}
      style={{ width: open ? expandedWidth : "3rem", maxWidth: "100%", transition: `width ${dur}ms ${EASING}` }}>
      <div className={`flex h-12 items-center rounded-full border shadow-sm transition-colors
        border-[#d9d3bf] bg-[#fbf8f0] dark:border-[#2a3a5c] dark:bg-[#0f1b33] ${open ? "ring-1 ring-[#8fa98a]/40 dark:ring-[#3b5b8f]/50" : ""}`}>
        <button ref={triggerRef} type="button" aria-label={open ? L.close : L.open} aria-expanded={open} aria-controls={`${uid}-input`}
          onClick={() => (open ? close() : openNow())}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[#1b2a4a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6f8f6a] dark:text-[#e8eefb]">
          <span className="relative block h-5 w-5" style={{ transition: `transform ${dur}ms ${EASING}`, transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>
            <Search aria-hidden className="absolute inset-0 h-5 w-5" style={{ opacity: open ? 0 : 1, transition: `opacity ${dur / 2}ms` }} />
            <X aria-hidden className="absolute inset-0 h-5 w-5" style={{ fontFamily: rtl ? "var(--font-urdu), 'Noto Nastaliq Urdu', serif" : undefined, opacity: open ? 1 : 0, transition: `opacity ${dur / 2}ms` }} />
          </span>
        </button>
        <input
          {...restInput}
          id={restInput.id ?? `${uid}-input`}
          ref={inputRef}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={restInput["aria-label"] ?? ph}
          aria-activedescendant={active >= 0 ? `${uid}-opt-${active}` : undefined}
          tabIndex={open ? 0 : -1}
          value={val}
          onChange={(e) => { setVal(e.target.value); setActive(-1); }}
          onKeyDown={onKeyDown}
          placeholder={ph}
          className={`min-w-0 flex-1 bg-transparent text-sm text-[#1b2a4a] placeholder:text-[#7b8597] focus:outline-none dark:text-[#e8eefb] dark:placeholder:text-[#8d9bb8] ${rtl ? "text-right" : ""} ${inputClass}`}
          style={{ fontFamily: rtl ? "var(--font-urdu), 'Noto Nastaliq Urdu', serif" : undefined, opacity: open ? 1 : 0, transition: reduced ? "none" : `opacity 300ms ease ${open ? 150 : 0}ms`, pointerEvents: open ? "auto" : "none" }}
        />
        {voice && micOk && open && (
          <button type="button" onClick={toggleMic} aria-pressed={listening} aria-label={listening ? L.micStop : L.mic}
            className={`mx-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6f8f6a] ${listening ? "bg-red-600 text-white" : "text-[#4f6b4b] hover:bg-[#eef0e4] dark:text-[#a9c1a4] dark:hover:bg-[#1a2a4a]"}`}>
            {listening ? <MicOff aria-hidden className="h-4 w-4" /> : <Mic aria-hidden className="h-4 w-4" />}
          </button>
        )}
      </div>
      <ul id={listId} role="listbox" aria-label={L.results} hidden={!showList}
        className="absolute inset-x-0 top-[3.25rem] z-50 max-h-80 overflow-auto rounded-2xl border border-[#d9d3bf] bg-white p-1 shadow-lg dark:border-[#2a3a5c] dark:bg-[#111f3b]">
        {groupResults(list).map((g) => (
          <li key={g.group || "_"} role="presentation">
            {g.group && <div className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#6f8f6a]">{g.group}</div>}
            <ul role="presentation">
              {g.items.map((r) => (
                <li key={r.id} id={`${uid}-opt-${r.index}`} role="option" aria-selected={r.index === active}
                  onMouseDown={(e) => { e.preventDefault(); onSelect?.(r); }}
                  className={`cursor-pointer rounded-xl px-3 py-2 text-sm ${r.index === active ? "bg-[#eef0e4] dark:bg-[#1a2a4a]" : ""} text-[#1b2a4a] dark:text-[#e8eefb]`}>
                  {r.label}{r.hint && <span className="ms-2 text-xs text-[#7b8597]">{r.hint}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
});
