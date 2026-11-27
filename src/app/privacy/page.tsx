import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy and responsible AI" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy and responsible AI"
      intro="SanoAI is a student prototype built by Team SanoAI for SparkX (Theme S2: HealGen). It explains health information. It is not a medical service. Please use sample records, not real sensitive health data, while it is a prototype."
      sections={[
        {
          h: "What is stored",
          items: [
            "Your account details: name, email address and plan.",
            "What you add: documents, the facts extracted from them, your health profile, diary entries, assistant chats, settings and share links.",
            "A log of AI calls (which feature, which provider, size and outcome, never the content) and a monthly count of AI requests.",
          ],
        },
        {
          h: "Where it is stored and who can see it",
          items: [
            "In Google Firebase (Authentication and Cloud Firestore). Database security rules let each signed-in, email-verified account read only its own records.",
            "In-app administrators can manage payment claims, sponsor codes and business enquiries. The rules give them no access to health records.",
            "The people who own the Firebase project can technically access the database through Google's console.",
            "A doctor share link can be opened by anyone who has the link, until it expires or you revoke it.",
          ],
        },
        {
          h: "When AI is used",
          items: [
            "Nothing is sent to an AI service until you allow it. Built-in rules run in your browser.",
            "If you choose SanoAI AI, your question and the record details needed to answer it pass through SanoAI's relay (on Cloudflare) to a third-party AI provider such as Google Gemini, OpenRouter or NVIDIA.",
            "Those providers, especially on free tiers, may keep what is sent and use it to improve their services. Do not send anything you would not want stored.",
            "A model running through Ollama on your own computer keeps the text on that computer.",
          ],
        },
        {
          h: "How we limit AI risk",
          items: [
            "Emergency warning signs are handled by fixed rules, not by a model.",
            "Extracted facts proposed by AI are discarded if their quote cannot be found word for word in your document.",
            "AI answers are checked for format and for diagnostic or dose-changing language. These checks reduce mistakes but cannot remove them.",
          ],
        },
        {
          h: "Your choices",
          items: [
            "Switch between SanoAI AI and built-in rules in Settings.",
            "Delete documents, export your data, or delete your account in Settings and My Medical Records.",
            "After account deletion, a monthly AI request count and a record of any approved payment reference may remain.",
          ],
        },
        { h: "Children and contact", p: "If you are under 18, use SanoAI only with a parent or guardian's permission and with sample data. For questions about your data, contact the Team SanoAI member who shared the site with you, or use the enquiry form on the For labs and clinics page." },
      ]}
    />
  );
}
