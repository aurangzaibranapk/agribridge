import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { LangProvider } from "@/lib/i18n/lang-context";
import { ForgotPasswordForm } from "./forgot-password-form";

/**
 * Darwaze ke safhon ke liye zaban ka bandobast.
 *
 * Form khud client par chalta hai (useFormState), aur client component
 * cookie nahi parh sakta. Pehle poora safha client tha, is liye us tak
 * zaban pahunchne ka koi raasta hi nahi tha.
 *
 * LangProvider yahan lagaya ja raha hai, root layout par nahi: root
 * layout poori website ka hai aur wahan cookies() parhne se har safha
 * dynamic ho jata -- public website ka static rendering khatam.
 */
export default function ForgotPasswordPage() {
  const lang = getLanguageFromCookies("ur");
  return (
    <LangProvider lang={lang}>
      <ForgotPasswordForm />
    </LangProvider>
  );
}
