import { MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/dairy-public/offer";

export function WhatsAppButton({ text, label = "WhatsApp par order karein", className = "" }: { text?: string; label?: string; className?: string }) {
  return (
    <a
      href={whatsappLink(text)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-xl bg-[#1f8f4e] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#18733f] ${className}`}
    >
      <MessageCircle className="h-5 w-5" aria-hidden />
      {label}
    </a>
  );
}
