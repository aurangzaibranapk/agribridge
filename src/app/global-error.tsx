"use client";

import { useEffect } from "react";
import { puranaSafhaKhudTheekKarein } from "@/lib/errors/stale-build";

/**
 * Sab se upar wala jaal -- jahan aur koi jaal nahi pahunchta.
 *
 * =====================================================================
 * YE FILE KYUN BANI
 * =====================================================================
 *
 * `error.tsx` sirf apne hisse ke ANDAR ki kharabi pakarta hai. Agar
 * kharabi LAYOUT mein ho -- ya safhe ke us hisse mein jo har safhe se
 * pehle chalta hai -- to wo us jaal se bahar hoti hai, aur Next apna
 * saada safha dikhata hai:
 *
 *     "Application error: a client-side exception has occurred
 *      (see the browser console for more information)"
 *
 * Malik ko 6 September ko yehi safha `/admin/farmers` par mila -- sufaid
 * screen, ek jumla, aur koi raasta nahi. `admin/error.tsx` maujood tha,
 * magar wo is qism ki kharabi tak pahunchta hi nahi.
 *
 * `global-error.tsx` wo aakhri jaal hai jo POORE app par lagta hai --
 * layout samet. Isi liye is ko apna `<html>` aur `<body>` khud likhna
 * parta hai: jis waqt ye chalta hai, app ka apna layout chal hi nahi
 * raha hota.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Purane build ki baat ho to safha khud naya le aata hai -- bande ko
    // kuch dikhane ki zaroorat hi nahi.
    if (puranaSafhaKhudTheekKarein(error)) return;

    console.error("Safhe par kharabi (global):", error);
    try {
      fetch("/api/log-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          module: "code",
          severity: "rukawat",
          message: error.message || "Safhe par kuch toot gaya (global)",
          route: typeof window !== "undefined" ? window.location.pathname : null,
          digest: error.digest ?? null,
          detail: error.stack ?? null,
        }),
      }).catch(() => {});
    } catch {
      // Khabar na ja sake to bhi safha wohi rehta hai jo dikhna chahiye.
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fafaf9" }}>
        <div style={{ maxWidth: "34rem", margin: "12vh auto", padding: "0 1rem" }}>
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              borderRadius: "0.75rem",
              padding: "1.25rem",
            }}
          >
            <h1 style={{ margin: 0, fontSize: "1.05rem", color: "#991b1b" }}>
              Safhe par kuch toot gaya
            </h1>
            <p style={{ marginTop: "0.35rem", fontSize: "0.875rem", color: "#b91c1c" }}>
              Jo kuch mehfooz ho chuka tha wo mehfooz hai — kuch zaya nahi hua.
            </p>

            <div
              style={{
                marginTop: "1rem",
                background: "#fff",
                border: "1px solid #fecaca",
                borderRadius: "0.5rem",
                padding: "0.75rem",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#78716c",
                }}
              >
                Wajah
              </p>
              <p
                style={{
                  margin: "0.25rem 0 0",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "0.75rem",
                  color: "#292524",
                  wordBreak: "break-word",
                }}
              >
                {error.message || "Paighaam nahi mila"}
              </p>
              {error.digest && (
                <p
                  style={{
                    margin: "0.5rem 0 0",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: "0.75rem",
                    color: "#78716c",
                  }}
                >
                  digest: {error.digest}
                </p>
              )}
            </div>

            <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  background: "#b91c1c",
                  color: "#fff",
                  border: 0,
                  borderRadius: "0.5rem",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                Dobara koshish karein
              </button>
              <a
                href="/admin/my-work"
                style={{
                  border: "1px solid #e7e5e4",
                  borderRadius: "0.5rem",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.875rem",
                  color: "#44403c",
                  textDecoration: "none",
                }}
              >
                Mera Kaam par wapas
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
