# Mars Atlas

An interactive Mars surface map that opens centered on Jezero Crater with an approximately **1,000 km-wide** view and **18.4° N, 77.5° E** marked. It uses NASA Mars Trek's public ArcGIS image services for optical and topographic imagery, the USGS ArcGIS web map for geologic imagery, and the ASU THEMIS composite service for day + night infrared imagery.

## Run locally

Open `index.html` through a local web server (for example, VS Code Live Server or `python -m http.server`). The map libraries and NASA data require an internet connection.

## Map controls

- Pan by dragging; zoom with the map buttons, mouse wheel, or touch gestures.
- Switch between optical imagery, topographic relief, the USGS geologic map, and THEMIS day + night thermal infrared imagery.
- Search the configured named features or enter latitude and longitude as `lat, lon`.
- Browse famous spots grouped into craters, mountains, valleys, plains and basins, plateaus, and polar regions.
- Use **Share** to copy a URL for the current view, or **Full Mars** to fit the whole planet while keeping the focus marker visible.

The USGS geologic map uses its published Robinson projection; Mars Atlas preserves the geographic center and carries an approximate map scale across imagery switches. Thermal imagery follows the Leaflet map center and zoom. The site is an independent viewer and is not an official NASA product. Map data is served by [NASA Mars Trek](https://trek.nasa.gov/mars/), the [USGS Geologic Map of Mars](https://usgs.maps.arcgis.com/apps/webappviewer/index.html?id=fc004c3d21b64c398ed5458580ab7c58), and [ASU THEMIS](https://global-data.mars.asu.edu/bin/themis.pl).
