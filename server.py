"""Small local API and static server for Mars Atlas route planning."""

from __future__ import annotations

import heapq
import json
import math
import os
import threading
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parent
MARS_RADIUS_M = 3_396_190.0
MAX_GRID_CELLS = 200_000
MIN_CELL_KM = 1.0
DEM_SERVICE = (
    "https://trek.nasa.gov/mars/trekarcgis/rest/services/"
    "Mars_MOLA_blend200ppx_HRSC_DEM_clon0dd_200mpp_lzw/ImageServer/exportImage"
)
TES_WMS = "https://ms-mars.mars.asu.edu/ti16"
_DATA_LOCK = threading.Lock()


class RouteError(Exception):
    """An expected route-planning or public-data error."""


def _request_bytes(url: str, timeout: int = 50) -> bytes:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "MarsAtlasRoutePlanner/1.0 (local research viewer)"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = response.read()
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise RouteError("A Mars terrain data service could not be reached.") from error
    if not payload:
        raise RouteError("A Mars terrain data service returned no data.")
    if payload.lstrip().startswith(b"{"):
        try:
            message = json.loads(payload).get("error", {}).get("message")
        except (ValueError, AttributeError):
            message = None
        raise RouteError(message or "A Mars terrain data service returned an error.")
    return payload


def _read_vicar(payload: bytes) -> tuple[np.ndarray, float | None]:
    """Read a single-band VICAR image, as returned by ASU's TES WMS."""
    try:
        marker = payload.find(b"LBLSIZE=")
        if marker < 0:
            raise ValueError("Missing VICAR label")
        size_end = payload.find(b"\n", marker)
        size_line = payload[marker:size_end if size_end >= 0 else marker + 64].decode("ascii")
        label_size = int(size_line.split("=", 1)[1].strip().split()[0])
        if label_size <= 0 or label_size > len(payload):
            raise ValueError("Invalid VICAR label size")
        label = payload[marker:label_size].decode("ascii")
        fields: dict[str, str] = {}
        for item in label.replace("\r", " ").replace("\n", " ").split():
            if "=" in item:
                key, value = item.split("=", 1)
                fields[key] = value.strip("'\" ,")

        lines, samples = int(fields["NL"]), int(fields["NS"])
        bands = int(fields.get("NB", "1"))
        if label_size <= 0 or lines <= 0 or samples <= 0 or bands != 1:
            raise ValueError("Unsupported VICAR dimensions")
        format_name = fields.get("FORMAT", "HALF").upper()
        dtypes = {"BYTE": "u1", "HALF": "i2", "FULL": "i4", "REAL": "f4", "DOUB": "f8"}
        if format_name not in dtypes:
            raise ValueError("Unsupported VICAR pixel format")
        dtype = np.dtype(dtypes[format_name])
        if dtype.itemsize > 1:
            byte_order = ">" if fields.get("INTFMT", "HIGH").upper() == "HIGH" else "<"
            if format_name in ("REAL", "DOUB") and fields.get("REALFMT", "IEEE").upper() == "RIEEE":
                byte_order = ">"
            dtype = dtype.newbyteorder(byte_order)
        prefix_bytes = int(fields.get("NBB", "0"))
        prefix_records = int(fields.get("NLB", "0"))
        record_size = prefix_bytes + samples * dtype.itemsize
        offset = label_size + prefix_records * record_size
        raw = np.frombuffer(payload, dtype=np.uint8, count=lines * record_size, offset=offset)
        if raw.size != lines * record_size:
            raise ValueError("Incomplete VICAR pixel data")
        records = raw.reshape(lines, record_size)
        pixels = np.empty((lines, samples), dtype=dtype)
        for row in range(lines):
            pixels[row] = np.frombuffer(records[row, prefix_bytes:].tobytes(), dtype=dtype, count=samples)
        nodata = float(fields["NODATA"]) if "NODATA" in fields else None
        return pixels.astype(np.float32), nodata
    except Exception as error:
        raise RouteError("The returned ASU thermal raster format could not be decoded.") from error


