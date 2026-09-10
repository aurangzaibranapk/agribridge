import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kisan AI Crop Doctor",
  description: "Use AgriBridge Kisan AI Crop Doctor to upload a crop or leaf photo and receive AI-assisted crop guidance and diagnosis support.",
  alternates: { canonical: "/ai-crop-doctor" },
};

export default function AiCropDoctorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
