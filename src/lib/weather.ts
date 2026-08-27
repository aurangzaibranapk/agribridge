export type WeatherData = {
  city: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  conditionMain: string;
  icon: string;
  rainChance: number;
};

export type FarmingSuggestion = {
  type: "warning" | "info" | "success";
  message: string;
};

const API_KEY = process.env.OPENWEATHER_API_KEY;

export async function getWeatherByCity(city: string): Promise<WeatherData | null> {
  if (!API_KEY) {
    console.error("OPENWEATHER_API_KEY not set in .env.local");
    return null;
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      city
    )},PK&appid=${API_KEY}&units=metric`;

    const res = await fetch(url, { next: { revalidate: 1800 } });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Weather API error:", res.status, errText);
      return null;
    }

    const data = await res.json();

    return {
      city: data.name,
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      windSpeed: data.wind.speed,
      condition: data.weather[0].description,
      conditionMain: data.weather[0].main,
      icon: data.weather[0].icon,
      rainChance: data.rain ? Math.min(100, Math.round((data.rain["1h"] ?? 0) * 20)) : 0,
    };
  } catch (err) {
    console.error("Weather fetch failed:", err);
    return null;
  }
}

export function getFarmingSuggestions(weather: WeatherData): FarmingSuggestion[] {
  const suggestions: FarmingSuggestion[] = [];
  const condition = weather.conditionMain.toLowerCase();

  if (condition.includes("rain") || condition.includes("drizzle") || condition.includes("thunderstorm")) {
    suggestions.push({
      type: "warning",
      message: "Barish ka imkaan hai - irrigation aaj skip karein.",
    });
    suggestions.push({
      type: "warning",
      message: "Spray ya fertilizer application delay karein jab tak mausam saaf na ho.",
    });
  }

  if (weather.windSpeed > 8) {
    suggestions.push({
      type: "warning",
      message: "Hawa tez hai - spray karna abhi delay karein (drift ka khatra hai).",
    });
  }

  if (weather.temp > 38) {
    suggestions.push({
      type: "warning",
      message: "Shadeed garmi hai - fasal ko extra pani dein, khaas kar shaam ke waqt.",
    });
  }

  if (weather.temp < 5) {
    suggestions.push({
      type: "warning",
      message: "Sardi zyada hai - hassas fasalon ko thand se bachao ka intizam karein.",
    });
  }

  if (weather.humidity > 80) {
    suggestions.push({
      type: "info",
      message: "Namee zyada hai - fungal diseases ka khatra barh sakta hai, fasal ka mauyana karein.",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      type: "success",
      message: "Mausam normal hai - routine kaam (irrigation, spray) bila rukawat kar sakte hain.",
    });
  }

  return suggestions;
}
export type ForecastDay = {
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

export type SowingAdvice = {
  date: string;
  dayLabel: string;
  suitable: boolean;
  reason: string;
};

export async function getForecastByCity(city: string): Promise<ForecastDay[] | null> {
  if (!API_KEY) {
    console.error("OPENWEATHER_API_KEY not set in .env.local");
    return null;
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
      city
    )},PK&appid=${API_KEY}&units=metric`;

    const res = await fetch(url, { next: { revalidate: 1800 } });

    if (!res.ok) {
      console.error("Forecast API error:", res.status);
      return null;
    }

    const data = await res.json();

    const dayMap = new Map<string, any[]>();
    for (const item of data.list) {
      const dateKey = item.dt_txt.split(" ")[0];
      if (!dayMap.has(dateKey)) dayMap.set(dateKey, []);
      dayMap.get(dateKey)!.push(item);
    }

    const days: ForecastDay[] = [];
    let count = 0;
    for (const [dateKey, items] of dayMap) {
      if (count >= 5) break;
      const temps = items.map((i) => i.main.temp);
      const minTemp = Math.round(Math.min(...temps));
      const maxTemp = Math.round(Math.max(...temps));

      const middayItem =
        items.find((i) => i.dt_txt.includes("12:00:00")) ?? items[Math.floor(items.length / 2)];

      const totalRain = items.reduce((sum, i) => sum + (i.rain?.["3h"] ?? 0), 0);
      const rainChance = Math.min(100, Math.round(totalRain * 15));

      const avgHumidity = Math.round(
        items.reduce((sum, i) => sum + i.main.humidity, 0) / items.length
      );
      const avgWind = Number(
        (items.reduce((sum, i) => sum + i.wind.speed, 0) / items.length).toFixed(1)
      );

      const dateObj = new Date(dateKey);
      const dayLabel = dateObj.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });

      days.push({
        date: dateKey,
        dayLabel,
        minTemp,
        maxTemp,
        condition: middayItem.weather[0].description,
        conditionMain: middayItem.weather[0].main,
        rainChance,
        humidity: avgHumidity,
        windSpeed: avgWind,
      });

      count++;
    }

    return days;
  } catch (err) {
    console.error("Forecast fetch failed:", err);
    return null;
  }
}

export function getSowingAdvice(forecast: ForecastDay[]): SowingAdvice[] {
  return forecast.map((day) => {
    const condition = day.conditionMain.toLowerCase();
    const heavyRain = condition.includes("rain") || condition.includes("thunderstorm");
    const highWind = day.windSpeed > 8;
    const extremeHeat = day.maxTemp > 40;
    const extremeCold = day.minTemp < 3;

    if (heavyRain) {
      return { date: day.date, dayLabel: day.dayLabel, suitable: false, reason: "Barish ka imkaan - kasht/spray delay karein." };
    }
    if (highWind) {
      return { date: day.date, dayLabel: day.dayLabel, suitable: false, reason: "Tez hawa - spray ke liye theek nahi." };
    }
    if (extremeHeat) {
      return { date: day.date, dayLabel: day.dayLabel, suitable: false, reason: "Shadeed garmi - subah/shaam ka waqt behtar hoga." };
    }
    if (extremeCold) {
      return { date: day.date, dayLabel: day.dayLabel, suitable: false, reason: "Sardi zyada - hassas fasal se bachein." };
    }
    if (day.rainChance > 60) {
      return { date: day.date, dayLabel: day.dayLabel, suitable: false, reason: "Barish ke chances zyada hain." };
    }

    return { date: day.date, dayLabel: day.dayLabel, suitable: true, reason: "Mausam kasht/spray ke liye munasib hai." };
  });
}