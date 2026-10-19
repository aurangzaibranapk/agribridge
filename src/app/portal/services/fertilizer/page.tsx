import { redirect } from "next/navigation";

// Khaad / beej / spray ka alag udhaar form band (owner, 19 Oct 2026):
// udhaar ab sirf season plans se -- Gandum plan abhi, Munji plan baad mein.
// Purane links / bookmarks season booking par jate hain. Admin approval screens aur DB tables wese hi hain.
export default function FertilizerCreditRemoved() {
  redirect("/portal/campaigns");
}
