import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { LangProvider } from "@/lib/i18n/lang-context";
import { RegisterFarmerForm } from "./register-farmer-form";

/**
 * Wohi wajah jo forgot-password ke safhe par likhi hai: form client par
 * chalta hai, aur cookie sirf server par parhi ja sakti hai. Zaban yahan
 * nikaal kar neeche bheji jati hai.
 */
export default function RegisterFarmerPage() {
  const lang = getLanguageFromCookies("ur");
  return (
    <LangProvider lang={lang}>
      <RegisterFarmerForm />
    </LangProvider>
  );
}
