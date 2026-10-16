"use client";

import { useState } from "react";
import { saveControlEntry } from "@/actions/milk-control-entry";

interface Option {
  id: string;
  name: string;
}

export function ControlEntryForm({
  farmers,
  collectors,
  chillars,
}: {
  farmers: Option[];
  collectors: Option[];
  chillars: Option[];
}) {
  const [farmerId, setFarmerId] = useState("");
  const [collectorId, setCollectorId] = useState("");
  const [chillarId, setChillarId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [fat, setFat] = useState("");
  const [rate, setRate] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const amount = quantity && rate ? (Number(quantity) * Number(rate)).toFixed(2) : "0";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const fd = new FormData();
    fd.set("farmer_id", farmerId);
    fd.set("collector_id", collectorId);
    fd.set("chillar_id", chillarId);
    fd.set("quantity", quantity);
    fd.set("fat", fat);
    fd.set("rate", rate);
    const res = await saveControlEntry({}, fd);
    setBusy(false);
    if (res.error) setMessage(res.error);
    else {
      setMessage(res.message ?? "Saved");
      setQuantity("");
      setFat("");
      setRate("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <div>
        <label className="block text-sm mb-1">Farmer</label>
        <select className="w-full border rounded px-3 py-2" value={farmerId} onChange={(e) => setFarmerId(e.target.value)} required>
          <option value="">Select farmer</option>
          {farmers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Collector</label>
          <select className="w-full border rounded px-3 py-2" value={collectorId} onChange={(e) => setCollectorId(e.target.value)}>
            <option value="">Select collector</option>
            {collectors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Chillar</label>
          <select className="w-full border rounded px-3 py-2" value={chillarId} onChange={(e) => setChillarId(e.target.value)}>
            <option value="">Select chillar</option>
            {chillars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm mb-1">Quantity (L)</label>
          <input type="number" step="0.01" className="w-full border rounded px-3 py-2" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">FAT %</label>
          <input type="number" step="0.01" className="w-full border rounded px-3 py-2" value={fat} onChange={(e) => setFat(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Rate</label>
          <input type="number" step="0.01" className="w-full border rounded px-3 py-2" value={rate} onChange={(e) => setRate(e.target.value)} required />
        </div>
      </div>
      <div className="text-lg font-semibold">Amount: Rs {amount}</div>
      <button type="submit" disabled={busy} className="bg-green-600 text-white px-6 py-2 rounded disabled:opacity-50">
        {busy ? "Saving..." : "Save Entry"}
      </button>
      {message && <p className="text-sm">{message}</p>}
    </form>
  );
}
