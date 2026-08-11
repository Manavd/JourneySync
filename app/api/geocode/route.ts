export const dynamic = "force-dynamic";

type GeocodingResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
  name?: string;
  address?: {
    state?: string;
    country?: string;
    country_code?: string;
  };
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 160);
  const countryCode = (url.searchParams.get("countryCode") ?? "").trim().toUpperCase();
  if (query.length < 2) return json({ error: "Enter a place name to add it to the map." }, 400);
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) return json({ error: "The country code is not valid." }, 400);

  const geocodingUrl = new URL("https://nominatim.openstreetmap.org/search");
  geocodingUrl.searchParams.set("q", query);
  geocodingUrl.searchParams.set("format", "jsonv2");
  geocodingUrl.searchParams.set("addressdetails", "1");
  geocodingUrl.searchParams.set("limit", "5");
  if (countryCode) geocodingUrl.searchParams.set("countrycodes", countryCode.toLowerCase());

  try {
    const response = await fetch(geocodingUrl, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        Referer: "https://journeysync-travel.manavdesai53.chatgpt.site/",
        "User-Agent": "JourneySync/1.0 (https://journeysync-travel.manavdesai53.chatgpt.site/)",
      },
    });
    if (!response.ok) return json({ error: "The map location service is unavailable right now." }, 502);
    const body = await response.json() as GeocodingResult[];
    const location = body.find((result) => Number.isFinite(Number(result.lat)) && Number.isFinite(Number(result.lon)));
    if (!location) {
      return json({ error: `No map location was found for ${query}. Try a more specific place name.` }, 404);
    }

    return json({
      name: location.name || location.display_name?.split(",")[0] || query,
      region: location.address?.state || "",
      country: location.address?.country || "",
      countryCode: location.address?.country_code?.toUpperCase() || countryCode,
      latitude: Number(location.lat),
      longitude: Number(location.lon),
    });
  } catch (error) {
    console.error("Map geocoding failed.", error);
    return json({ error: "The map location service could not be reached. Try again shortly." }, 502);
  }
}
