"use client";

import { useState } from "react";
import { saveChillar } from "@/actions/milk-chillars";

interface Chillar {
  id: string;
  name: string;
  location: string | null;
  in_charge: string | null;
}

export function ChillarsClient({ initialChillars }: { initialChillars: Chillar[] }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [inCharge, setInCharge] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("name", name);
    fd.set("location", location);
    fd.set("in_charge", inCharge);
    const res = await saveChillar({}, fd);
    if (res.error) setMessage(res.error);
    else {
      setMessage(res.message ?? "Saved");
      setName("");
      setLocation("");
      setInCharge("");
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-lg border p-4 space-y-3">
        <h2 className="font-semibold">Add Chillar</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input className="border rounded px-3 py-2" placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="border rounded px-3 py-2" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="In-charge" value={inCharge} onChange={(e) => setInCharge(e.target.value)} />
        </div>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Save</button>
        {message && <p className="text-sm">{message}</p>}
      </form>

      <div className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3">Chillars ({initialChillars.length})</h2>
        {initialChillars.length === 0 ? (
          <p className="text-sm text-gray-500">Abhi koi chillar nahi.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Name</th>
                <th className="text-left">Location</th>
                <th className="text-left">In-charge</th>
              </tr>
            </thead>
            <tbody>
              {initialChillars.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="py-2">{c.name}</td>
                  <td>{c.location ?? "-"}</td>
                  <td>{c.in_charge ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