def _read_raster(payload: bytes, nodata_values: tuple[float, ...] = ()) -> np.ndarray:
    try:
        if payload.lstrip().startswith(b"LBLSIZE=") or b"LBLSIZE=" in payload[:4096]:
            band, nodata = _read_vicar(payload)
        else:
            with Image.open(BytesIO(payload)) as image:
                band = np.asarray(image)
                if band.ndim == 3:
                    band = band[:, :, 0]
                if band.ndim != 2:
                    raise ValueError("Expected a single-band raster")
                band = band.astype(np.float32)
            nodata = None
        if nodata is not None:
            band[band == nodata] = np.nan
        for value in nodata_values:
            band[band == value] = np.nan
        band[~np.isfinite(band)] = np.nan
        return band
    except Exception as error:  # GDAL reports different errors for unsupported VICAR variants.
        raise RouteError("The returned Mars raster format could not be decoded.") from error


def _query_url(base: str, params: dict[str, Any]) -> str:
    return base + "?" + urllib.parse.urlencode(params)


def _normalized_longitude(longitude: float) -> float:
    value = (longitude + 180.0) % 360.0 - 180.0
    return 180.0 if value == -180.0 and longitude > 0 else value


def _longitude_chunks(longitudes: np.ndarray) -> list[tuple[int, int]]:
    """Split a sampling row at the longitude wrap so each raster bbox is continuous."""
    if len(longitudes) == 0:
        return []
    normalized = np.array([_normalized_longitude(float(value)) for value in longitudes])
    breaks = [index for index in range(1, len(normalized))
              if abs(normalized[index] - normalized[index - 1]) > 180.0]
    starts = [0] + breaks
    ends = breaks + [len(normalized)]
    return list(zip(starts, ends))


def _export_dem(bbox: tuple[float, float, float, float], width: int, height: int) -> np.ndarray:
    xmin, ymin, xmax, ymax = bbox
    url = _query_url(DEM_SERVICE, {
        "bbox": f"{xmin},{ymin},{xmax},{ymax}",
        "bboxSR": "104905",
        "imageSR": "104905",
        "size": f"{width},{height}",
        "format": "tiff",
        "pixelType": "S16",
        "interpolation": "RSP_BilinearInterpolation",
        "compression": "None",
        "noData": "-32768",
        "noDataInterpretation": "esriNoDataMatchAny",
        "f": "image",
    })
    raster = _read_raster(_request_bytes(url), (-32768.0,))
    if raster.shape != (height, width):
        raise RouteError("NASA returned an incomplete elevation grid for this route.")
    raster[raster < -32000] = np.nan
    return raster


def _fetch_dem_grid(latitudes: np.ndarray, longitudes: np.ndarray,
                    cell_km: float, latitude_origin: float) -> np.ndarray:
    rows, columns = len(latitudes), len(longitudes)
    result = np.full((rows, columns), np.nan, dtype=np.float32)
    latitude_step = math.degrees(cell_km * 1000.0 / MARS_RADIUS_M)
    longitude_step = latitude_step / max(0.08, math.cos(math.radians(latitude_origin)))
    for col_start, col_end in _longitude_chunks(longitudes):
        normalized = np.array([_normalized_longitude(float(value))
                               for value in longitudes[col_start:col_end]])
        west = max(-180.0, float(normalized[0] - longitude_step / 2.0))
        east = min(180.0, float(normalized[-1] + longitude_step / 2.0))
        north = min(90.0, float(latitudes[0] + latitude_step / 2.0))
        south = max(-90.0, float(latitudes[-1] - latitude_step / 2.0))
        raster = _export_dem((west, south, east, north), col_end - col_start, rows)
        result[:, col_start:col_end] = raster
    return result


def _fetch_tes_grid(latitudes: np.ndarray, longitudes: np.ndarray,
                    cell_km: float, latitude_origin: float) -> np.ndarray:
    rows, columns = len(latitudes), len(longitudes)
    result = np.full((rows, columns), np.nan, dtype=np.float32)
    latitude_step = math.degrees(cell_km * 1000.0 / MARS_RADIUS_M)
    longitude_step = latitude_step / max(0.08, math.cos(math.radians(latitude_origin)))
    for col_start, col_end in _longitude_chunks(longitudes):
        # ASU's numeric TES WMS uses east longitude in [0, 360].
        values = np.array([(float(value) % 360.0)
                           for value in longitudes[col_start:col_end]])
        breaks = [index for index in range(1, len(values))
                  if abs(values[index] - values[index - 1]) > 180.0]
        chunk_starts = [0] + breaks
        chunk_ends = breaks + [len(values)]
        for local_start, local_end in zip(chunk_starts, chunk_ends):
            west = max(0.0, float(values[local_start] - longitude_step / 2.0))
            east = min(360.0, float(values[local_end - 1] + longitude_step / 2.0))
            north = min(90.0, float(latitudes[0] + latitude_step / 2.0))
            south = max(-90.0, float(latitudes[-1] - latitude_step / 2.0))
            params = {
                "SERVICE": "WMS",
                "VERSION": "1.1.1",
                "REQUEST": "GetMap",
                "LAYERS": "TES_Thermal_Inertia_numeric",
                "STYLES": "",
                "SRS": "JMARS:4",
                "BBOX": f"{west},{south},{east},{north}",
                "WIDTH": col_end - col_start if len(chunk_starts) == 1 else local_end - local_start,
                "HEIGHT": rows,
                "FORMAT": "image/vicar",
            }
            raster = _read_raster(_request_bytes(_query_url(TES_WMS, params)), (0.0, -32768.0))
            expected_width = int(params["WIDTH"])
            if raster.shape != (rows, expected_width):
                raise RouteError("ASU returned an incomplete thermal-inertia grid.")
            result[:, col_start + local_start:col_start + local_end] = raster
    # Thermal inertia is nonnegative; zero is the TES product's no-data value.
    result[result <= 0] = np.nan
    return result


