"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { useFormState, useFormStatus } from "react-dom";
import { requestFarmerOtp, verifyFarmerOtp, loginWithUsername, type FarmerAuthState } from "@/actions/farmer-auth";
import { getRoleRedirectPath } from "@/lib/utils/roles";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.4 29.4 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 5 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.6 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.9 29.6 5 24 5c-7.7 0-14.4 4.3-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 43c5.3 0 10.1-1.8 13.7-5l-6.3-5.3c-2 1.4-4.6 2.3-7.4 2.3-5.4 0-9.9-3.6-11.5-8.5l-6.5 5C9.4 38.7 16.1 43 24 43z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2-1.9 3.7-3.5 5.1l6.3 5.3C41.3 35.3 44 30 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="white">
      <path d="M22 12c0-5.5-4.5-10-10-10S2 6.5 2 12c0 5 3.7 9.1 8.4 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7C18.3 21.1 22 17 22 12z" />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Staff/customers sign in with a real email. Farmers who registered
    // with only a mobile number have no real email on file — their
    // account was created under a deterministic placeholder address
    // (see registerFarmer), which is reconstructed here the same way
    // whenever the identifier they type isn't an email.
    const trimmed = identifier.trim();
    const email = trimmed.includes("@") ? trimmed.toLowerCase() : `${trimmed.replace(/\D/g, "")}@phone.agribridge.local`;

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setLoading(false);
      setError(signInError.message === "Invalid login credentials" ? "Ghalat email ya password." : signInError.message);
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", data.user.id).single();

    if (!profile) {
      setLoading(false);
      setError("Account setup adhoora hai. Support se rabta karein.");
      return;
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Ye account deactivate ho chuka hai. Admin se rabta karein.");
      return;
    }

    // One login for everyone (staff, farmer, customer) — same account, same
    // form. Where they land next depends only on profiles.role.
    const redirectTo = searchParams.get("redirectTo");
    router.push(redirectTo && redirectTo !== "/login" ? redirectTo : getRoleRedirectPath(profile.role));
    router.refresh();
  }

  async function handleOAuth(provider: "google" | "facebook") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  const [mode, setMode] = useState<"farmer" | "staff">("farmer");

  return (
    <div className="space-y-4">
      {/* Do bilkul alag log, do bilkul alag darwaze.
          Pehle ek hi form dono ko dikhta tha: "Mobile Number ya Email"
          aur neeche Password. Kisan ke paas na email hota hai na
          password -- wo us form ko dekh kar wahin ruk jata tha. Ab
          pehla darwaza usi ka hai, aur staff wala saath mein khara hai
          magar chhota. */}
      <div className="flex rounded-lg bg-surface-100 p-1">
        <button
          type="button"
          onClick={() => setMode("farmer")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === "farmer" ? "bg-white text-surface-900 shadow-sm" : "text-surface-500 hover:text-surface-700"
          }`}
        >
          Kisan
        </button>
        <button
          type="button"
          onClick={() => setMode("staff")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === "staff" ? "bg-white text-surface-900 shadow-sm" : "text-surface-500 hover:text-surface-700"
          }`}
        >
          Staff / Admin / Vendor
        </button>
      </div>

      {mode === "farmer" ? (
        <FarmerOtpLogin />
      ) : (
        <>
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-surface-200 bg-white px-4 py-2.5 text-sm font-medium text-surface-700 transition-colors hover:border-surface-300 hover:bg-surface-50"
            >
              <GoogleIcon /> Google se jaari rakhein
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("facebook")}
              className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#166FE5]"
            >
              <FacebookIcon /> Facebook se jaari rakhein
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-surface-200" />
            <span className="text-xs font-medium text-surface-400">ya email se</span>
            <div className="h-px flex-1 bg-surface-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div>
              <Label htmlFor="identifier">Email ya Mobile</Label>
              <Input id="identifier" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@example.com" />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {/* "Password bhool gaye?" ab sirf yahan hai. Kisan ko wo
                    link dikhana usay email wale safhe par le jata tha --
                    ek aisi cheez maangne jo us ke paas hai hi nahi. */}
                <Link href="/forgot-password" className="text-xs font-medium text-[#1E4A2E] hover:underline">Password bhool gaye?</Link>
              </div>
              <PasswordInput id="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Sign in ho raha hai..." : "Sign in"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

const emptyState: FarmerAuthState = {};

/**
 * Kisan ka darwaza -- mobile, phir OTP.
 *
 * Naya kisan aur purana kisan ke liye ALAG safha nahi hai. Number
 * daalte hi maloom ho jata hai ke ye number kis ka hai: purana hai to
 * us ka naam saamne aa jata hai, naya hai to sirf naam aur gaon poochh
 * liya jata hai. Kisan ke liye dono soorton mein kaam ek hi hai --
 * number likho, code likho, andar.
 */
function FarmerOtpLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  // Kisan ka doosra raasta -- us ke liye jis ne apni User ID bana li hai
  // (198). Wo pehli cheez NAHI hai jo safha dikhata: naye kisan ke paas
  // User ID hoti hi nahi, aur usay pehle wo khana dikhana usay wahin
  // rok deta hai.
  const [byUsername, setByUsername] = useState(false);
  const [askState, askAction] = useFormState(requestFarmerOtp, emptyState);
  const [checkState, checkAction] = useFormState(verifyFarmerOtp, emptyState);

  const sent = askState.otpSent || checkState.otpSent;
  const needsProfile = checkState.needsProfile ?? askState.needsProfile ?? false;
  const knownName = askState.knownName;

  // Redirect ko render ke andar rakhna React ke usool ke khilaf hai --
  // render sirf shakl banata hai, kaam nahi karta. Us jagah ye chalta
  // to har dobara banne par phir chalta.
  useEffect(() => {
    if (checkState.success) {
      router.push("/portal/dashboard");
      router.refresh();
    }
  }, [checkState.success, router]);

  if (byUsername) {
    return <FarmerUsernameLogin onBack={() => setByUsername(false)} />;
  }

  if (!sent) {
    return (
      <>
      <form action={askAction} className="space-y-4">
        {askState.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{askState.error}</p>}
        <div>
          <Label htmlFor="phone">Mobile Number</Label>
          <Input
            id="phone"
            name="phone"
            required
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0300 1234567"
          />
          <p className="mt-1 text-xs text-surface-400">
            Code aap ke WhatsApp par jayega. WhatsApp na ho to SMS par.
          </p>
        </div>
        <SubmitBtn label="OTP bhejein" busy="Bheja ja raha hai..." />
      </form>
      <button
        type="button"
        onClick={() => setByUsername(true)}
        className="mt-3 w-full text-center text-xs font-medium text-[#1E4A2E] hover:underline"
      >
        Apni User ID bana rakhi hai? Us se login karein
      </button>
      </>
    );
  }

  return (
    <div>
      <form action={checkAction} className="space-y-4">
        {(checkState.error || askState.error) && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{checkState.error ?? askState.error}</p>
      )}
      {askState.sentVia && !checkState.error && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          Code {askState.sentVia === "whatsapp" ? "WhatsApp" : "SMS"} par bhej diya gaya
          {knownName ? ` — ${knownName}` : ""}.
        </p>
      )}

      <input type="hidden" name="phone" value={phone} />

      <div>
        <Label htmlFor="code">Chhe hindse wala code</Label>
        <Input id="code" name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="------" />
      </div>

      {needsProfile && (
        <>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Ye number pehli dafa aaya hai. Apna naam aur gaon likh dein — aap ka khata usi waqt ban jayega.
          </p>
          <div>
            <Label htmlFor="full_name">Aap ka naam</Label>
            <Input id="full_name" name="full_name" required placeholder="Misal: Amir Sultan" />
          </div>
          <div>
            <Label htmlFor="village">Gaon</Label>
            <Input id="village" name="village" placeholder="Misal: Chak Maha Bali" />
          </div>
        </>
      )}

        <SubmitBtn label="Andar jayein" busy="Check ho raha hai..." />
      </form>

      {/* Kisan ke liye "Password bhool gaye?" bemaani hai -- us ka koi
          password hai hi nahi. Us ki jagah wohi cheez jo us ke kaam ki
          hai.

          Ye apna alag form hai, us ke andar nahi: HTML mein form ke
          andar form hota hi nahi, aur browser wahan andar wala chup
          chaap gira deta hai. */}
      <form action={askAction} className="mt-3">
        <input type="hidden" name="phone" value={phone} />
        <button type="submit" className="w-full text-center text-xs font-medium text-[#1E4A2E] hover:underline">
          Code nahi mila? Dobara bhejein
        </button>
      </form>
    </div>
  );
}

function SubmitBtn({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? busy : label}
    </Button>
  );
}

/**
 * User ID aur password se login.
 *
 * Kisan ne ye khud banaya hota hai (portal ki profile par), aur ye us
 * ke liye hai jo roz aata hai. Ghalat naam aur ghalat password par
 * jumla EK HI hai -- alag jumla dena kisi ko ye bata deta ke kaunsi
 * User ID maujood hai aur kaunsi nahi, aur wo fehrist banane ka pehla
 * qadam hota hai.
 */
function FarmerUsernameLogin({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [state, action] = useFormState(loginWithUsername, emptyState);

  useEffect(() => {
    if (state.success) {
      router.push("/portal/dashboard");
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <div>
      <form action={action} className="space-y-4">
        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <div>
          <Label htmlFor="username">User ID</Label>
          <Input id="username" name="username" required autoComplete="username" placeholder="misal: aurangzeb" />
        </div>
        <div>
          <Label htmlFor="fpassword">Password</Label>
          <PasswordInput id="fpassword" name="password" required placeholder="••••••••" />
        </div>
        <SubmitBtn label="Andar jayein" busy="Check ho raha hai..." />
      </form>
      <button
        type="button"
        onClick={onBack}
        className="mt-3 w-full text-center text-xs font-medium text-[#1E4A2E] hover:underline"
      >
        Password yaad nahi? Mobile aur OTP se login karein
      </button>
    </div>
  );
}
