import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

/**
 * Font project ke ANDAR se, Google se nahi.
 *
 * Pehle ye teenon `next/font/google` se aate the. Us ka matlab ye tha ke
 * HAR build Google ke server se font utaarti thi. Wo file `.next/cache`
 * mein rehti hai -- magar jab bhi `rm -rf .next` hota (aur wo aksar hota
 * tha, cache kharab hone par), agli build ko sab kuch dobara download
 * karna paRta.
 *
 * Malik ki machine par isi jagah build 30 minute tak khaRi rehti thi:
 *
 *     Creating an optimized production build ...
 *     ⚠ Failed to find font override values for font `Nunito Sans`
 *
 * Wo warning hi nishan thi -- Google tak raasta sust tha, aur build us
 * ka intezar kar rahi thi. Yahan (tez network par) wohi build 108 second
 * mein hoti thi, is liye masla nazar hi nahi aata tha.
 *
 * Ab teenon font (sirf latin, sirf wo wazan jo istemal hote hain --
 * kul 126 KB) project ke andar hain. Build ko ab INTERNET KI ZAROORAT
 * HI NAHI -- na hamare yahan, na malik ki machine par, na kabhi CI par.
 *
 * `adjustFontFallback` jaan boojh kar diya gaya hai: us ke baghair font
 * utarne se pehle safha thoda hilta hai (layout shift). Ye adad Google
 * ke apne metrics se hain.
 */
const sans = localFont({
  src: [
    { path: "./fonts/nunito-sans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/nunito-sans-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/nunito-sans-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const display = localFont({
  src: [
    { path: "./fonts/manrope-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/manrope-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/manrope-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const mono = localFont({
  src: [
    { path: "./fonts/jetbrains-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jetbrains-mono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});
export const metadata: Metadata = {
  title: "Al Rana Traders - AgriBridge",
  description: "Enterprise Agriculture ERP for Al Rana Traders - AgriBridge",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "AgriBridge" },
};
export const viewport: Viewport = {
  themeColor: "#3f7d43",
  width: "device-width",
  initialScale: 1,
};
// Runs before hydration so the page never flashes light-mode before
// switching to a saved dark preference. Kept as a plain inline script
// (not a component) specifically to avoid that flash.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('agribridge-theme');
    var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;
// Registers the service worker for offline/installable support (see
// public/sw.js). Wrapped defensively - service workers require HTTPS
// (or localhost), so this silently no-ops during local HTTP dev if ever
// run that way, rather than throwing.
const SW_REGISTER_SCRIPT = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
`;
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SW_REGISTER_SCRIPT }} />
      </head>
      <body className="bg-surface-50 font-sans text-surface-900 antialiased dark:bg-surface-950 dark:text-surface-100">
        {children}
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}