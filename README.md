# Mars Atlas

An interactive Mars surface map that opens centered on Jezero Crater with an approximately **1,000 km-wide** view and **18.4° N, 77.5° E** marked. It uses NASA Mars Trek's public ArcGIS services for optical, topographic, and USGS SIM 3292 global geologic imagery, and the ASU THEMIS composite service for day + night infrared imagery.

## Run locally

Install Python 3.10 or newer, then run:

```sh
python -m pip install -r requirements.txt
python server.py
```

Open `http://127.0.0.1:8000`. The route API and public map data services require an internet connection. A static-only server such as VS Code Live Server does not provide the route API.

## Map controls

- Pan by dragging; zoom with the map buttons, mouse wheel, or touch gestures.
- Switch between optical imagery, topographic relief, the USGS geologic map, and THEMIS day + night thermal infrared imagery.
- Search the configured named features or enter latitude and longitude as `lat, lon`.
- Browse famous spots grouped into craters, mountains, valleys, plains and basins, plateaus, and polar regions.
- Use **Share** to copy a URL for the current view, or **Full Mars** to fit the whole planet while keeping the focus marker visible.
- Select two locations with **Go to**, then choose **Go** to calculate and display a least-cost route.

## Route planning model

The Python backend runs A* over an adaptive grid, with a minimum cell size of 1 km and a maximum of about 200,000 cells. It requests numeric MOLA/HRSC elevation from NASA Mars Trek, derives slope and 3×3-cell elevation roughness, and requests numeric TES thermal inertia from ASU. Cells steeper than 20° are treated as impassable. The other cost terms follow the example in `safe.md`; roughness and thermal inertia are normalized to the 5th–95th percentiles within the search area. If the ASU thermal-inertia service is unavailable, the route is calculated from MOLA data only and the UI reports that.

Optical boulder detection, thermal cold/time-of-day cost, radiation exposure, and subsurface hazards are not scored because the current map sources do not expose those values as suitable numeric route grids. The result is a planning estimate, not a guarantee of safety. Data services: [NASA Mars Trek MOLA/HRSC DEM](https://trek.nasa.gov/mars/trekarcgis/rest/services/Mars_MOLA_blend200ppx_HRSC_DEM_clon0dd_200mpp_lzw/ImageServer), [ASU TES thermal inertia](https://mars.asu.edu/data/tes_ti/).

The optical, topographic, thermal, and geologic styles use the same Leaflet map center and zoom. The site is an independent viewer and is not an official NASA product. Map data is served by [NASA Mars Trek](https://trek.nasa.gov/mars/), the [USGS Geologic Map of Mars](https://usgs.maps.arcgis.com/apps/webappviewer/index.html?id=fc004c3d21b64c398ed5458580ab7c58), and [ASU THEMIS](https://global-data.mars.asu.edu/bin/themis.pl).