def _local_coordinates(start: dict[str, float], goal: dict[str, float]) -> tuple[float, float, float, float, float]:
    latitude_origin = (start["lat"] + goal["lat"]) / 2.0
    longitude_delta = (goal["lon"] - start["lon"] + 180.0) % 360.0 - 180.0
    x_goal = MARS_RADIUS_M * math.cos(math.radians(latitude_origin)) * math.radians(longitude_delta)
    y_start = MARS_RADIUS_M * math.radians(start["lat"] - latitude_origin)
    y_goal = MARS_RADIUS_M * math.radians(goal["lat"] - latitude_origin)
    return latitude_origin, x_goal, y_start, y_goal, longitude_delta


def _route_grid(start: dict[str, float], goal: dict[str, float]) -> tuple[
        float, float, float, np.ndarray, np.ndarray, tuple[int, int], tuple[int, int]]:
    latitude_origin, x_goal, y_start, y_goal, longitude_delta = _local_coordinates(start, goal)
    distance_m = math.hypot(x_goal, y_goal - y_start)
    if distance_m < 1.0:
        return latitude_origin, 0.0, MIN_CELL_KM, np.array([start["lat"]]), np.array([start["lon"]]), (0, 0), (0, 0)

    margin_m = max(10_000.0, min(200_000.0, distance_m * 0.2))
    west = min(0.0, x_goal) - margin_m
    east = max(0.0, x_goal) + margin_m
    south = min(y_start, y_goal) - margin_m
    north = max(y_start, y_goal) + margin_m
    width_km = (east - west) / 1000.0
    height_km = (north - south) / 1000.0
    cell_km = max(MIN_CELL_KM, math.sqrt(width_km * height_km / MAX_GRID_CELLS))
    cell_km = max(cell_km, width_km / 1400.0, height_km / 1400.0)
    cell_m = cell_km * 1000.0
    columns = max(2, int(math.ceil((east - west) / cell_m)) + 1)
    rows = max(2, int(math.ceil((north - south) / cell_m)) + 1)
    if rows * columns > MAX_GRID_CELLS + 3000:
        cell_km *= math.sqrt((rows * columns) / MAX_GRID_CELLS)
        cell_m = cell_km * 1000.0
        columns = max(2, int(math.ceil((east - west) / cell_m)) + 1)
        rows = max(2, int(math.ceil((north - south) / cell_m)) + 1)

    x_centers = west + np.arange(columns, dtype=np.float64) * cell_m
    y_centers = north - np.arange(rows, dtype=np.float64) * cell_m
    latitudes = latitude_origin + np.degrees(y_centers / MARS_RADIUS_M)
    longitudes = start["lon"] + np.degrees(x_centers / (MARS_RADIUS_M * max(0.08, math.cos(math.radians(latitude_origin)))))
    start_index = (int(round((north - y_start) / cell_m)), int(round(-west / cell_m)))
    goal_index = (int(round((north - y_goal) / cell_m)), int(round((x_goal - west) / cell_m)))
    start_index = (max(0, min(rows - 1, start_index[0])), max(0, min(columns - 1, start_index[1])))
    goal_index = (max(0, min(rows - 1, goal_index[0])), max(0, min(columns - 1, goal_index[1])))
    return latitude_origin, longitude_delta, cell_km, latitudes, longitudes, start_index, goal_index


