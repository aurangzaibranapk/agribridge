import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Password Reset",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
  },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
