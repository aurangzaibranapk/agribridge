"use client";

import { useState, useEffect } from "react";
import { Cloud, CloudRain, CloudSnow, CloudLightning, Sun, CloudDrizzle, Droplets, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const DISTRICTS = [
  "Lahore", "Jhang", "Faisalabad", "Multan", "Rawalpindi", "Gujranwala",
  "Sialkot", "Sargodha", "Bahawalpur", "Sahiwal", "Okara", "Sheikhupura",
  "Kasur", "Vehari", "Dera Ghazi Khan", "Rahim Yar Khan", "Muzaffargarh",
  "Toba Tek Singh", "Chiniot", "Hafizabad",
];

type ForecastDay = {
  date: string;
  dayLabel: string;
  minTemp: number;
  maxTemp: number;
  condition: string;
  conditionMain: string;
  rainChance: number;
  humidity: number;
  windSpeed: number;
};

type SowingAdvice = {
  date: string;
  dayLabel: string;
  suitable: boolean;
  reason: string;
};

function WeatherIcon({ conditionMain, className }: { conditionMain: string; className?: string }) {
  const c = conditionMain.toLowerCase();
  const cls = className ?? "h-6 w-6";
  if (c.includes("thunder")) return <CloudLightning className={cls} />;
  if (c.includes("drizzle")) return <CloudDrizzle className={cls} />;
  if (c.includes("rain")) return <CloudRain className={cls} />;
  if (c.includes("snow")) return <CloudSnow className={cls} />;
  if (c.includes("cloud")) return <Cloud className={cls} />;
  return <Sun className={cls} />;
}

export function ForecastWidget({
  fixedDistrict,
  title = "5-Din Ka Mausam",
}: {
  fixedDistrict?: string | null;
  title?: string;
}) {
  const [district, setDistrict] = useState(fixedDistrict || "Lahore");
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [advice, setAdvice] = useState<SowingAdvice[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchForecast(district);
  }, []);

  async function fetchForecast(city: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/forecast?city=${encodeURIComponent(city)}`);
      if (!res.ok) throw new Error("not found");
      const data = await res.json();
      setForecast(data.forecast);
      setAdvice(data.advice);
      setSelectedIdx(0);
    } catch {
      setForecast([]);
      setAdvice([]);
      setError("Forecast abhi available nahi hai.");
    } finally {
      setLoading(false);
    }
  }

  function handleDistrictChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const city = e.target.value;
    setDistrict(city);
    fetchForecast(city);
  }

  const selectedDay = forecast[selectedIdx];
  const selectedAdvice = advice[selectedIdx];

  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:bg-surface-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">{title}</h2>
        {!fixedDistrict && (
          <select
            value={district}
            onChange={handleDistrictChange}
            className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm text-surface-700 outline-none focus:border-brand-400"
          >
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-surface-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {!loading && error && <p className="text-sm text-surface-500">{error}</p>}

      {!loading && forecast.length > 0 && (
        <>
          {/* Day selector row */}
          <div className="grid grid-cols-5 gap-2">
            {forecast.map((day, idx) => (
              <button
                key={day.date}
                onClick={() => setSelectedIdx(idx)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 transition ${
                  idx === selectedIdx
                    ? "border-brand-400 bg-brand-50 shadow-sm dark:bg-brand-950"
                    : "border-surface-200 bg-white hover:border-surface-300 dark:bg-surface-900"
                }`}
              >
                <span className="text-[10px] font-medium text-surface-500">{day.dayLabel.split(",")[0]}</span>
                <WeatherIcon conditionMain={day.conditionMain} className="h-5 w-5 text-blue-600" />
                <span className="text-xs font-semibold text-surface-900 dark:text-surface-100">
                  {day.maxTemp}°/{day.minTemp}°
                </span>
                {day.rainChance > 30 && (
                  <span className="flex items-center gap-0.5 text-[10px] text-blue-500">
                    <Droplets className="h-2.5 w-2.5" /> {day.rainChance}%
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Selected day detail */}
          {selectedDay && (
            <div className="mt-4 rounded-xl bg-surface-50 p-4 dark:bg-surface-800">
              <p className="text-sm font-medium text-surface-900 dark:text-surface-100">{selectedDay.dayLabel}</p>
              <p className="mt-0.5 text-xs capitalize text-surface-500">{selectedDay.condition}</p>
              <div className="mt-2 flex gap-4 text-xs text-surface-600 dark:text-surface-400">
                <span>Max: {selectedDay.maxTemp}°C</span>
                <span>Min: {selectedDay.minTemp}°C</span>
                <span className="flex items-center gap-1">
                  <Droplets className="h-3 w-3" /> {selectedDay.rainChance}% barish
                </span>
              </div>

              {selectedAdvice && (
                <div
                  className={`mt-3 flex items-start gap-2 rounded-lg p-2.5 text-xs ${
                    selectedAdvice.suitable
                      ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
                      : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  {selectedAdvice.suitable ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>{selectedAdvice.reason}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}