"use client";
import { Building2, Clock, Cross, ExternalLink, LocateFixed, MapPin, Navigation, Phone, Pill, Search, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import { CopyButton } from "@/components/common";
import { Badge, Button, Callout, Card, LoadingBlock, Segmented } from "@/components/ui";
import { deviceLocation, locate, nearby, type Place, type PlaceKind, type Spot } from "@/lib/places";

const KIND: Record<PlaceKind, { label: string; icon: typeof Pill; tint: string }> = {
  pharmacy: { label: "Pharmacy", icon: Pill, tint: "from-emerald-500 to-teal-500" },
  hospital: { label: "Hospital", icon: Cross, tint: "from-rose-500 to-orange-400" },
  clinic: { label: "Clinic", icon: Building2, tint: "from-sky-500 to-blue-600" },
  doctors: { label: "Doctor", icon: Stethoscope, tint: "from-violet-500 to-indigo-500" },
};
export interface PlaceGroup {
  id: string;
  label: string;
  kinds: PlaceKind[];
}
const AREA_KEY = "sano.area";

/** Search real nearby places: type an area or PIN code, or use the device location. */
export default function NearbyPlaces({ groups, medicineAsk = false }: { groups: PlaceGroup[]; medicineAsk?: boolean }) {
  const [area, setArea] = useState("");
  const [group, setGroup] = useState(groups[0].id);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [medicine, setMedicine] = useState("");
  const [shown, setShown] = useState(8);

  useEffect(() => setArea(window.localStorage.getItem(AREA_KEY) ?? ""), []);

  async function run(getSpot: () => Promise<Spot>, groupId = group) {
    setBusy(true);
    setError(null);
    try {
      const at = await getSpot();
      setSpot(at);
      setPlaces(await nearby(at, groups.find((g) => g.id === groupId)!.kinds));
      setShown(8);
    } catch (e) {
      setPlaces(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const searchArea = () => {
    if (area.trim().length < 3) return setError("Type an area and city, or a 6-digit PIN code.");
    window.localStorage.setItem(AREA_KEY, area.trim());
    void run(() => locate(area));
  };
  const term = filter.trim().toLowerCase();
  const list = (places ?? []).filter((p) => !term || `${p.name} ${p.address} ${p.speciality ?? ""}`.toLowerCase().includes(term));
  const ask = `Hello, do you have ${medicine.trim() || "[medicine name and strength]"} in stock? I have a prescription. What is the price, and until what time are you open today?`;

  return (
    <div className="space-y-4">
      <Card className="card-pad space-y-4">
        {groups.length > 1 && (
          <Segmented value={group} onChange={(g) => { setGroup(g); if (spot) void run(async () => spot, g); }} label="What to find" options={groups.map((g) => ({ value: g.id, label: g.label }))} />
        )}
        <form onSubmit={(e) => { e.preventDefault(); searchArea(); }} className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-sano-500" />
            <input className="field !py-3.5 pl-11 !text-[15px]" aria-label="Your area or PIN code" placeholder="Your area and city, or PIN code" value={area} onChange={(e) => setArea(e.target.value)} />
          </div>
          <Button type="submit" size="lg" loading={busy} icon={<Search className="h-4 w-4" />}>Search</Button>
          <Button type="button" size="lg" variant="secondary" disabled={busy} onClick={() => void run(deviceLocation)} icon={<LocateFixed className="h-4 w-4" />}>Near me</Button>
        </form>
        {medicineAsk && (
          <div>
            <label htmlFor="med" className="mb-1 block text-[13px] font-medium text-navy-700">Medicine you want to ask about (optional)</label>
            <input id="med" className="field" placeholder="e.g. Metformin 500 mg" value={medicine} onChange={(e) => setMedicine(e.target.value)} />
          </div>
        )}
        <p className="text-[12px] text-navy-400">Your search area is sent to OpenStreetMap to find places. Your health records are not.</p>
      </Card>

      {error && <Callout tone="warn">{error}</Callout>}
      {busy && <LoadingBlock rows={3} label="Searching nearby" />}

      {!busy && places && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[15px] font-semibold text-navy-900">{list.length} found near {spot?.label}</p>
            <input className="field sm:!w-72" aria-label="Filter results" placeholder="Filter by name or speciality" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          {list.length === 0 ? (
            <Callout tone="info">Nothing is listed here on OpenStreetMap yet. Try a bigger area nearby.</Callout>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {list.slice(0, shown).map((p) => {
                const k = KIND[p.kind];
                return (
                  <li key={p.id}>
                    <Card className="flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
                      <div className="flex items-start gap-3.5">
                        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${k.tint} text-white shadow-sm`}>
                          <k.icon className="h-6 w-6" strokeWidth={1.8} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[16px] font-semibold leading-snug text-navy-900">{p.name}</h3>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <Badge tone="teal">{p.distanceKm < 1 ? `${Math.round(p.distanceKm * 1000)} m` : `${p.distanceKm.toFixed(1)} km`} away</Badge>
                            <Badge tone="slate">{k.label}</Badge>
                            {p.speciality && <Badge tone="sky">{p.speciality}</Badge>}
                          </div>
                          {p.address && <p className="mt-2 text-[13.5px] leading-relaxed text-navy-500">{p.address}</p>}
                          {p.hours && <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-navy-500"><Clock className="h-3.5 w-3.5" /> {p.hours}</p>}
                        </div>
                      </div>
                      <div className="mt-auto flex flex-wrap gap-2 pt-4">
                        {p.phone && <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-medium text-white hover:bg-navy-800"><Phone className="h-4 w-4" /> {p.phone}</a>}
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-navy-100 bg-white px-4 text-sm font-medium text-navy-800 hover:bg-navy-50"><Navigation className="h-4 w-4" /> Directions</a>
                        {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-navy-100 bg-white px-4 text-sm font-medium text-navy-800 hover:bg-navy-50"><ExternalLink className="h-4 w-4" /> Website</a>}
                        {medicineAsk && <CopyButton text={ask} label="Copy question" />}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
          {list.length > shown && <div className="text-center"><Button variant="secondary" onClick={() => setShown(shown + 8)}>Show more</Button></div>}
        </>
      )}
      <p className="text-[12px] text-navy-400">
        Places © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>. Listings can be incomplete or out of date, so call before you visit. SanoAI doesn&apos;t book appointments or check stock.
      </p>
    </div>
  );
}
