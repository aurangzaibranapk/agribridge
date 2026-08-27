"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, RefreshCw } from "lucide-react";

interface LiveBoardCard {
  id: string;
  booking_number: string;
  farmer_name: string;
  vendor_name: string;
  machine_label: string;
  quantity_label: string;
  total_amount: number;
  status: string;
  booking_date: string;
  created_at: string;
}

const CONFIRMED_STATUSES = ["confirmed", "in_progress", "completed"];

export function LiveBoard() {
  const [cards, setCards] = useState<LiveBoardCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function fetchCards() {
    try {
      const res = await fetch("/api/machinery/live-board", { cache: "no-store" });
      const data = await res.json();
      setCards(data.cards ?? []);
      setLastUpdated(new Date());
    } catch {
      // silent fail - next 30s tick will retry
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCards();
    const interval = setInterval(fetchCards, 30000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
  const todayCount = cards.filter((c) => new Date(c.created_at).toDateString() === today).length;
  const yesterdayCount = cards.filter((c) => new Date(c.created_at).toDateString() === yesterday).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-4 text-sm">
          <span className="text-surface-600">
            <strong className="text-surface-900">{todayCount}</strong> Aaj
          </span>
          <span className="text-surface-600">
            <strong className="text-surface-900">{yesterdayCount}</strong> Kal
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-surface-400">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          {lastUpdated ? `Update: ${lastUpdated.toLocaleTimeString()}` : "Loading..."}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const isConfirmed = CONFIRMED_STATUSES.includes(card.status);
          return (
            <div
              key={card.id}
              className={`rounded-card border-2 bg-white p-4 shadow-card transition-colors ${
                isConfirmed ? "border-green-300" : "border-amber-300"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs text-surface-400">{card.booking_number}</span>
                {isConfirmed ? (
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Confirmed
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    <Clock className="h-3.5 w-3.5" /> Pending
                  </span>
                )}
              </div>
              <p className="font-display text-sm font-semibold text-surface-900">{card.farmer_name}</p>
              <p className="mt-0.5 text-xs text-surface-500">{card.vendor_name} - {card.machine_label}</p>
              <p className="text-xs text-surface-400">{card.quantity_label}</p>
              <div className="mt-2 flex items-center justify-between border-t border-surface-100 pt-2">
                <span className="text-xs text-surface-400">{new Date(card.booking_date).toLocaleDateString()}</span>
                <span className="text-sm font-semibold text-surface-800">Rs {card.total_amount.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
        {cards.length === 0 && !loading && (
          <p className="col-span-full py-8 text-center text-sm text-surface-400">Pichle 7 din mein koi booking nahi hai.</p>
        )}
      </div>
    </div>
  );
}