import { fetchWithTimeout } from "../fetch-with-timeout";

export const dynamic = "force-dynamic";

type GeocodingResult = {
  name?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  timezone?: string;
};

type GeocodingResponse = {
  results?: GeocodingResult[];
};

type ForecastResponse = {
  timezone?: string;
  utc_offset_seconds?: number;
  daily_units?: { temperature_2m_max?: string };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
};

type SevenTimerResponse = {
  dataseries?: Array<{
    date?: number | string;
    weather?: string;
    temp2m?: { max?: number; min?: number };
  }>;
};

type WeatherDay = {
  day: string;
  temp: string;
  high: string;
  low: string;
  rain: string;
  icon: string;
  desc: string;
};

const SUCCESS_CACHE = "public, max-age=600, s-maxage=900, stale-while-revalidate=1800";

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": status >= 200 && status < 300 ? SUCCESS_CACHE : "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function weatherCondition(code: number): { description: string; icon: string } {
  if (code === 0) return { description: "Clear sky", icon: "☀️" };
  if (code <= 2) return { description: "Partly cloudy", icon: "🌤️" };
  if (code === 3) return { description: "Overcast", icon: "☁️" };
  if (code === 45 || code === 48) return { description: "Fog", icon: "🌫️" };
  if (code >= 51 && code <= 57) return { description: "Drizzle", icon: "🌦️" };
  if (code >= 61 && code <= 67) return { description: "Rain", icon: "🌧️" };
  if (code >= 71 && code <= 77) return { description: "Snow", icon: "🌨️" };
  if (code >= 80 && code <= 82) return { description: "Rain showers", icon: "🌦️" };
  if (code >= 85 && code <= 86) return { description: "Snow showers", icon: "🌨️" };
  if (code >= 95) return { description: "Thunderstorms", icon: "⛈️" };
  return { description: "Mixed conditions", icon: "🌤️" };
}

function sevenTimerCondition(rawCode: string): { description: string; icon: string; precipitation: string } {
  const code = rawCode.toLowerCase();
  if (code.includes("ts")) return { description: "Thunderstorms", icon: "⛈️", precipitation: "Expected" };
  if (code.includes("snow")) return { description: "Snow", icon: "🌨️", precipitation: "Expected" };
  if (code.includes("rain") || code.includes("shower")) {
    return { description: code.includes("shower") ? "Rain showers" : "Rain", icon: "🌧️", precipitation: "Expected" };
  }
  if (code === "cloudy" || code === "mcloudy") return { description: "Cloudy", icon: "☁️", precipitation: "Unlikely" };
  if (code === "pcloudy") return { description: "Partly cloudy", icon: "🌤️", precipitation: "Unlikely" };
  if (code === "clear") return { description: "Clear sky", icon: "☀️", precipitation: "Unlikely" };
  if (code === "humid") return { description: "Humid", icon: "🌫️", precipitation: "Unlikely" };
  if (code === "windy") return { description: "Windy", icon: "💨", precipitation: "Unlikely" };
  return { description: "Mixed conditions", icon: "🌤️", precipitation: "Possible" };
}

function clean(value: string | null): string {
  return (value ?? "").trim().slice(0, 120);
}

