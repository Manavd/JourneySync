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
  daily_units?: { temperature_2m_max?: string };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
};

type MetPeriod = {
  summary?: { symbol_code?: string };
  details?: { precipitation_amount?: number };
};

type MetForecastResponse = {
  properties?: {
    timeseries?: Array<{
      time?: string;
      data?: {
        instant?: { details?: { air_temperature?: number } };
        next_1_hours?: MetPeriod;
        next_6_hours?: MetPeriod;
      };
    }>;
  };
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

const MET_NORWAY_USER_AGENT = "JourneySync/1.0 https://journeysync-travel.manavdesai53.chatgpt.site";

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

function metCondition(rawCode: string): { description: string; icon: string } {
  const code = rawCode.replace(/_(day|night|polartwilight)$/i, "").toLowerCase();
  if (code.includes("thunder")) return { description: "Thunderstorms", icon: "⛈️" };
  if (code.includes("snow")) return { description: code.includes("showers") ? "Snow showers" : "Snow", icon: "🌨️" };
  if (code.includes("sleet")) return { description: "Sleet", icon: "🌨️" };
  if (code.includes("rain") || code.includes("drizzle")) {
    return { description: code.includes("showers") ? "Rain showers" : "Rain", icon: "🌧️" };
  }
  if (code.includes("fog")) return { description: "Fog", icon: "🌫️" };
  if (code.includes("partlycloudy")) return { description: "Partly cloudy", icon: "🌤️" };
  if (code.includes("cloudy")) return { description: "Cloudy", icon: "☁️" };
  if (code.includes("fair")) return { description: "Mostly clear", icon: "🌤️" };
  if (code.includes("clearsky")) return { description: "Clear sky", icon: "☀️" };
  return { description: "Mixed conditions", icon: "🌤️" };
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

function localDateAndHour(isoTime: string, timeZone: string): { date: string; hour: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(isoTime));
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
    return { date: `${value("year")}-${value("month")}-${value("day")}`, hour: Number(value("hour")) };
  } catch {
    const date = new Date(isoTime);
    return { date: date.toISOString().slice(0, 10), hour: date.getUTCHours() };
  }
}

function displayTemperature(celsius: number, useFahrenheit: boolean): number {
  return Math.round(useFahrenheit ? (celsius * 9) / 5 + 32 : celsius);
}

function rainAmountLabel(amount: number): string {
  if (amount < 0.05) return "0 mm";
  if (amount < 10) return `${amount.toFixed(1)} mm`;
  return `${Math.round(amount)} mm`;
}

function metNorwayDays(forecast: MetForecastResponse, countryCode: string, timeZone: string): WeatherDay[] {
  const buckets = new Map<string, {
    temperatures: number[];
    rainAmount: number;
    symbol: string;
    symbolDistance: number;
  }>();

  for (const entry of forecast.properties?.timeseries ?? []) {
    if (!entry.time) continue;
    const temperature = entry.data?.instant?.details?.air_temperature;
    if (typeof temperature !== "number") continue;
    const local = localDateAndHour(entry.time, timeZone);
    const bucket = buckets.get(local.date) ?? {
      temperatures: [],
      rainAmount: 0,
      symbol: "",
      symbolDistance: Number.POSITIVE_INFINITY,
    };
    bucket.temperatures.push(temperature);

    const period = entry.data?.next_1_hours ?? entry.data?.next_6_hours;
    const precipitation = period?.details?.precipitation_amount;
    if (typeof precipitation === "number" && precipitation > 0) bucket.rainAmount += precipitation;
    const symbol = period?.summary?.symbol_code ?? "";
    const symbolDistance = Math.abs(local.hour - 12);
    if (symbol && symbolDistance < bucket.symbolDistance) {
      bucket.symbol = symbol;
      bucket.symbolDistance = symbolDistance;
    }
    buckets.set(local.date, bucket);
  }

  const useFahrenheit = countryCode === "US";
  const unit = useFahrenheit ? "°F" : "°C";
  return [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(0, 5).map(([date, bucket]) => {
    const high = displayTemperature(Math.max(...bucket.temperatures), useFahrenheit);
    const low = displayTemperature(Math.min(...bucket.temperatures), useFahrenheit);
    const condition = metCondition(bucket.symbol);
    return {
      day: dayLabel(date),
      temp: `${high}${unit}`,
      high: `${high}${unit}`,
      low: `${low}${unit}`,
      rain: rainAmountLabel(bucket.rainAmount),
      icon: condition.icon,
      desc: condition.description,
    };
  });
}

async function fetchMetNorwayForecast(
  latitude: number,
  longitude: number,
  countryCode: string,
  timeZone: string,
): Promise<WeatherDay[]> {
  const forecastUrl = new URL("https://api.met.no/weatherapi/locationforecast/2.0/compact");
  forecastUrl.searchParams.set("lat", latitude.toFixed(4));
  forecastUrl.searchParams.set("lon", longitude.toFixed(4));
  const response = await fetch(forecastUrl, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": MET_NORWAY_USER_AGENT,
    },
  });
  if (!response.ok) throw new Error(`MET Norway returned ${response.status}`);
  const days = metNorwayDays((await response.json()) as MetForecastResponse, countryCode, timeZone);
  if (days.length === 0) throw new Error("MET Norway returned no forecast days");
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

    let days: WeatherDay[] = [];
    let source = "Open-Meteo";
    try {
      const forecastResponse = await fetch(forecastUrl, { cache: "no-store" });
      if (!forecastResponse.ok) throw new Error(`Open-Meteo returned ${forecastResponse.status}`);
      days = openMeteoDays((await forecastResponse.json()) as ForecastResponse);
      if (days.length === 0) throw new Error("Open-Meteo returned no forecast days");
    } catch (error) {
      console.warn("Open-Meteo forecast unavailable; using MET Norway fallback.", error);
      days = await fetchMetNorwayForecast(
        location.latitude,
        location.longitude,
        location.country_code || countryCode,
        location.timezone || "UTC",
      );
      source = "MET Norway";
    }

    return json({
      destination: location.name || city,
      region: location.admin1 || region,
      country: location.country || country,
      countryCode: location.country_code || countryCode,
      latitude: location.latitude,
      longitude: location.longitude,
      days,
      source,
    });
  } catch (error) {
    console.error("Live weather request failed.", error);
    return json({ error: "Live weather could not be reached. Try again shortly." }, 502);
  }
}
