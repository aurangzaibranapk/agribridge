import Link from "next/link";

export const dynamic = "force-dynamic";

export default function MilkControlCenterPage() {
  const cards = [
    { title: "Collectors (Ladke)", href: "/admin/milk-collection/collectors", desc: "Add and manage collectors" },
    { title: "Chillars", href: "/admin/milk-collection/chillars", desc: "Multiple chillar points" },
    { title: "Daily Entry", href: "/admin/milk-collection/collect", desc: "Record milk collection" },
    { title: "Farmer Ledger", href: "/admin/milk-collection", desc: "Balances and history" },
    { title: "Chiller Control", href: "/admin/milk-collection/chiller", desc: "FAT and receiving" },
    { title: "Dispatch", href: "/admin/milk-collection/dispatch", desc: "Send to company" },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Milk Control Center</h1>
      <p className="text-gray-600 mb-6">Zero leakage – har liter aur rupaya track hoga.</p>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="rounded-lg border p-4 hover:bg-gray-50">
            <h2 className="font-semibold">{c.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
