import { NextRequest, NextResponse } from "next/server";
import { getWeatherByCity, getFarmingSuggestions } from "@/lib/weather";

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city");

  if (!city) {
    return NextResponse.json({ error: "City is required" }, { status: 400 });
  }

  const weather = await getWeatherByCity(city);

  if (!weather) {
    return NextResponse.json({ error: "Weather data not available" }, { status: 404 });
  }

  const suggestions = getFarmingSuggestions(weather);

  return NextResponse.json({ weather, suggestions });
}