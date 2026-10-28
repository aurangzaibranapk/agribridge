import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { ChatbotWidget } from "@/components/site/chatbot-widget";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://alranatraders.pk/#organization",
      name: BRAND_NAME,
      alternateName: BRAND_TAGLINE,
      url: "https://alranatraders.pk",
      description:
        `${BRAND_NAME} — ${BRAND_TAGLINE}. A digital agriculture platform connecting farmers with agriculture inputs, machinery, dairy, grain markets, farm products and digital guidance in Pakistan.`,
      areaServed: {
        "@type": "Country",
        name: "Pakistan",
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://alranatraders.pk/#website",
      url: "https://alranatraders.pk",
      name: BRAND_NAME,
      alternateName: BRAND_TAGLINE,
      publisher: {
        "@id": "https://alranatraders.pk/#organization",
      },
      inLanguage: ["en", "ur"],
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://alranatraders.pk/products?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const lang = getLanguageFromCookies("en");
  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <ChatbotWidget lang={lang} />
    </div>
  );
}
