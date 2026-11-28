"use client";
import { FileText, Phone, Siren } from "lucide-react";
import NearbyPlaces from "@/components/NearbyPlaces";
import ShareLinksCard from "@/components/ShareLinksCard";
import { Button, Card, PageHeader } from "@/components/ui";

export default function FindCarePage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Find care" title="Doctors and hospitals near you" description="Search real places around you, call or get directions, and take a one-page summary of your records with you." />

      <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center">
        <Siren className="h-7 w-7 shrink-0 text-rose-600" />
        <p className="flex-1 text-[14.5px] font-medium text-rose-900">Emergency? Don&apos;t search. Call now.</p>
        <div className="flex gap-2">
          <a href="tel:112" className="inline-flex h-11 items-center gap-2 rounded-xl bg-rose-600 px-5 text-[15px] font-semibold text-white hover:bg-rose-700"><Phone className="h-4 w-4" /> 112</a>
          <a href="tel:108" className="inline-flex h-11 items-center gap-2 rounded-xl border border-rose-300 bg-white px-5 text-[15px] font-semibold text-rose-700 hover:bg-rose-100"><Phone className="h-4 w-4" /> 108 ambulance</a>
        </div>
      </div>

      <NearbyPlaces groups={[{ id: "hospitals", label: "Hospitals", kinds: ["hospital"] }, { id: "clinics", label: "Clinics & doctors", kinds: ["clinic", "doctors"] }]} />

      <Card className="flex flex-col gap-4 bg-gradient-to-r from-navy-900 to-navy-800 p-6 text-white sm:flex-row sm:items-center">
        <FileText className="h-9 w-9 shrink-0 text-sano-300" />
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Before your visit</h2>
          <p className="mt-1 text-[14px] text-navy-200">Make a one-page summary of your results, medicines and questions to show the doctor.</p>
        </div>
        <Button href="/brief" size="lg">Make my summary</Button>
      </Card>

      <ShareLinksCard />
    </div>
  );
}
