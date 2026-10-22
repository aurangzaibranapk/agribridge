import { ImageResponse } from "next/og";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

export const runtime = "edge";
export const alt = `${BRAND_NAME} — ${BRAND_TAGLINE.en}`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #0B5D3B 0%, #0E7A4B 48%, #F4E8B8 100%)",
          color: "white",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -80,
            top: -90,
            width: 420,
            height: 420,
            borderRadius: 999,
            background: "rgba(255,255,255,0.12)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 70,
            bottom: 55,
            width: 250,
            height: 250,
            borderRadius: 999,
            border: "2px solid rgba(255,255,255,0.28)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.08)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "72px 76px",
            width: "78%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginBottom: 26,
            }}
          >
            <div
              style={{
                width: 74,
                height: 74,
                borderRadius: 18,
                background: "rgba(255,255,255,0.96)",
                color: "#0B5D3B",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 900,
              }}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 42, fontWeight: 800 }}>{BRAND_NAME}</div>
              <div style={{ fontSize: 24, opacity: 0.9, fontWeight: 700 }}>{BRAND_TAGLINE.en}</div>
            </div>
          </div>

          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              color: "#EAF8EE",
              marginBottom: 12,
            }}
          >
            Pakistan&apos;s Digital Agriculture Platform
          </div>

          <div
            style={{
              fontSize: 64,
              lineHeight: 1.02,
              fontWeight: 900,
              letterSpacing: -2.5,
              maxWidth: 790,
            }}
          >
            Empowering Farmers for a Greener Tomorrow
          </div>

          <div
            style={{
              marginTop: 24,
              fontSize: 25,
              lineHeight: 1.4,
              maxWidth: 780,
              color: "#F4FFF7",
            }}
          >
            Farmers • Inputs • Machinery • Dairy • Grain • Marketplace • Kisan AI
          </div>
        </div>
      </div>
    ),
    size
  );
}
