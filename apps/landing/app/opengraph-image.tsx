import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND_NAME } from "@/lib/brand";

export const alt = `${BRAND_NAME} - Le tuteur qui ne donne pas la réponse`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ImageResponse ne lit pas les variables CSS : copie de packages/tokens/theme.css.
const PAPER = "#FAF7F0";
const INK = "#1C2340";
const TERRACOTTA = "#B0421A";

const fraunces = await readFile(join(process.cwd(), "assets/fraunces-latin-600-normal.woff"));

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: PAPER,
          color: INK,
          fontFamily: "Fraunces",
        }}
      >
        <div style={{ display: "flex", fontSize: 44 }}>
          {BRAND_NAME}
          <span style={{ color: TERRACOTTA }}>.</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 76, lineHeight: 1.1 }}>
          <span>Il ne donne pas la réponse.</span>
          <span style={{ display: "flex" }}>
            Il aide à la&nbsp;<span style={{ color: TERRACOTTA }}>comprendre.</span>
          </span>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: TERRACOTTA }}>Collège, de la 6e à la 3e</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Fraunces", data: fraunces, style: "normal", weight: 600 }] },
  );
}
