import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "gcash-payment.jpg");
  const raw = (await readFile(filePath, "utf8")).trim();
  const base64 = raw.includes(",") ? raw.split(",").pop() || "" : raw;
  const bytes = Buffer.from(base64, "base64");

  return new Response(bytes, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