def _terrain_costs(elevation: np.ndarray, thermal_inertia: np.ndarray | None,
                   cell_km: float) -> tuple[np.ndarray, np.ndarray, dict[str, bool]]:
    valid = np.isfinite(elevation)
    if not valid.any():
        raise RouteError("No MOLA elevation coverage was returned for this route.")
    # Elevation gaps are not silently treated as safe ground.
    filled = np.where(valid, elevation, np.nanmedian(elevation[valid])).astype(np.float32)
    gradient_y, gradient_x = np.gradient(filled, cell_km * 1000.0)
    slope = np.degrees(np.arctan(np.hypot(gradient_x, gradient_y)))

    padded = np.pad(filled, 1, mode="edge")
    neighborhood = np.stack([
        padded[row:row + filled.shape[0], col:col + filled.shape[1]]
        for row in range(3) for col in range(3)
    ])
    roughness_m = np.std(neighborhood, axis=0)
    roughness_scale = float(np.nanpercentile(roughness_m[valid], 95)) if valid.any() else 0.0
    roughness_norm = np.clip(roughness_m / max(roughness_scale, 1.0), 0.0, 1.0)

    costs = 1.0 + np.square(slope / 10.0) * 3.0 + roughness_norm * 2.0
    sources = {"mola": True, "tesThermalInertia": False}
    if thermal_inertia is not None and np.isfinite(thermal_inertia).any():
        thermal_valid = np.isfinite(thermal_inertia)
        low, high = np.nanpercentile(thermal_inertia[thermal_valid], [5, 95])
        if high > low:
            inertia_norm = np.clip((thermal_inertia - low) / (high - low), 0.0, 1.0)
        else:
            inertia_norm = np.full(thermal_inertia.shape, 0.5, dtype=np.float32)
        missing_inertia = ~np.isfinite(inertia_norm)
        inertia_norm[missing_inertia] = 0.5
        costs += (1.0 - inertia_norm) * 2.0
        sources["tesThermalInertia"] = True

    impassable = (slope > 20.0) | ~valid
    return costs.astype(np.float32), impassable, sources


def _a_star(costs: np.ndarray, impassable: np.ndarray, start: tuple[int, int],
            goal: tuple[int, int], cell_km: float) -> list[tuple[int, int]]:
    rows, columns = costs.shape
    if impassable[start]:
        raise RouteError("The selected starting point is on terrain above the 20° slope limit or without elevation data.")
    if impassable[goal]:
        raise RouteError("The selected destination is on terrain above the 20° slope limit or without elevation data.")

    counter = 0
    frontier: list[tuple[float, int, tuple[int, int]]] = []
    heapq.heappush(frontier, (0.0, counter, start))
    came_from: dict[tuple[int, int], tuple[int, int]] = {}
    best_cost = {start: 0.0}
    neighbors = [(-1, -1, math.sqrt(2)), (-1, 0, 1.0), (-1, 1, math.sqrt(2)),
                 (0, -1, 1.0), (0, 1, 1.0), (1, -1, math.sqrt(2)),
                 (1, 0, 1.0), (1, 1, math.sqrt(2))]

    while frontier:
        queued_cost, _, current = heapq.heappop(frontier)
        current_heuristic = math.hypot(goal[0] - current[0], goal[1] - current[1]) * cell_km
        if queued_cost > best_cost[current] + current_heuristic + 1e-9:
            continue
        if current == goal:
            path = [current]
            while current in came_from:
                current = came_from[current]
                path.append(current)
            return path[::-1]

        row, col = current
        for dr, dc, multiplier in neighbors:
            next_row, next_col = row + dr, col + dc
            if not (0 <= next_row < rows and 0 <= next_col < columns):
                continue
            if impassable[next_row, next_col]:
                continue
            if dr and dc and (impassable[row + dr, col] or impassable[row, col + dc]):
                continue
            neighbor = (next_row, next_col)
            edge_km = cell_km * multiplier
            new_cost = best_cost[current] + edge_km * (float(costs[row, col]) + float(costs[next_row, next_col])) / 2.0
            if new_cost < best_cost.get(neighbor, math.inf):
                came_from[neighbor] = current
                best_cost[neighbor] = new_cost
                heuristic = math.hypot(goal[0] - next_row, goal[1] - next_col) * cell_km
                counter += 1
                heapq.heappush(frontier, (new_cost + heuristic, counter, neighbor))

    raise RouteError("No traversable path was found inside the search area. Try locations farther from steep terrain.")


