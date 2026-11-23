import { gateCodeFromEnv, sealAtlas } from "./gate.ts";
import { gatePage } from "./gate-page.ts";
import { renderAtlasHtml } from "./trip-payload.ts";

export async function renderPublishedHtml(): Promise<string> {
  const code = gateCodeFromEnv();
  if (!code) {
    console.log("TRIP_GATE_CODE is not set. Publishing a locked gate with no trip pages.");
    return gatePage({ failed: false });
  }
  const sealed = await sealAtlas(await renderAtlasHtml(), code);
  console.log("Publishing a locked gate. The trip page is sealed and is not written in the clear.");
  return gatePage({ failed: false, sealed });
}
