export const PHOTO_STORAGE_KEY = "atlas-stop-photos";
export const PHOTO_CACHE_VERSION = 1;
export const PHOTO_RADIUS_METERS = 150;

export type PhotoCredit = {
  src: string;
  file: string;
  fileName: string;
  author: string;
  license: string;
  page: string;
};

export type PhotoStop = {
  title?: string;
  neighborhood?: string;
  photo?: unknown;
};

const DROP_WORDS: Record<string, 1> = {
  dinner: 1, lunch: 1, breakfast: 1, brunch: 1, walk: 1, stroll: 1, hike: 1, tour: 1,
  guided: 1, sunrise: 1, sunset: 1, evening: 1, morning: 1, farewell: 1, family: 1,
  holiday: 1, arrival: 1, pickup: 1, drive: 1, pastries: 1, hidden: 1, with: 1,
  from: 1, near: 1, prague: 1, praha: 1, that: 1, this: 1,
};

export function foldText(value: string): string {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function photoWords(value: string): string[] {
  return foldText(value).split(/[^a-z0-9]+/).filter((word) => word.length > 3 && !DROP_WORDS[word]);
}

export function photoPlaceBonus(fileTitle: string, stop: PhotoStop): number {
  const name = foldText(fileTitle);
  const context = foldText((stop.title || "") + " " + (stop.neighborhood || ""));
  let bonus = 0;
  const elsewhere = ["svitavy", "brno", "plzen", "pilsen", "wien", "vienna", "berlin", "dresden", "nurnberg", "munchen"];
  elsewhere.forEach((city) => {
    if (name.indexOf(city) !== -1 && context.indexOf(city) === -1) bonus -= 14;
  });
  if ((name.indexOf("prague") !== -1 || name.indexOf("praha") !== -1) && context.indexOf("nurnberg") === -1 && context.indexOf("dresden") === -1) bonus += 6;
  return bonus;
}

export function fileScore(fileTitle: string, words: string[]): number {
  const name = foldText(fileTitle);
  if (/\.svg$|map\b|flag of|locator|coat of arms|logo|icon|diagram|planek|plan of/.test(name)) return 0;
  if (!/\.(jpe?g|png|webp)$/.test(name)) return 0;
  const looseName = name.replace(/(.)\1+/g, "$1");
  const hits: string[] = [];
  words.forEach((word) => {
    const looseWord = word.replace(/(.)\1+/g, "$1");
    if (hits.indexOf(looseWord) === -1 && looseName.indexOf(looseWord) !== -1) hits.push(looseWord);
  });
  if (hits.length < 2) return 0;
  const ranked = hits.slice().sort((a, b) => b.length - a.length);
  const gap = Math.abs(looseName.indexOf(ranked[0]) - looseName.indexOf(ranked[1]));
  if (gap > 22) return 0;
  return hits.reduce((sum, word) => sum + word.length, 0);
}

export function rankFiles(files: string[], stop: PhotoStop): string {
  const words = photoWords(String(stop.title || ""));
  let best = "";
  let bestScore = 0;
  files.forEach((file) => {
    const base = fileScore(file, words);
    if (base <= 0) return;
    const score = base + photoPlaceBonus(file, stop);
    if (score > bestScore) {
      bestScore = score;
      best = file;
    }
  });
  return best;
}

export function choosePhotoFile(input: { override?: string; nearby?: string[]; searched?: string[]; stop: PhotoStop }): string {
  if (input.override) return input.override;
  const nearby = input.nearby || [];
  if (nearby.length) return rankFiles(nearby, input.stop);
  return rankFiles(input.searched || [], input.stop);
}

export function geosearchUrl(lat: number, lng: number): string {
  return "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&list=geosearch&gsnamespace=6&gsprimary=all&gsradius="
    + PHOTO_RADIUS_METERS + "&gslimit=20&gscoord=" + encodeURIComponent(lat + "|" + lng);
}

export function titleSearchUrl(query: string): string {
  return "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&list=search&srnamespace=6&srlimit=8&srsearch="
    + encodeURIComponent(query);
}

export function imageInfoUrl(fileTitle: string): string {
  return "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=960&titles="
    + encodeURIComponent(fileTitle);
}

export function commonsFileTitle(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text) return "";
  let name = "";
  if (/^https?:\/\//i.test(text)) {
  try {
    const url = new URL(text);
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "commons.wikimedia.org" && host !== "upload.wikimedia.org") return "";
    const wiki = url.pathname.match(/\/wiki\/(?:File:|Special:FilePath\/)([^#?]+)/i);
    if (wiki) name = decodeURIComponent(wiki[1]);
    else {
      const upload = url.pathname.match(/\/([^/]+\.(?:jpe?g|png|webp))$/i);
      if (upload) name = decodeURIComponent(upload[1]);
    }
  } catch {
    return "";
  }
  } else {
    name = text;
  }
  name = name.replace(/_/g, " ").trim();
  if (!name || /^https?:/i.test(name)) return "";
  if (!/^File:/i.test(name)) {
    if (!/\.(jpe?g|png|webp)$/i.test(name)) return "";
    name = "File:" + name;
  }
  if (!/\.(jpe?g|png|webp)$/i.test(name)) return "";
  if (/[<>"']/.test(name)) return "";
  return name;
}

export function commonsPageUrl(fileTitle: string): string {
  return "https://commons.wikimedia.org/wiki/" + encodeURIComponent(fileTitle.replace(/ /g, "_"));
}

export function plainCommonsText(value: string): string {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#0*39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function creditFromImageInfo(payload: unknown, fileTitle: string): PhotoCredit | null {
  const pages = (payload as { query?: { pages?: Record<string, { imageinfo?: Array<Record<string, unknown>> }> } })?.query?.pages;
  const page = pages ? Object.values(pages)[0] : undefined;
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const src = String(info.thumburl || info.url || "");
  if (!src.startsWith("https://")) return null;
  const meta = (info.extmetadata || {}) as Record<string, { value?: string }>;
  const author = plainCommonsText(meta.Artist?.value || "").slice(0, 80);
  const license = plainCommonsText(meta.LicenseShortName?.value || "").slice(0, 40);
  const fileName = fileTitle.replace(/^File:/i, "");
  return { src, file: fileTitle, fileName, author, license, page: commonsPageUrl(fileTitle) };
}

export function readPhotoCache(raw: string | null, stopId: string, overrideFile: string): PhotoCredit | null {
  if (!raw || !stopId) return null;
  try {
    const data = JSON.parse(raw) as { v?: number; stops?: Record<string, PhotoCredit> };
    if (!data || data.v !== PHOTO_CACHE_VERSION || !data.stops) return null;
    const row = data.stops[stopId];
    if (!row || typeof row.src !== "string") return null;
    if (overrideFile && row.file !== overrideFile) return null;
    return row;
  } catch {
    return null;
  }
}

export function writePhotoCache(raw: string | null, stopId: string, photo: PhotoCredit): string {
  let data: { v: number; stops: Record<string, PhotoCredit> } = { v: PHOTO_CACHE_VERSION, stops: {} };
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { v?: number; stops?: Record<string, PhotoCredit> };
      if (parsed && parsed.v === PHOTO_CACHE_VERSION && parsed.stops) data = { v: PHOTO_CACHE_VERSION, stops: parsed.stops };
    } catch { /* start a fresh cache */ }
  }
  data.stops[stopId] = photo;
  return JSON.stringify(data);
}
