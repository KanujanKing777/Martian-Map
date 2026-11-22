import { fromArrayBuffer } from "geotiff";

interface Env { ALLOWED_ORIGIN: string }
type Point = { lat: number; lon: number };
type Raster = { width: number; height: number; values: Float32Array };
const R = 3_396_190;
const MAX_CELLS = 200_000;
const DEM = "https://trek.nasa.gov/mars/trekarcgis/rest/services/Mars_MOLA_blend200ppx_HRSC_DEM_clon0dd_200mpp_lzw/ImageServer/exportImage";
const TES = "https://ms-mars.mars.asu.edu/ti16";

class ApiError extends Error { constructor(message: string, readonly status = 422) { super(message); } }
const json = (payload: unknown, status: number, origin: string | null, allowed: string) => {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin" });
  if (origin && origin === allowed) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return new Response(JSON.stringify(payload), { status, headers });
};
const rad = (n: number) => n * Math.PI / 180;
const deg = (n: number) => n * 180 / Math.PI;
const normLon = (n: number) => { const v = (n + 180) % 360 < 0 ? (n + 180) % 360 + 360 : (n + 180) % 360; const x = v - 180; return x === -180 && n > 0 ? 180 : x; };

function validatePoint(value: unknown): Point {
  if (!value || typeof value !== "object") throw new ApiError("Provide valid latitude and longitude values for both locations.", 400);
  const p = value as Record<string, unknown>;
  const lat = Number(p.lat), lon = Number(p.lon);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new ApiError("Provide valid latitude and longitude values for both locations.", 400);
  }
  return { lat, lon };
}
function greatCircle(a: Point, b: Point): number {
  const p1 = rad(a.lat), p2 = rad(b.lat), dp = rad(b.lat - a.lat), dl = rad(b.lon - a.lon);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h))) / 1000;
}
function query(base: string, values: Record<string, string | number>): string {
  const u = new URL(base); for (const [k, v] of Object.entries(values)) u.searchParams.set(k, String(v)); return u.toString();
}
async function bytes(url: string): Promise<ArrayBuffer> {
  let response: Response;
  try { response = await fetch(url, { headers: { "User-Agent": "MarsAtlasRoutePlanner/1.0" } }); }
  catch { throw new ApiError("A Mars terrain data service could not be reached."); }
  if (!response.ok) throw new ApiError("A Mars terrain data service could not be reached.");
  const data = await response.arrayBuffer();
  const prefix = new TextDecoder().decode(new Uint8Array(data, 0, Math.min(data.byteLength, 4096)));
  if (prefix.trimStart().startsWith("{")) {
    try { throw new ApiError(JSON.parse(prefix).error?.message || "A Mars terrain data service returned an error."); }
    catch (e) { if (e instanceof ApiError) throw e; throw new ApiError("A Mars terrain data service returned an error."); }
  }
  if (!data.byteLength) throw new ApiError("A Mars terrain data service returned no data.");
  return data;
}
async function decodeTiff(data: ArrayBuffer, nodata: number[]): Promise<Raster> {
  try {
    const image = await (await fromArrayBuffer(data)).getImage();
    const width = image.getWidth(), height = image.getHeight();
    const raw = await image.readRasters({ interleave: true });
    const values = new Float32Array(width * height);
    for (let i = 0; i < values.length; i++) {
      const v = Number(raw[i]); values[i] = Number.isFinite(v) && !nodata.includes(v) && v > -32000 ? v : NaN;
    }
    return { width, height, values };
  } catch { throw new ApiError("The returned Mars raster format could not be decoded."); }
}
function decodeVicar(data: ArrayBuffer): Raster {
  const bytes = new Uint8Array(data), text = new TextDecoder("ascii").decode(bytes.subarray(0, Math.min(bytes.length, 65536)));
  const match = text.match(/LBLSIZE\s*=\s*(\d+)/); if (!match) throw new ApiError("The returned ASU thermal raster format could not be decoded.");
  const labelSize = Number(match[1]), label = text.slice(0, labelSize);
  const fields: Record<string, string> = {};
  for (const pair of label.matchAll(/([A-Z0-9_]+)\s*=\s*'([^']*)'|([A-Z0-9_]+)\s*=\s*([^\s,]+)/g)) fields[pair[1] || pair[3]] = pair[2] || pair[4];
  const width = Number(fields.NS), height = Number(fields.NL), bands = Number(fields.NB || 1), fmt = (fields.FORMAT || "HALF").toUpperCase();
  if (!width || !height || bands !== 1 || !["BYTE", "HALF", "FULL", "REAL", "DOUB"].includes(fmt)) throw new ApiError("The returned ASU thermal raster format could not be decoded.");
  const size = ({ BYTE: 1, HALF: 2, FULL: 4, REAL: 4, DOUB: 8 } as Record<string, number>)[fmt];
  const nbb = Number(fields.NBB || 0), nlb = Number(fields.NLB || 0), record = nbb + width * size, offset = labelSize + nlb * record;
  const view = new DataView(data), values = new Float32Array(width * height), big = (fields.INTFMT || "HIGH").toUpperCase() === "HIGH";
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const o = offset + y * record + nbb + x * size; let v: number;
    if (fmt === "BYTE") v = view.getUint8(o);
    else if (fmt === "HALF") v = view.getInt16(o, !big);
    else if (fmt === "FULL") v = view.getInt32(o, !big);
    else if (fmt === "REAL") v = view.getFloat32(o, !big);
    else v = view.getFloat64(o, !big);
    values[y * width + x] = v === 0 || v === -32768 || !Number.isFinite(v) ? NaN : v;
  }
  return { width, height, values };
}
async function fetchDem(bbox: [number, number, number, number], w: number, h: number): Promise<Raster> {
  return decodeTiff(await bytes(query(DEM, { bbox: bbox.join(","), bboxSR: 104905, imageSR: 104905, size: `${w},${h}`, format: "tiff", pixelType: "S16", interpolation: "RSP_BilinearInterpolation", compression: "None", noData: -32768, noDataInterpretation: "esriNoDataMatchAny", f: "image" })), [-32768]);
}
function chunks(lons: number[]): [number, number][] {
  if (!lons.length) return [];
  const normalized = lons.map(normLon), starts = [0];
  for (let i = 1; i < normalized.length; i++) if (Math.abs(normalized[i] - normalized[i - 1]) > 180) starts.push(i);
  return starts.map((s, i) => [s, starts[i + 1] ?? lons.length]);
}
async function fetchGrids(lat: number[], lon: number[], cell: number, lat0: number): Promise<{ dem: Float32Array; tes: Float32Array }> {
  const rows = lat.length, cols = lon.length, dem = new Float32Array(rows * cols).fill(NaN), tes = new Float32Array(rows * cols).fill(NaN);
  const latStep = deg(cell * 1000 / R), lonStep = latStep / Math.max(.08, Math.cos(rad(lat0)));
  for (const [cs, ce] of chunks(lon)) {
    const ls = lon.slice(cs, ce).map(normLon), bbox: [number, number, number, number] = [Math.max(-180, ls[0] - lonStep / 2), Math.max(-90, lat.at(-1)! - latStep / 2), Math.min(180, ls.at(-1)! + lonStep / 2), Math.min(90, lat[0] + latStep / 2)];
    const raster = await fetchDem(bbox, ce - cs, rows);
    if (raster.width !== ce - cs || raster.height !== rows) throw new ApiError("NASA returned an incomplete elevation grid for this route.");
    for (let y = 0; y < rows; y++) dem.set(raster.values.subarray(y * (ce - cs), (y + 1) * (ce - cs)), y * cols + cs);
  }
  // TES is optional. Keep its independent failure from blocking a topographic route.
  try {
    for (const [cs, ce] of chunks(lon)) {
      const values = lon.slice(cs, ce).map(v => (v % 360 + 360) % 360), breaks = [0];
      for (let i = 1; i < values.length; i++) if (Math.abs(values[i] - values[i - 1]) > 180) breaks.push(i);
      for (let bi = 0; bi < breaks.length; bi++) {
        const a = breaks[bi], b = breaks[bi + 1] ?? values.length, q = query(TES, { SERVICE: "WMS", VERSION: "1.1.1", REQUEST: "GetMap", LAYERS: "TES_Thermal_Inertia_numeric", STYLES: "", SRS: "JMARS:4", BBOX: `${Math.max(0, values[a] - lonStep / 2)},${bboxLat(lat, latStep)[0]},${Math.min(360, values[b - 1] + lonStep / 2)},${bboxLat(lat, latStep)[1]}`, WIDTH: b - a, HEIGHT: rows, FORMAT: "image/vicar" });
        const raster = decodeVicar(await bytes(q));
        if (raster.width !== b - a || raster.height !== rows) throw new Error("bad TES shape");
        for (let y = 0; y < rows; y++) tes.set(raster.values.subarray(y * (b - a), (y + 1) * (b - a)), y * cols + cs + a);
      }
    }
  } catch { tes.fill(NaN); }
  return { dem, tes };
}
function bboxLat(lat: number[], step: number): [number, number] { return [Math.max(-90, lat.at(-1)! - step / 2), Math.min(90, lat[0] + step / 2)]; }

