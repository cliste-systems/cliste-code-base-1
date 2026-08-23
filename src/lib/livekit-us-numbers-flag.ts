/** When `"1"`, admin org pages may assign US LiveKit DIDs (salon legacy path). */
export function livekitUsNumbersEnabled(): boolean {
  return process.env.CLISTE_ENABLE_LIVEKIT_US_NUMBERS?.trim() === "1";
}
