import { Wheat, Stethoscope, Wallet, Truck } from "lucide-react";

export const SERVICES = [
  {
    slug: "farm-advisory",
    icon: Wheat,
    title: "Farm Advisory",
    description: "Soil and water test guidance, crop planning support, and field visits from our agronomy team.",
    detail: "Our agronomy team visits your farm to assess soil health, water quality, and crop planning needs. We provide practical, field-tested guidance — not generic advice — tailored to your specific land and crop cycle.",
  },
  {
    slug: "ai-crop-doctor",
    icon: Stethoscope,
    title: "AI Crop Doctor",
    description: "Upload a crop photo and get instant disease detection with a treatment and spray schedule.",
    detail: "Available free to every registered farmer. Upload a photo of an affected crop and receive disease detection, severity assessment, a treatment plan, and a spray schedule — matched against our own product catalog.",
  },
  {
    slug: "khata-accounts",
    icon: Wallet,
    title: "Khata Accounts",
    description: "Buy now, settle later — a running account tailored to how farmers and dealers actually pay.",
    detail: "A running credit account that reflects how farmers and dealers actually manage cash flow across a season — buy what you need now, settle at harvest or on your own schedule, tracked transparently.",
  },
  {
    slug: "reliable-supply",
    icon: Truck,
    title: "Reliable Supply",
    description: "Consistent stock of seed, fertilizer, and crop protection products across the season.",
    detail: "We maintain consistent stock of certified seed, fertilizer, and crop protection products throughout the season, so you're never caught short at a critical planting or spray window.",
  },
];
