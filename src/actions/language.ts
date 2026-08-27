"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function setLanguage(lang: "en" | "ur") {
  cookies().set("agribridge_lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}