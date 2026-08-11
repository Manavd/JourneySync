export const dynamic = "force-dynamic";

type GeocodingResult = {
  name?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  country_code?: string;
  admin1?: string;
};

type GeocodingResponse = {
  results?: GeocodingResult[];
};

type ForecastResponse = {
  daily_units?: { temperature_2m_max?: string };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
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

function clean(value: string | null): string {
  return (value ?? "").trim().slice(0, 120);
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
    const geocodingResponse = await fetch(geocodingUrl, { cache: "no-store" });
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

    const forecastResponse = await fetch(forecastUrl, { cache: "no-store" });
    if (!forecastResponse.ok) return json({ error: "The live forecast could not be loaded right now." }, 502);
    const forecast = (await forecastResponse.json()) as ForecastResponse;
    const daily = forecast.daily;
    const dates = daily?.time ?? [];
    const unit = forecast.daily_units?.temperature_2m_max === "°F" ? "°F" : "°C";
    const days = dates.map((date, index) => {
      const condition = weatherCondition(daily?.weather_code?.[index] ?? -1);
      const high = Math.round(daily?.temperature_2m_max?.[index] ?? 0);
      const low = Math.round(daily?.temperature_2m_min?.[index] ?? 0);
      const rain = Math.round(daily?.precipitation_probability_max?.[index] ?? 0);
      return {
        day: new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)),
        temp: `${high}${unit}`,
        high: `${high}${unit}`,
        low: `${low}${unit}`,
        rain: `${rain}%`,
        icon: condition.icon,
        desc: condition.description,
      };
    });

    return json({
      destination: location.name || city,
      region: location.admin1 || region,
      country: location.country || country,
      countryCode: location.country_code || countryCode,
      latitude: location.latitude,
      longitude: location.longitude,
      days,
      source: "Open-Meteo",
    });
  } catch {
    return json({ error: "Live weather could not be reached. Try again shortly." }, 502);
  }
}
