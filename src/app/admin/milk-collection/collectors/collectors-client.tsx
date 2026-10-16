"use client";

import { useState } from "react";

export function CollectorsClient() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [chillar, setChillar] = useState("");

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-4">Add Collector (Ladka)</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Assigned Chillar"
            value={chillar}
            onChange={(e) => setChillar(e.target.value)}
          />
        </div>
        <button className="mt-3 bg-green-600 text-white px-4 py-2 rounded">
          Save Collector
        </button>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">Collectors List</h2>
        <p className="text-sm text-gray-500">Abhi koi collector nahi. Add karo.</p>
      </div>
    </div>
  );
}
