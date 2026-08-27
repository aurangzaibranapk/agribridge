"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
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

  return (
    <div className="space-y-4">
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
        <span className="text-xs font-medium text-surface-400">ya mobile / email se</span>
        <div className="h-px flex-1 bg-surface-200" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div>
          <Label htmlFor="identifier">Mobile Number ya Email</Label>
          <Input id="identifier" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="03001234567 ya you@example.com" />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs font-medium text-[#1E4A2E] hover:underline">Password bhool gaye?</Link>
          </div>
          <PasswordInput id="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Sign in ho raha hai..." : "Sign in"}
        </Button>
      </form>
    </div>
  );
}