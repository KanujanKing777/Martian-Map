# Mars Atlas

Mars Atlas is an interactive Mars exploration and mission-planning application centered on Jezero Crater. It brings planetary-scale map data, rover-level surface imagery, experiment targets, and terrain-aware route planning into one browser-based experience. The map opens with an approximately **1,000 km-wide** view and **18.4° N, 77.5° E** marked.

## Run locally

Install Python 3.10 or newer, then run:

```sh
python -m pip install -r requirements.txt
python server.py
```

Open `http://127.0.0.1:8000`. The route API and public map data services require an internet connection. A static-only server such as VS Code Live Server does not provide the route API.

## Explore Mars

- Pan by dragging and zoom with the map buttons, mouse wheel, or touch gestures.
- Switch among Optical, Topographic, Geophysical (USGS geologic), and THEMIS day-and-night Thermal layers. The Leaflet map keeps its center and zoom when you switch layers.
- Search the configured named features or enter latitude and longitude as `lat, lon`.
- Browse famous spots grouped into craters, mountains, valleys, plains and basins, plateaus, and polar regions.
- Use the focus marker and coordinate readout to see where you are on Mars. Use **Share** to copy a URL for the current view or **Full Mars** to fit the whole planet while keeping the focus marker visible.
- Explore Jezero Crater from a Street View-like surface perspective. The app stitches images from NASA's Perseverance rover into a panorama that connects the orbital map with imagery captured on the ground.

## Missions and traverse planning

The **Missions** panel presents eight proposed experiments with their regions, protocols, rationales, and twelve listed target sites. Use a target's **Go to** control to start a route from the current map center. To choose both endpoints yourself, select two locations with **Go to**, then choose **Go**. The app draws the resulting least-cost path on the map.

## Route planning model

The Python backend runs A* over an adaptive grid, with a minimum cell size of 1 km and a maximum of about 200,000 cells. It requests numeric MOLA/HRSC elevation from NASA Mars Trek, derives slope and 3×3-cell elevation roughness, and requests numeric TES thermal inertia from ASU. Cells steeper than 20° are treated as impassable. The other cost terms follow the example in `safe.md`; roughness and thermal inertia are normalized to the 5th–95th percentiles within the search area. If the ASU thermal-inertia service is unavailable, the route is calculated from MOLA data only and the UI reports that.

The current data sources lack suitable numeric grids for scoring optical boulder detection, temperature at a given time of day, radiation exposure, and subsurface hazards. Treat each route as a planning estimate with no guarantee of safety. [NASA Mars Trek MOLA/HRSC DEM](https://trek.nasa.gov/mars/trekarcgis/rest/services/Mars_MOLA_blend200ppx_HRSC_DEM_clon0dd_200mpp_lzw/ImageServer) · [ASU TES thermal inertia](https://mars.asu.edu/data/tes_ti/)

## Benefits and intended impact

Mars Atlas helps users move from broad planetary context to specific places and possible traverses. It makes scientific targets easier to explore, gives mission concepts a geographic context, and demonstrates how terrain data can inform route planning. Its intended use is education and exploratory planning. Operational mission guidance is outside its scope.

## Tools and data

The frontend uses HTML, CSS, JavaScript, Leaflet, and Esri Leaflet. The local Python 3.10+ backend uses Python's standard HTTP server for the route API, NumPy for array processing, and Pillow for TIFF processing. A small built-in reader handles the VICAR image format used by the Arizona State University (ASU) TES service. The app runs in a modern desktop or mobile browser without specialized hardware.

NASA Mars Trek provides optical, topographic, and USGS SIM 3292 global geologic imagery through public ArcGIS services. ASU provides the THEMIS infrared composite and TES thermal-inertia data. [NASA Mars Trek](https://trek.nasa.gov/mars/) · [USGS Geologic Map of Mars](https://usgs.maps.arcgis.com/apps/webappviewer/index.html?id=fc004c3d21b64c398ed5458580ab7c58) · [ASU THEMIS](https://global-data.mars.asu.edu/bin/themis.pl)

## Design and planning considerations

The app combines map-layer comparison with a rover-image panorama and links experiment locations directly to route planning. Its design accounts for Mars coordinate conventions, consistent center and scale across layers, differences in data coverage and resolution, and computational limits on route-grid size. The route model scores hazards only where the available measurements support it.

Mars Atlas is an independent project. NASA's role is as a data and imagery provider.
