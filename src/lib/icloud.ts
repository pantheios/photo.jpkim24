import "server-only";

// iCloud 공유앨범 "공개 웹사이트" 링크의 비공식 webstream API 클라이언트.
// 인증 불필요 — 링크의 토큰(#B0…)만 있으면 사진 목록과 다운로드 URL을 받을 수 있다.
// Apple이 형식을 바꿀 수 있으므로 응답 형태는 방어적으로 다룬다.

const ENTRY_HOST = "p01-sharedstreams.icloud.com";

export type ICloudDerivative = {
  checksum: string;
  fileSize: number;
  width: number;
  height: number;
};

export type ICloudPhoto = {
  photoGuid: string;
  caption: string | null;
  dateCreated: Date | null;
  isVideo: boolean;
  derivatives: ICloudDerivative[];
};

export type ICloudStream = {
  name: string | null;
  photos: ICloudPhoto[];
  host: string;
};

// 공유앨범 URL 또는 토큰 문자열에서 토큰 추출
export function tokenFromUrl(input: string): string | null {
  const s = input.trim();
  const hash = s.match(/#([A-Za-z0-9_-]{8,})/);
  if (hash) return hash[1];
  if (/^[A-Za-z0-9_-]{8,}$/.test(s)) return s;
  return null;
}

async function postJson(
  host: string,
  token: string,
  endpoint: string,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`https://${host}/${token}/sharedstreams/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    // 비정상 응답 — 빈 객체 유지
  }
  return { status: res.status, json };
}

// 첫 요청이 330으로 올바른 파티션 호스트를 알려주면 그 호스트로 재시도
async function callWithRedirect(
  token: string,
  endpoint: string,
  body: unknown,
  host = ENTRY_HOST,
): Promise<{ host: string; json: Record<string, unknown> }> {
  const { status, json } = await postJson(host, token, endpoint, body);
  const redirectHost = json["X-Apple-MMe-Host"];
  if ((status === 330 || redirectHost) && typeof redirectHost === "string" && redirectHost !== host) {
    const retry = await postJson(redirectHost, token, endpoint, body);
    if (retry.status >= 400) throw new Error(`iCloud 응답 오류 (${retry.status})`);
    return { host: redirectHost, json: retry.json };
  }
  if (status >= 400) throw new Error(`iCloud 응답 오류 (${status})`);
  return { host, json };
}

function parsePhoto(raw: Record<string, unknown>): ICloudPhoto | null {
  const guid = raw.photoGuid;
  if (typeof guid !== "string" || !guid) return null;

  const derivRaw = (raw.derivatives ?? {}) as Record<string, Record<string, unknown>>;
  const derivatives: ICloudDerivative[] = [];
  for (const d of Object.values(derivRaw)) {
    const checksum = d.checksum;
    if (typeof checksum !== "string") continue;
    derivatives.push({
      checksum,
      fileSize: Number(d.fileSize ?? 0),
      width: Number(d.width ?? 0),
      height: Number(d.height ?? 0),
    });
  }
  if (derivatives.length === 0) return null;

  let dateCreated: Date | null = null;
  const dc = raw.dateCreated ?? raw.batchDateCreated;
  if (typeof dc === "string") {
    const d = new Date(dc);
    if (!Number.isNaN(d.getTime())) dateCreated = d;
  }

  return {
    photoGuid: guid,
    caption: typeof raw.caption === "string" && raw.caption ? raw.caption : null,
    dateCreated,
    isVideo: raw.mediaAssetType === "video",
    derivatives,
  };
}

// 앨범 메타데이터 + 사진 목록
export async function fetchStream(token: string): Promise<ICloudStream> {
  const { host, json } = await callWithRedirect(token, "webstream", { streamCtag: null });
  const rawPhotos = Array.isArray(json.photos) ? (json.photos as Record<string, unknown>[]) : [];
  return {
    name: typeof json.streamName === "string" ? json.streamName : null,
    photos: rawPhotos.map(parsePhoto).filter((p): p is ICloudPhoto => p !== null),
    host,
  };
}

// photoGuid 목록 → checksum별 다운로드 URL 맵
export async function fetchAssetUrls(
  host: string,
  token: string,
  photoGuids: string[],
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const CHUNK = 20;
  for (let i = 0; i < photoGuids.length; i += CHUNK) {
    const chunk = photoGuids.slice(i, i + CHUNK);
    const { json } = await callWithRedirect(token, "webasseturls", { photoGuids: chunk }, host);
    const items = (json.items ?? {}) as Record<string, Record<string, unknown>>;
    for (const [checksum, item] of Object.entries(items)) {
      const loc = item.url_location;
      const path = item.url_path;
      if (typeof loc === "string" && typeof path === "string") {
        urls.set(checksum, `https://${loc}${path}`);
      }
    }
  }
  return urls;
}

// 표시에 가장 좋은 파생본 선택: 동영상은 가장 큰 파일, 이미지는 가장 큰 가로폭
export function bestDerivative(photo: ICloudPhoto): ICloudDerivative {
  const score = photo.isVideo
    ? (d: ICloudDerivative) => d.fileSize
    : (d: ICloudDerivative) => d.width;
  return photo.derivatives.reduce((a, b) => (score(b) > score(a) ? b : a));
}
