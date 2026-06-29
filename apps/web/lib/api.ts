import { initializeApi } from "@repo/api";

const baseUrl =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000";

export function initApi(): void {
  initializeApi({ baseUrl });
}
