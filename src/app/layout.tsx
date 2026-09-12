import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BatMail — Private email aliases", template: "%s · BatMail" },
  description: "Randomized email aliases that protect your real inbox.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://aliases.batforum.online"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
