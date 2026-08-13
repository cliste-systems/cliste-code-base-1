import { PRODUCT_NAME } from "@/lib/company-details";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const alt = PRODUCT_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LOGO_HEIGHT = 200;
const LOGO_WIDTH = Math.round((478 / 576) * LOGO_HEIGHT);

async function logoDataUrl(): Promise<string> {
  const logoPath = join(process.cwd(), "public/m8x4p2n7.png");
  const logoData = await readFile(logoPath);
  return `data:image/png;base64,${logoData.toString("base64")}`;
}

export default async function OpenGraphImage() {
  const src = await logoDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
        }}
      >
        <img src={src} alt="" width={LOGO_WIDTH} height={LOGO_HEIGHT} />
        <p
          style={{
            marginTop: 28,
            fontSize: 42,
            fontWeight: 600,
            color: "#0b1220",
            letterSpacing: "-0.02em",
          }}
        >
          {PRODUCT_NAME}
        </p>
        <p
          style={{
            marginTop: 10,
            fontSize: 24,
            color: "#64748b",
          }}
        >
          AI phone agent for Irish businesses
        </p>
      </div>
    ),
    { width: size.width, height: size.height },
  );
}
