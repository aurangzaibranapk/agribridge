import { Cloud, CloudRain, CloudSnow, CloudLightning, Sun, CloudDrizzle } from "lucide-react";
import { getWeatherByCity } from "@/lib/weather";

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

export async function WeatherStatCard({ district }: { district: string | null | undefined }) {
  const weather = district ? await getWeatherByCity(district) : null;

  return (
    <div className="relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 p-5 text-white shadow-lg transition duration-200 hover:-translate-y-0.5 hover:shadow-xl">
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
          {weather ? weather.city : "Mausam"}
        </span>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
          {weather ? <WeatherIcon conditionMain={weather.conditionMain} /> : <Cloud className="h-5 w-5" />}
        </div>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight">
        {weather ? `${weather.temp}°C` : "--"}
      </p>
      <p className="mt-1 text-xs capitalize text-white/80">
        {weather ? weather.condition : "Data available nahi"}
      </p>
      <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
    </div>
  );
}