function gridFor(start: Point, goal: Point) {
  const lat0 = (start.lat + goal.lat) / 2, delta = (goal.lon - start.lon + 180) % 360 - 180;
  const xg = R * Math.cos(rad(lat0)) * rad(delta), ys = R * rad(start.lat - lat0), yg = R * rad(goal.lat - lat0), distance = Math.hypot(xg, yg - ys);
  if (distance < 1) return { lat0, cell: 1, lat: [start.lat], lon: [start.lon], si: 0, sj: 0, gi: 0, gj: 0 };
  const margin = Math.max(10000, Math.min(200000, distance * .2)), west = Math.min(0, xg) - margin, east = Math.max(0, xg) + margin, south = Math.min(ys, yg) - margin, north = Math.max(ys, yg) + margin;
  const wk = (east - west) / 1000, hk = (north - south) / 1000;
  let cell = Math.max(1, Math.sqrt(wk * hk / MAX_CELLS), wk / 1400, hk / 1400), m = cell * 1000;
  let cols = Math.max(2, Math.ceil((east - west) / m) + 1), rows = Math.max(2, Math.ceil((north - south) / m) + 1);
  if (rows * cols > MAX_CELLS + 3000) { cell *= Math.sqrt(rows * cols / MAX_CELLS); m = cell * 1000; cols = Math.max(2, Math.ceil((east - west) / m) + 1); rows = Math.max(2, Math.ceil((north - south) / m) + 1); }
  const lat = Array.from({ length: rows }, (_, i) => lat0 + deg((north - i * m) / R));
  const lon = Array.from({ length: cols }, (_, j) => start.lon + deg((west + j * m) / (R * Math.max(.08, Math.cos(rad(lat0))))));
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max - 1, v));
  return { lat0, cell, lat, lon, si: clamp(Math.round((north - ys) / m), rows), sj: clamp(Math.round(-west / m), cols), gi: clamp(Math.round((north - yg) / m), rows), gj: clamp(Math.round((xg - west) / m), cols) };
}
function percentile(values: number[], p: number): number { values.sort((a, b) => a - b); return values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))]; }
class MinHeap {
  a: { f: number; id: number }[] = [];
  push(v: { f: number; id: number }) { const a = this.a; a.push(v); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (a[p].f <= v.f) break; a[i] = a[p]; i = p; } a[i] = v; }
  pop() { const a = this.a, root = a[0], last = a.pop()!; if (a.length) { let i = 0; while (true) { let c = i * 2 + 1; if (c >= a.length) break; if (c + 1 < a.length && a[c + 1].f < a[c].f) c++; if (a[c].f >= last.f) break; a[i] = a[c]; i = c; } a[i] = last; } return root; }
}
function search(start: Point, goal: Point, g: ReturnType<typeof gridFor>, dem: Float32Array, tes: Float32Array) {
  const rows = g.lat.length, cols = g.lon.length, n = rows * cols, valid = new Uint8Array(n), blocked = new Uint8Array(n), cost = new Float32Array(n), filled = new Float32Array(n);
  const present: number[] = [];
  for (let id = 0; id < n; id++) if (Number.isFinite(dem[id])) { valid[id] = 1; present.push(dem[id]); filled[id] = dem[id]; }
  if (!present.length) throw new ApiError("No MOLA elevation coverage was returned for this route.");
  const median = percentile([...present], .5); for (let i = 0; i < n; i++) if (!valid[i]) filled[i] = median;
  const rough = new Float32Array(n), slopes = new Float32Array(n), neighborhood = new Array<number>(9);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const id = r * cols + c, up = Math.max(0, r - 1), down = Math.min(rows - 1, r + 1), left = Math.max(0, c - 1), right = Math.min(cols - 1, c + 1);
    const dx = (filled[r * cols + right] - filled[r * cols + left]) / (Math.max(1, right - left) * g.cell * 1000), dy = (filled[down * cols + c] - filled[up * cols + c]) / (Math.max(1, down - up) * g.cell * 1000);
    slopes[id] = Math.atan(Math.hypot(dx, dy)) * 180 / Math.PI;
    let k = 0, sum = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const v = filled[Math.max(0, Math.min(rows - 1, r + dr)) * cols + Math.max(0, Math.min(cols - 1, c + dc))]; neighborhood[k++] = v; sum += v; }
    const mean = sum / 9; let variance = 0; for (const v of neighborhood) variance += (v - mean) ** 2; rough[id] = Math.sqrt(variance / 9);
    if (!valid[id] || slopes[id] > 20) blocked[id] = 1;
  }
  const roughP95 = percentile(Array.from(rough), .95), thermal = Array.from(tes).filter(Number.isFinite), hasTes = thermal.length > 0;
  const tlo = hasTes ? percentile([...thermal], .05) : 0, thi = hasTes ? percentile([...thermal], .95) : 0;
  for (let i = 0; i < n; i++) { const rn = Math.min(1, rough[i] / Math.max(roughP95, 1)); cost[i] = 1 + (slopes[i] / 10) ** 2 * 3 + rn * 2; if (hasTes) { const tn = Number.isFinite(tes[i]) ? (thi > tlo ? Math.max(0, Math.min(1, (tes[i] - tlo) / (thi - tlo))) : .5) : .5; cost[i] += (1 - tn) * 2; } }
  const sid = g.si * cols + g.sj, gid = g.gi * cols + g.gj;
  if (blocked[sid]) throw new ApiError("The selected starting point is on terrain above the 20° slope limit or without elevation data.");
  if (blocked[gid]) throw new ApiError("The selected destination is on terrain above the 20° slope limit or without elevation data.");
  const best = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), heap = new MinHeap(), neighbors: [number, number, number][] = [[-1,-1,Math.SQRT2],[-1,0,1],[-1,1,Math.SQRT2],[0,-1,1],[0,1,1],[1,-1,Math.SQRT2],[1,0,1],[1,1,Math.SQRT2]];
  best[sid] = 0; heap.push({ f: 0, id: sid });
  while (heap.a.length) {
    const { f, id } = heap.pop(), row = Math.floor(id / cols), col = id % cols, h = Math.hypot(g.gi - row, g.gj - col) * g.cell;
    if (f > best[id] + h + 1e-9) continue;
    if (id === gid) break;
    for (const [dr, dc, mult] of neighbors) {
      const nr = row + dr, nc = col + dc; if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const ni = nr * cols + nc; if (blocked[ni] || (dr && dc && (blocked[row * cols + nc] || blocked[nr * cols + col]))) continue;
      const next = best[id] + g.cell * mult * (cost[id] + cost[ni]) / 2;
      if (next < best[ni]) { best[ni] = next; prev[ni] = id; heap.push({ f: next + Math.hypot(g.gi - nr, g.gj - nc) * g.cell, id: ni }); }
    }
  }
  if (sid !== gid && prev[gid] < 0) throw new ApiError("No traversable path was found inside the search area. Try locations farther from steep terrain.");
  const ids: number[] = [gid]; while (ids[ids.length - 1] !== sid) { const p = prev[ids[ids.length - 1]]; if (p < 0) break; ids.push(p); } ids.reverse();
  const path: [number, number][] = [[start.lat, start.lon]];
  for (const id of ids) { const p: [number, number] = [g.lat[Math.floor(id / cols)], normLon(g.lon[id % cols])]; if (p[0] !== path.at(-1)![0] || p[1] !== path.at(-1)![1]) path.push(p); }
  if (path.at(-1)![0] !== goal.lat || path.at(-1)![1] !== goal.lon) path.push([goal.lat, goal.lon]);
  const distanceKm = path.slice(1).reduce((sum, p, i) => sum + greatCircle({ lat: path[i][0], lon: path[i][1] }, { lat: p[0], lon: p[1] }), 0);
  const omitted = ["optical boulder detection", "geologic unit-risk interpretation", "thermal cold/time-of-day cost", "radiation", "subsurface hazards"];
  if (!hasTes) omitted.push("thermal inertia (ASU data unavailable)");
  return { path, distanceKm: Math.round(distanceKm * 100) / 100, gridCellKm: Math.round(g.cell * 100) / 100, data: { mola: true, tesThermalInertia: hasTes }, omitted };
}
async function route(start: Point, goal: Point) {
  if (greatCircle(start, goal) < .001) return { path: [[start.lat, start.lon]], distanceKm: 0, gridCellKm: 1, data: { mola: false, tesThermalInertia: false }, omitted: ["optical boulder detection", "geologic unit-risk interpretation", "thermal inertia", "thermal cold/time-of-day cost", "radiation", "subsurface hazards"] };
  const g = gridFor(start, goal), data = await fetchGrids(g.lat, g.lon, g.cell, g.lat0);
  return search(start, goal, g, data.dem, data.tes);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin"), allowed = env.ALLOWED_ORIGIN;
    if (request.method === "OPTIONS") {
      if (origin !== allowed) return new Response(null, { status: 403 });
      const response = new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": origin!, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" } });
      return response;
    }
    const url = new URL(request.url);
    if (url.pathname !== "/api/route") return json({ error: "API endpoint not found." }, 404, origin, allowed);
    if (origin && origin !== allowed) return json({ error: "Origin is not allowed." }, 403, null, allowed);
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin, allowed);
    try {
      const length = Number(request.headers.get("Content-Length") || 0);
      if (length > 8192) throw new ApiError("Invalid route request size.", 400);
      const payload = await request.json() as { from?: unknown; to?: unknown };
      const result = await route(validatePoint(payload?.from), validatePoint(payload?.to));
      return json(result, 200, origin, allowed);
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, error.status, origin, allowed);
      if (error instanceof SyntaxError) return json({ error: "Provide valid latitude and longitude values for both locations." }, 400, origin, allowed);
      console.error("Route calculation error", error);
      return json({ error: "Route calculation failed. Check the Worker logs and try again." }, 500, origin, allowed);
    }
  }
};
