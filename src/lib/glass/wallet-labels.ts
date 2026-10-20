import type { GLang } from "./glass";
export const GW = {
  title: { en: "My Wallet", rm: "Mera Wallet", ur: "میرا والیٹ" },
  quick: { en: "Quick actions", rm: "Jaldi kaam", ur: "فوری کام" },
  deposit: { en: "Add money", rm: "Paisa jama", ur: "پیسہ جمع" },
  withdraw: { en: "Withdraw", rm: "Nikalwayein", ur: "نکلوائیں" },
  qr: { en: "Show QR", rm: "QR dikhayein", ur: "QR دکھائیں" },
  statement: { en: "Statement", rm: "Statement", ur: "اسٹیٹمنٹ" },
  recent: { en: "Recent transactions", rm: "Haal ka len-den", ur: "حالیہ لین دین" },
  adminTitle: { en: "Farmer wallet card", rm: "Kisan wallet card", ur: "کسان والیٹ کارڈ" },
  walletBal: { en: "Wallet balance", rm: "Wallet baqaya", ur: "والیٹ بیلنس" },
} as const;
export const gw = (k: keyof typeof GW, l: GLang) => GW[k][l];
