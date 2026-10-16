"use client";

import { useState } from "react";
import { saveCollector } from "@/actions/milk-collectors";

interface Collector {
  id: string;
  name: string;
  phone: string | null;
  assigned_chillar: string | null;
  route: string | null;
}

export function CollectorsClient({ initialCollectors }: { initialCollectors: Collector[] }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [chillar, setChillar] = useState("");
  const [route, setRoute] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("name", name);
    fd.set("phone", phone);
    fd.set("assigned_chillar", chillar);
    fd.set("route", route);
    const res = await saveCollector({}, fd);
    if (res.error) setMessage(res.error);
    else {
      setMessage(res.message ?? "Saved");
      setName("");
      setPhone("");
      setChillar("");
      setRoute("");
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-lg border p-4 space-y-3">
        <h2 className="font-semibold">Add Collector</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <input className="border rounded px-3 py-2" placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="border rounded px-3 py-2" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Assigned Chillar" value={chillar} onChange={(e) => setChillar(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Route" value={route} onChange={(e) => setRoute(e.target.value)} />
        </div>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Save</button>
        {message && <p className="text-sm">{message}</p>}
      </form>

      <div className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3">Collectors ({initialCollectors.length})</h2>
        {initialCollectors.length === 0 ? (
          <p className="text-sm text-gray-500">Abhi koi collector nahi.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Name</th>
                <th className="text-left">Phone</th>
                <th className="text-left">Chillar</th>
                <th className="text-left">Route</th>
              </tr>
            </thead>
            <tbody>
              {initialCollectors.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="py-2">{c.name}</td>
                  <td>{c.phone ?? "-"}</td>
                  <td>{c.assigned_chillar ?? "-"}</td>
                  <td>{c.route ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
