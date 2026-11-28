import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      intro="By using this SanoAI prototype you agree to the points below."
      sections={[
        {
          h: "Not medical advice",
          items: [
            "SanoAI gives general information and helps you organise records. It does not diagnose, treat or prescribe, and it is not a medical device.",
            "Its content has not been reviewed by a clinician. Check everything with a qualified health professional.",
            "Do not start, stop or change any medicine because of something SanoAI shows.",
            "In an emergency, call 112 (108 for an ambulance where available) or go to the nearest emergency department.",
          ],
        },
        {
          h: "Prototype limits",
          items: [
            "Sample records are fictional. Places come from OpenStreetMap and may be incomplete or out of date. SanoAI does not make bookings or confirm stock.",
            "AI answers can be wrong or incomplete, and free AI services can be slow or unavailable.",
            "The service may change, stop or lose data at any time. Keep your own copies of your records.",
          ],
        },
        { h: "Plans and payments", p: "Plans and payments in this prototype are for demonstration. While demonstration billing is on, plan changes take no money. Do not pay anyone for this prototype." },
        {
          h: "Your responsibilities",
          items: [
            "Add only records that you are allowed to share, preferably sample data.",
            "Keep your account secure.",
            "Do not misuse the service, try to access other people's data, or overload it.",
          ],
        },
      ]}
    />
  );
}