def _great_circle_km(first: tuple[float, float], second: tuple[float, float]) -> float:
    lat1, lon1 = map(math.radians, first)
    lat2, lon2 = map(math.radians, second)
    delta_lat, delta_lon = lat2 - lat1, lon2 - lon1
    haversine = math.sin(delta_lat / 2.0) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2.0) ** 2
    return 2.0 * MARS_RADIUS_M * math.asin(min(1.0, math.sqrt(haversine))) / 1000.0


def calculate_route(start: dict[str, float], goal: dict[str, float]) -> dict[str, Any]:
    with _DATA_LOCK:
        if _great_circle_km((start["lat"], start["lon"]), (goal["lat"], goal["lon"])) < 0.001:
            return {
                "path": [[start["lat"], start["lon"]]], "distanceKm": 0.0,
                "gridCellKm": MIN_CELL_KM, "data": {"mola": False, "tesThermalInertia": False},
                "omitted": ["optical boulder detection", "geologic unit-risk interpretation", "thermal inertia", "thermal cold/time-of-day cost", "radiation", "subsurface hazards"],
            }
        latitude_origin, longitude_delta, cell_km, latitudes, longitudes, start_index, goal_index = _route_grid(start, goal)

        elevation = _fetch_dem_grid(latitudes, longitudes, cell_km, latitude_origin)
        thermal_inertia = None
        try:
            thermal_inertia = _fetch_tes_grid(latitudes, longitudes, cell_km, latitude_origin)
            if thermal_inertia.shape != elevation.shape:
                thermal_inertia = None
        except RouteError:
            # A working topographic route is still useful when the independent TES service is down.
            thermal_inertia = None

        costs, impassable, sources = _terrain_costs(elevation, thermal_inertia, cell_km)
        grid_path = _a_star(costs, impassable, start_index, goal_index, cell_km)
        path: list[list[float]] = [[start["lat"], start["lon"]]]
        for row, col in grid_path:
            latitude = float(latitudes[row])
            longitude = _normalized_longitude(float(longitudes[col]))
            coordinate = [latitude, longitude]
            if coordinate != path[-1]:
                path.append(coordinate)
        if path[-1] != [goal["lat"], goal["lon"]]:
            path.append([goal["lat"], goal["lon"]])
        distance = sum(_great_circle_km(tuple(first), tuple(second))
                       for first, second in zip(path, path[1:]))
        omitted = ["optical boulder detection", "geologic unit-risk interpretation", "thermal cold/time-of-day cost", "radiation", "subsurface hazards"]
        if not sources["tesThermalInertia"]:
            omitted.append("thermal inertia (ASU data unavailable)")
        return {
            "path": path,
            "distanceKm": round(distance, 2),
            "gridCellKm": round(cell_km, 2),
            "data": sources,
            "omitted": omitted,
        }


class MarsAtlasHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        if urllib.parse.urlsplit(self.path).path != "/api/route":
            self._send_json(404, {"error": "API endpoint not found."})
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length < 1 or content_length > 8192:
                raise RouteError("Invalid route request size.")
            payload = json.loads(self.rfile.read(content_length))
            if not isinstance(payload, dict):
                raise ValueError("Route request must be an object.")
            start = _validate_point(payload.get("from"), "starting point")
            goal = _validate_point(payload.get("to"), "destination")
            self._send_json(200, calculate_route(start, goal))
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            self._send_json(400, {"error": "Provide valid latitude and longitude values for both locations."})
        except RouteError as error:
            self._send_json(422, {"error": str(error)})
        except Exception as error:
            print(f"Route calculation error: {error!r}")
            self._send_json(500, {"error": "Route calculation failed. Check the backend log and try again."})


def _validate_point(value: Any, label: str) -> dict[str, float]:
    if not isinstance(value, dict):
        raise ValueError(f"Missing {label}.")
    latitude, longitude = float(value.get("lat")), float(value.get("lon"))
    if not math.isfinite(latitude) or not -90.0 <= latitude <= 90.0:
        raise ValueError(f"Invalid {label} latitude.")
    if not math.isfinite(longitude) or not -180.0 <= longitude <= 180.0:
        raise ValueError(f"Invalid {label} longitude.")
    return {"lat": latitude, "lon": longitude}


def main() -> None:
    host = "0.0.0.0"
    port = int(os.environ.get("PORT", os.environ.get("MARS_ATLAS_PORT", "8000")))
    server = ThreadingHTTPServer((host, port), MarsAtlasHandler)
    print(f"Mars Atlas with route planning: http://{host}:{port}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Mars Atlas server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
