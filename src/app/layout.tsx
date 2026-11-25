import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/sora";
import "./globals.css";
import { ToastProvider } from "@/components/ui";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "SanoAI — Understand your health. Connect the dots.", template: "%s · SanoAI" },
  description: "SanoAI is a Generative AI healthcare intelligence platform that helps you understand your medical information, reconstruct your history, see what's missing, and talk to clinicians with confidence.",
  applicationName: "SanoAI",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0a1428", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
