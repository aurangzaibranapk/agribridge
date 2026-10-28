import { notFound } from "next/navigation";
import { DeskPreview } from "./desk-preview";

export const dynamic = "force-dynamic";

/** Screenshot aid. Production and a normal dev server both 404. */
export default function CareersDeskPreviewPage() {
  if (process.env.CAREERS_PREVIEW !== "1" || process.env.NODE_ENV === "production") notFound();
  return <DeskPreview />;
}
