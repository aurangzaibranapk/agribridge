import { notFound } from "next/navigation";

export const metadata = {
  title: "Call Center preview",
  robots: { index: false, follow: false, nocache: true },
};

/** Example screenshots. Production par band, jab tak CALL_CENTER_PREVIEW=1 na ho. */
export default function CallCenterPreviewLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.CALL_CENTER_PREVIEW !== "1") {
    notFound();
  }
  return children;
}
