import { describe, expect, it } from "vitest";
import { ROORKEE, googleMaps } from "../src/clients/maps.ts";

const GUWAHATI = { lat: 26.202, lng: 91.6854 };
const IIT_ROORKEE = { lat: 29.8649, lng: 77.8966 };
const area = (name: string) => [{ long_name: name, types: ["sublocality_level_1"] }];

function fakeGoogle(geocode: { lat: number; lng: number; name: string }[], places: { lat: number; lng: number; name: string }[] = []) {
  const requests: { url: string; body?: unknown }[] = [];
  const fetchFn = (async (input: URL | string, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const body = url.includes("geocode")
      ? { status: geocode.length ? "OK" : "ZERO_RESULTS", results: geocode.map((g) => ({ geometry: { location: { lat: g.lat, lng: g.lng } }, address_components: area(g.name) })) }
      : { places: places.map((p) => ({ location: { latitude: p.lat, longitude: p.lng }, addressComponents: area(p.name) })) };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  return { maps: googleMaps("key", ROORKEE, fetchFn), requests };
}

describe("googleMaps", () => {
  it("biases the search to Roorkee and skips matches in other cities", async () => {
    const { maps, requests } = fakeGoogle([{ ...GUWAHATI, name: "Jalukbari" }, { ...IIT_ROORKEE, name: "Civil Lines" }]);
    expect(await maps.geocode("IIT Road near bus stand")).toEqual({ ...IIT_ROORKEE, locality: "Civil Lines" });
    const [south, west, north, east] = new URL(requests[0]!.url).searchParams.get("bounds")!.split(/[,|]/).map(Number);
    expect(south! < IIT_ROORKEE.lat && IIT_ROORKEE.lat < north! && west! < IIT_ROORKEE.lng && IIT_ROORKEE.lng < east!).toBe(true);
    expect(requests).toHaveLength(1);
  });

  it("searches places near Roorkee when the geocoder only knows other cities", async () => {
    const { maps, requests } = fakeGoogle([{ ...GUWAHATI, name: "Jalukbari" }], [{ ...GUWAHATI, name: "Jalukbari" }, { ...IIT_ROORKEE, name: "Civil Lines" }]);
    expect(await maps.geocode("IIT Road near bus stand")).toEqual({ ...IIT_ROORKEE, locality: "Civil Lines" });
    expect(requests[1]!.body).toMatchObject({ locationBias: { circle: { center: { latitude: ROORKEE.lat, longitude: ROORKEE.lng }, radius: 20000 } } });
  });

  it("leaves an address outside the service area unlocated", async () => {
    const { maps } = fakeGoogle([{ ...GUWAHATI, name: "Jalukbari" }], [{ ...GUWAHATI, name: "Jalukbari" }]);
    expect(await maps.geocode("IIT Road near bus stand")).toBeNull();
  });
});
