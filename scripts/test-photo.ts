import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  choosePhotoFile,
  commonsFileTitle,
  creditFromImageInfo,
  fileScore,
  geosearchUrl,
  photoWords,
  rankFiles,
  readPhotoCache,
  writePhotoCache,
  PHOTO_STORAGE_KEY,
} from "../src/lib/stop-photo.ts";

assert.deepEqual(photoWords("Charles Bridge stroll"), ["charles", "bridge"]);
assert.equal(fileScore("File:Charles Bridge Prague.jpg", ["bridge"]), 0);
assert.ok(fileScore("File:Charles Bridge Prague.jpg", ["charles", "bridge"]) > 0);
assert.equal(fileScore("File:A cafe in Vienna.jpg", ["cafe", "slavia"]), 0);

const loose = rankFiles(
  ["File:Prague cafe interior.jpg", "File:Old Town square.jpg"],
  { title: "Sample dinner", neighborhood: "Old Town" },
);
assert.equal(loose, "");

const nearby = ["File:Tram stop Prague.jpg", "File:Charles Bridge from the tower.jpg"];
assert.equal(
  choosePhotoFile({ nearby, searched: ["File:Café Slavia Praha.jpg"], stop: { title: "Charles Bridge stroll" } }),
  "File:Charles Bridge from the tower.jpg",
);
assert.equal(
  choosePhotoFile({ nearby: [], searched: ["File:Café Slavia Praha.jpg"], stop: { title: "Café Slavia" } }),
  "File:Café Slavia Praha.jpg",
);
assert.equal(
  choosePhotoFile({
    override: "File:Café Slavia Praha.jpg",
    nearby: ["File:Charles Bridge Prague.jpg"],
    stop: { title: "Sample lunch" },
  }),
  "File:Café Slavia Praha.jpg",
);

assert.equal(commonsFileTitle("File:Charles Bridge - beggar.jpg"), "File:Charles Bridge - beggar.jpg");
assert.equal(
  commonsFileTitle("https://commons.wikimedia.org/wiki/File:Charles_Bridge_-_beggar.jpg"),
  "File:Charles Bridge - beggar.jpg",
);
assert.equal(commonsFileTitle("https://images.google.com/photo.jpg"), "");
assert.match(geosearchUrl(50.0865, 14.4114), /gsradius=150/);
assert.match(geosearchUrl(50.0865, 14.4114), /list=geosearch/);

const credit = creditFromImageInfo({
  query: {
    pages: {
      "1": {
        imageinfo: [{
          thumburl: "https://thumb.wikimedia.org/example.jpg",
          descriptionurl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
          extmetadata: {
            Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Example">Ada Lovelace</a>' },
            LicenseShortName: { value: "CC BY-SA 4.0" },
          },
        }],
      },
    },
  },
}, "File:Example.jpg");
assert.ok(credit);
assert.equal(credit?.author, "Ada Lovelace");
assert.equal(credit?.license, "CC BY-SA 4.0");
assert.equal(credit?.fileName, "Example.jpg");
assert.match(credit?.page || "", /commons\.wikimedia\.org\/wiki\/File/);

const stored = writePhotoCache(null, "d1-s2", credit!);
const again = readPhotoCache(stored, "d1-s2", "");
assert.equal(again?.fileName, "Example.jpg");
assert.equal(readPhotoCache(stored, "d1-s2", "File:Other.jpg"), null);
assert.match(PHOTO_STORAGE_KEY, /atlas-stop-photos/);

const atlas = await readFile("content/atlas.html", "utf8");
assert.match(atlas, /list=geosearch/);
assert.match(atlas, /gsradius=150/);
assert.match(atlas, /hits\.length < 2/);
assert.match(atlas, /extmetadata/);
assert.match(atlas, /atlas-stop-photos/);
assert.equal(atlas.includes("Photo of this place"), false);

const sample = JSON.parse(await readFile("content/trip.sample.json", "utf8"));
const photos = sample.tripDays.flatMap((day: { stops: Array<{ photo?: string }> }) => day.stops.map((stop) => stop.photo).filter(Boolean));
assert.ok(photos.length >= 1 && photos.length <= 2);
photos.forEach((photo: string) => assert.match(photo, /^File:.+\.(jpe?g|png|webp)$/i));

let live = "LIVE_BLOCKED";
try {
  const landmark = await fetch(geosearchUrl(50.0865, 14.4114), { headers: { "user-agent": "PragueTime photo check" } });
  const landmarkJson = await landmark.json() as { query?: { geosearch?: Array<{ title: string }> } };
  const landmarkFiles = (landmarkJson.query?.geosearch || []).map((row) => row.title);
  const landmarkPick = rankFiles(landmarkFiles, { title: "Charles Bridge stroll", neighborhood: "Karlův most" });
  assert.match(landmarkPick, /Charles Bridge/i);

  const cafe = await fetch(geosearchUrl(50.0815, 14.4137), { headers: { "user-agent": "PragueTime photo check" } });
  const cafeJson = await cafe.json() as { query?: { geosearch?: Array<{ title: string }> } };
  const cafeFiles = (cafeJson.query?.geosearch || []).map((row) => row.title);
  const cafePick = rankFiles(cafeFiles, { title: "Café Slavia", neighborhood: "Národní" });
  assert.match(cafePick, /Slavia/i);
  live = "LIVE_OK " + landmarkPick + " | " + cafePick;
} catch (error) {
  const message = error instanceof Error ? error.message : "lookup failed";
  if (!/fetch|network|ENOTFOUND|EAI_AGAIN|abort/i.test(message) && message !== "lookup failed") throw error;
  live = "LIVE_BLOCKED " + message;
}

console.log("photo tests passed");
console.log(live);
