export type Place = { lat: number; lng: number; locality: string | null };
export type MapsClient = { geocode(address: string): Promise<Place | null> };

type Component = { long_name?: string; longText?: string; types: string[] };

// The most specific area name a worker would recognise: "Civil Lines", not "Roorkee".
function localityOf(components: Component[]) {
  for (const type of ["sublocality_level_1", "sublocality", "neighborhood", "locality"]) {
    const c = components.find((x) => x.types.includes(type));
    if (c) return c.long_name ?? c.longText ?? null;
  }
  return null;
}

export function googleMaps(apiKey: string, fetchFn: typeof fetch = fetch): MapsClient {
  return {
    async geocode(address) {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.search = new URLSearchParams({ address, region: "in", components: "country:IN", key: apiKey }).toString();
      const geo = (await (await fetchFn(url)).json()) as {
        status: string;
        error_message?: string;
        results: { geometry: { location: { lat: number; lng: number } }; address_components: Component[] }[];
      };
      const hit = geo.results?.[0];
      if (geo.status === "OK" && hit) return { ...hit.geometry.location, locality: localityOf(hit.address_components) };
      if (geo.status !== "ZERO_RESULTS") throw new Error(`geocoding ${geo.status}: ${geo.error_message ?? ""}`.trim());

      // Landmark-style addresses ("Machhi market ke paas") are found by place search instead.
      const res = await fetchFn("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey, "x-goog-fieldmask": "places.location,places.addressComponents" },
        body: JSON.stringify({ textQuery: address, regionCode: "IN" }),
      });
      const places = (await res.json()) as {
        places?: { location: { latitude: number; longitude: number }; addressComponents?: Component[] }[];
        error?: { message: string };
      };
      if (!res.ok) throw new Error(`place search: ${places.error?.message ?? res.status}`);
      const place = places.places?.[0];
      return place ? { lat: place.location.latitude, lng: place.location.longitude, locality: localityOf(place.addressComponents ?? []) } : null;
    },
  };
}

export function offlineMaps(log: (line: string) => void): MapsClient {
  return {
    async geocode() {
      log("[maps offline] address not located");
      return null;
    },
  };
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
