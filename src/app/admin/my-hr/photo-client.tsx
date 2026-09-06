"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Camera, UserRound } from "lucide-react";
import { setMyPhoto, type ActionState } from "@/actions/hr";
import { Button } from "@/components/ui/form";

const initialState: ActionState = {};

/**
 * Apni tasveer.
 *
 * Malik (6 September): *"sare staff apni image laga sakein, aur tree
 * mein image bhi aani chahiye."*
 *
 * Ye khana yahan hai, Team ke safhe par nahi -- kyunki har banda apni
 * tasveer khud lagata hai. HR ke haath mein doosron ki shakal dena na
 * zaroori hai na theek, aur database mein bhi wo darwaza tang hai:
 * `fn_set_my_photo` sirf `auth.uid()` wale bande ka `photo_url` badalta
 * hai, aur kuch nahi.
 *
 * File chunte hi form khud chal parta hai. "Chunein phir Mehfooz
 * karein" do qadam hain, aur doosra qadam aksar reh jata hai -- banda
 * samajhta hai tasveer lag gayi, aur darakht par khali gola hi rehta
 * hai.
 */
export function PhotoClient({ naam, maujooda }: { naam: string; maujooda: string | null }) {
  const [state, action] = useFormState(setMyPhoto, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  // Chuni hui tasveer foran nazar aa jaye -- server se wapas aane tak
  // intezar mein banda dobara chunta rehta hai.
  const [jhalak, setJhalak] = useState<string | null>(null);

  const dikhane = jhalak ?? maujooda;
  const harf = naam
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <form ref={formRef} action={action} className="flex items-center gap-3">
      {dikhane ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dikhane}
          alt={naam}
          className="h-16 w-16 rounded-full border border-surface-200 object-cover dark:border-surface-700"
        />
      ) : (
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-surface-200 bg-surface-100 text-lg font-semibold text-surface-500 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-400">
          {harf || <UserRound className="h-6 w-6" />}
        </span>
      )}

      <div className="min-w-0">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800">
          <Camera className="h-4 w-4" />
          {maujooda ? "Tasveer badlein" : "Tasveer lagayein"}
          <input
            type="file"
            name="photo"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setJhalak(URL.createObjectURL(f));
              formRef.current?.requestSubmit();
            }}
          />
        </label>
        <Haalat />
        {state.error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>}
        {state.success && (
          <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">
            Lag gayi — ab Team ke darakht par bhi nazar aayegi.
          </p>
        )}
        <p className="mt-1 text-[11px] text-surface-400">jpg / png, 5 MB tak</p>
      </div>

      {/* Bina JS wale haal ke liye -- file chunne par form khud chalta
          hai, magar agar wo na chale to raasta band nahi hona chahiye. */}
      <noscript>
        <Button type="submit">Mehfooz karein</Button>
      </noscript>
    </form>
  );
}

function Haalat() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return <p className="mt-1 text-xs text-surface-500">Bheji ja rahi hai…</p>;
}
