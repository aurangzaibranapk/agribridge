import { NextRequest, NextResponse } from "next/server";
import { getForecastByCity, getSowingAdvice } from "@/lib/weather";

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city");

  if (!city) {
    return NextResponse.json({ error: "City is required" }, { status: 400 });
  }

  const forecast = await getForecastByCity(city);

  if (!forecast) {
    return NextResponse.json({ error: "Forecast data not available" }, { status: 404 });
  }

  const advice = getSowingAdvice(forecast);

  return NextResponse.json({ forecast, advice });
}