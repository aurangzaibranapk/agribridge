import { FarmerWhatsappSignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

/** Kisan ka khud signup: naam, CNIC, mobile, gaon + WhatsApp OTP. */
export default function FarmerWhatsappSignupPage() {
  return <FarmerWhatsappSignupForm />;
}
