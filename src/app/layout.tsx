import type { Metadata, Viewport } from "next";
import { Nunito_Sans, Manrope, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
const sans = Nunito_Sans({ subsets: ["latin"], variable: "--font-sans" });
const display = Manrope({ subsets: ["latin"], variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
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