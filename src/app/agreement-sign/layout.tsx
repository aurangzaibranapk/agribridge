import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agreement Signing",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
  },
};

export default function AgreementSignLayout({ children }: { children: React.ReactNode }) {
  return children;
}
