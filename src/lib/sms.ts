// SMS notification hook - not connected to a real gateway yet. Jab
// bhi koi SMS service (Twilio, TextLocal, ya Pakistan ka koi local
// gateway) buy ho, isi function ke andar us API ka call daal dena hai
// - baaki poora app already `sendMilkSms()` isi jagah se bula raha
// hai, kahin aur badalne ki zaroorat nahi hogi.

interface SmsResult {
  sent: boolean;
  reason?: string;
}

export async function sendMilkSms(toPhone: string, message: string): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER;

  if (!provider) {
    // No gateway configured yet - log it so we can see what WOULD have
    // been sent, without breaking anything.
    console.log(`[SMS placeholder] To: ${toPhone} | Message: ${message}`);
    return { sent: false, reason: "SMS provider not configured yet." };
  }

  // TODO: jab service buy ho, yahan asal API call daalein. Example
  // (Twilio jaisi kisi service ke liye):
  //
  // const response = await fetch("https://api.smsservice.pk/send", {
  //   method: "POST",
  //   headers: { Authorization: `Bearer ${process.env.SMS_API_KEY}` },
  //   body: JSON.stringify({ to: toPhone, message }),
  // });
  // return { sent: response.ok };

  return { sent: false, reason: "SMS provider configured but not implemented yet." };
}

export function buildMilkReceiptMessage(farmerName: string, quantity: number, fat: number | null, rate: number, totalAmount: number): string {
  return `Assalam-o-Alaikum ${farmerName}, aaj aap ka doodh: ${quantity}L${fat ? `, Fat: ${fat}%` : ""}, Rate: Rs${rate}/L, Total: Rs${totalAmount.toLocaleString()}. - Al Rana Traders`;
}