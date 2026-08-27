"use client";

import { useState, useEffect } from "react";
import { Cloud, CloudRain, CloudSnow, CloudLightning, Sun, CloudDrizzle, Loader2 } from "lucide-react";

const DISTRICTS = [
  "Lahore", "Jhang", "Faisalabad", "Multan", "Rawalpindi", "Gujranwala",
  "Sialkot", "Sargodha", "Bahawalpur", "Sahiwal", "Okara", "Sheikhupura",
  "Kasur", "Vehari", "Dera Ghazi Khan", "Rahim Yar Khan", "Muzaffargarh",
  "Toba Tek Singh", "Chiniot", "Hafizabad",
];

type Weather = {
  city: string;
  temp: number;
  condition: string;
  conditionMain: string;
};

function WeatherIcon({ conditionMain }: { conditionMain: string }) {
  const c = conditionMain.toLowerCase();
  const cls = "h-5 w-5";
  if (c.includes("thunder")) return <CloudLightning className={cls} />;
  if (c.includes("drizzle")) return <CloudDrizzle className={cls} />;
  if (c.includes("rain")) return <CloudRain className={cls} />;
  if (c.includes("snow")) return <CloudSnow className={cls} />;
  if (c.includes("cloud")) return <Cloud className={cls} />;
  return <Sun className={cls} />;
}

export function AdminWeatherStatCard() {
  const [district, setDistrict] = useState("Lahore");
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeather("Lahore");
  }, []);

  async function fetchWeather(city: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
      if (!res.ok) throw new Error("not found");
      const data = await res.json();
      setWeather(data.weather);
    } catch {
      setWeather(null);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const city = e.target.value;
    setDistrict(city);
    fetchWeather(city);
  }

  return (
    <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-sky-400 to-blue-600 p-4 text-white shadow-card">
      <div className="flex items-start justify-between">
        <select
          value={district}
          onChange={handleChange}
          className="rounded-md border border-white/30 bg-white/10 px-1.5 py-0.5 text-[11px] font-medium text-white outline-none backdrop-blur-sm"
        >
          {DISTRICTS.map((d) => (
            <option key={d} value={d} className="text-surface-900">
              {d}
            </option>
          ))}
        </select>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : weather ? <WeatherIcon conditionMain={weather.conditionMain} /> : <Cloud className="h-4 w-4" />}
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight">
        {loading ? "--" : weather ? `${weather.temp}°C` : "N/A"}
      </p>
      <p className="mt-0.5 text-[11px] capitalize text-white/80">
        {loading ? "Loading..." : weather ? weather.condition : "Data available nahi"}
      </p>
    </div>
  );
}
