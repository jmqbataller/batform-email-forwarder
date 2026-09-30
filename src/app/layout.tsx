import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BatMail — Private email aliases", template: "%s · BatMail" },
  description: "Randomized email aliases that protect your real inbox.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://aliases.batform.online"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <style>{`
          footer > span:last-child {
            display: block !important;
            font-size: 0 !important;
          }

          footer > span:last-child::before {
            content: "© 2026 BatMail · batform.online";
            display: block;
            color: #8c9692;
            font-size: 11px;
            line-height: 1.5;
          }

          footer > span:last-child a {
            display: inline-block;
            margin-top: 8px;
            color: #0c8c77 !important;
            font-size: 11px !important;
            font-weight: 800;
            line-height: 1.5;
            text-decoration: none;
          }

          footer > span:last-child a::before {
            content: "Developed by ";
            color: #8c9692;
            font-weight: 500;
          }

          footer > span:last-child a:hover {
            text-decoration: underline;
          }
        `}</style>
      </body>
    </html>
  );
}
