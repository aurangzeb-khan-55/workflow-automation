import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { QueryProvider } from "@/lib/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atria Wellness Patient Intake",
  description: "Secure patient intake portal for Atria Wellness",
};

// The whole app is wrapped in <ClerkProvider>, which needs a real
// publishable key to initialize — a key that (by design) only exists at
// runtime, not at build time. Statically prerendering any page would fail
// without one, so every route renders dynamically instead. This is also
// just correct for an app entirely behind a per-request auth context.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/sign-in">
      <html lang="en">
        <body className="min-h-screen antialiased">
          <QueryProvider>{children}</QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