function dayLabel(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function displayTemperature(celsius: number, useFahrenheit: boolean): number {
  return Math.round(useFahrenheit ? (celsius * 9) / 5 + 32 : celsius);
}

function openMeteoDays(forecast: ForecastResponse): WeatherDay[] {
  const daily = forecast.daily;
  const dates = daily?.time ?? [];
  const unit = forecast.daily_units?.temperature_2m_max === "°F" ? "°F" : "°C";
  return dates.map((date, index) => {
    const condition = weatherCondition(daily?.weather_code?.[index] ?? -1);
    const high = Math.round(daily?.temperature_2m_max?.[index] ?? 0);
    const low = Math.round(daily?.temperature_2m_min?.[index] ?? 0);
    const rain = Math.round(daily?.precipitation_probability_max?.[index] ?? 0);
    return {
      day: dayLabel(date),
      temp: `${high}${unit}`,
      high: `${high}${unit}`,
      low: `${low}${unit}`,
      rain: `${rain}%`,
      icon: condition.icon,
      desc: condition.description,
    };
  });
}

function sevenTimerDays(forecast: SevenTimerResponse, countryCode: string): WeatherDay[] {
  const useFahrenheit = countryCode === "US";
  const unit = useFahrenheit ? "°F" : "°C";
  return (forecast.dataseries ?? []).slice(0, 5).flatMap((entry) => {
    const rawDate = String(entry.date ?? "").padStart(8, "0");
    const highCelsius = entry.temp2m?.max;
    const lowCelsius = entry.temp2m?.min;
    if (!/^\d{8}$/.test(rawDate) || typeof highCelsius !== "number" || typeof lowCelsius !== "number") return [];
    const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    const high = displayTemperature(highCelsius, useFahrenheit);
    const low = displayTemperature(lowCelsius, useFahrenheit);
    const condition = sevenTimerCondition(entry.weather ?? "");
    return [{
      day: dayLabel(date),
      temp: `${high}${unit}`,
      high: `${high}${unit}`,
      low: `${low}${unit}`,
      rain: condition.precipitation,
      icon: condition.icon,
      desc: condition.description,
    }];
  });
}

async function fetchSevenTimerForecast(latitude: number, longitude: number, countryCode: string): Promise<WeatherDay[]> {
  const forecastUrl = new URL("https://www.7timer.info/bin/api.pl");
  forecastUrl.searchParams.set("lat", latitude.toFixed(3));
  forecastUrl.searchParams.set("lon", longitude.toFixed(3));
  forecastUrl.searchParams.set("product", "civillight");
  forecastUrl.searchParams.set("output", "json");
  const response = await fetchWithTimeout(forecastUrl, { cache: "no-store", headers: { Accept: "application/json" } }, 8_000);
  if (!response.ok) throw new Error(`7Timer returned ${response.status}`);
  const days = sevenTimerDays((await response.json()) as SevenTimerResponse, countryCode);
  if (days.length === 0) throw new Error("7Timer returned no forecast days");
  return days;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const city = clean(url.searchParams.get("city"));
  const region = clean(url.searchParams.get("region"));
  const country = clean(url.searchParams.get("country"));
  const countryCode = clean(url.searchParams.get("countryCode")).toUpperCase();

  if (city.length < 2) return json({ error: "Choose a city to load its weather." }, 400);
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) return json({ error: "The country code is not valid." }, 400);

  const geocodingUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geocodingUrl.searchParams.set("name", region ? `${city}, ${region}` : city);
  geocodingUrl.searchParams.set("count", "10");
  geocodingUrl.searchParams.set("language", "en");
  geocodingUrl.searchParams.set("format", "json");
  if (countryCode) geocodingUrl.searchParams.set("countryCode", countryCode);

  try {
    const geocodingResponse = await fetchWithTimeout(geocodingUrl, { cache: "no-store" }, 8_000);
    if (!geocodingResponse.ok) return json({ error: "The selected city could not be located right now." }, 502);
    const geocoding = (await geocodingResponse.json()) as GeocodingResponse;
    const results = Array.isArray(geocoding.results) ? geocoding.results : [];
    const normalizedRegion = region.toLocaleLowerCase();
    const location = results.find((result) =>
      !normalizedRegion || (result.admin1 ?? "").toLocaleLowerCase() === normalizedRegion,
    ) ?? results[0];

    if (!location || typeof location.latitude !== "number" || typeof location.longitude !== "number") {
      return json({ error: `No weather location was found for ${city}${region ? `, ${region}` : ""}.` }, 404);
    }

    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.searchParams.set("latitude", String(location.latitude));
    forecastUrl.searchParams.set("longitude", String(location.longitude));
    forecastUrl.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
    forecastUrl.searchParams.set("forecast_days", "5");
    forecastUrl.searchParams.set("timezone", "auto");
    forecastUrl.searchParams.set("temperature_unit", countryCode === "US" ? "fahrenheit" : "celsius");

    let days: WeatherDay[] = [];
    let timeZone = location.timezone || "";
    let utcOffsetSeconds: number | null = null;
    let source = "Open-Meteo";
    try {
      const forecastResponse = await fetchWithTimeout(forecastUrl, { cache: "no-store" }, 8_000);
      if (!forecastResponse.ok) throw new Error(`Open-Meteo returned ${forecastResponse.status}`);
      const forecast = (await forecastResponse.json()) as ForecastResponse;
      days = openMeteoDays(forecast);
      timeZone = forecast.timezone || timeZone;
      utcOffsetSeconds = typeof forecast.utc_offset_seconds === "number" ? forecast.utc_offset_seconds : null;
      if (days.length === 0) throw new Error("Open-Meteo returned no forecast days");
    } catch (error) {
      console.warn("Open-Meteo forecast unavailable; using 7Timer fallback.", error);
      days = await fetchSevenTimerForecast(location.latitude, location.longitude, location.country_code || countryCode);
      source = "7Timer";
    }

    return json({
      destination: location.name || city,
      region: location.admin1 || region,
      country: location.country || country,
      countryCode: location.country_code || countryCode,
      latitude: location.latitude,
      longitude: location.longitude,
      timeZone,
      utcOffsetSeconds,
      days,
      source,
    });
  } catch (error) {
    console.error("Live weather request failed.", error);
    return json({ error: "Live weather could not be reached. Try again shortly." }, 502);
  }
}
