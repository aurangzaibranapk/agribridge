"use client";
import { useSearchParams } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";

// Next.js 14 mein useSearchParams() null return kar sakta hai jab
// SearchParamsContext hydration ke waqt set nahi hota. Ye hook ensure
// karta hai ke hamesha ek valid ReadonlyURLSearchParams milta hai —
// null ki jagah empty params aa jaati hain. Seedha useSearchParams()
// kabhi use na karein; ye hook use karein.
const EMPTY = new URLSearchParams() as unknown as ReadonlyURLSearchParams;

export function useSafeSearchParams(): ReadonlyURLSearchParams {
  return useSearchParams() ?? EMPTY;
}
