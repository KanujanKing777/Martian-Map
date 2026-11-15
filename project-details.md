# Mars Atlas — Project Details

## Overview

Mars Atlas is an interactive Mars exploration and mission-planning application centered on Jezero Crater. It brings planetary-scale map data, rover-level surface imagery, experiment targets, and terrain-aware route planning into one browser-based experience.

## What the app does

- **Explore the planet:** Pan and zoom a Leaflet map and switch among Optical, Topographic, Geophysical (USGS geologic), and THEMIS day-and-night Thermal layers. The map keeps its center and zoom when the user changes layers.
- **Find places:** Search named Martian features or enter latitude and longitude. The app also includes quick access to notable locations, a focus marker, coordinate readout, and shareable map views.
- **View Jezero from the surface:** An open, Street View-like perspective gives a closer view of Jezero Crater. It is assembled by stitching images supplied by NASA's Perseverance rover, connecting orbital map context to imagery captured on the ground.
- **Browse experiments:** The Missions panel presents eight proposed experiments with their regions, protocols, rationales, and twelve listed target sites. A target's Go to control starts a route from the current map center.
- **Plan a traverse:** Users can choose both endpoints with Go to or route from the current map center to a Missions target. The Python service runs A* over an adaptive terrain grid and draws the resulting least-cost path above the map. It uses NASA MOLA/HRSC elevation to derive slope and local roughness, and ASU TES thermal-inertia data when available. Slopes over 20 degrees are blocked. If TES data is unavailable, routing can continue with elevation data alone.

## Benefits and intended impact

The app helps users move from broad planetary context to specific places and possible traverses. It makes scientific targets easier to explore, gives mission concepts a geographic context, and demonstrates how terrain data can inform route planning. It is intended as an educational and exploratory planning tool, not as operational mission guidance.

## Tools and data

The frontend uses HTML, CSS, JavaScript, Leaflet, and Esri Leaflet. The local Python 3.10+ server uses Python's standard HTTP server, NumPy, and Rasterio for the route API and raster processing. Public data services include NASA Mars Trek, the USGS global geologic map of Mars, and Arizona State University's THEMIS and TES data. The application requires an internet connection to retrieve remote map and terrain data. No specialized hardware is required; it runs in a modern desktop or mobile browser.

## Creative approach and planning factors

The project combines map-layer comparison with a rover-image panorama, then links experiment locations to route planning. Design and implementation account for Mars coordinate conventions, consistent center and scale across layers, varying data coverage and resolution, computational limits on route-grid size, and the difference between available measurements and hazards the data cannot score. Optical boulder detection, radiation, temperature-at-time, and subsurface hazards are not included in the current route cost model. Routes are estimates and cannot guarantee safety. Mars Atlas is an independent project and is not an official NASA product.
