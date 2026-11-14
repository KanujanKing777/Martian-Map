(function () {
  "use strict";

  const DEFAULT_ZOOM = 1;
  const INITIAL_VIEW_WIDTH_METERS = 1000000;
  const MARS_BOUNDS = [[-90, -180], [90, 180]];
  const SERVICES = "https://trek.nasa.gov/mars/trekarcgis/rest/services/";
  const THEMIS_COMPOSITE = "https://global-data.mars.asu.edu/bin/compositeRasterTHEMIS.pl";
  const THEMIS_RESOLUTIONS = [1.666667, 4, 8, 16, 32, 64];
  const USGS_WEBMAP_ID = "87e77dc5c7d94cc792c663394f31de78";
  const ROBINSON_EXTENT = {
    xmin: -9055144.3083,
    ymin: -4592776.3617,
    xmax: 9055144.3095,
    ymax: 4592776.3617
  };
  const ROBINSON_X = [1, 0.9986, 0.9954, 0.99, 0.9822, 0.973, 0.96, 0.9427, 0.9216, 0.8962, 0.8679, 0.835, 0.7986, 0.7597, 0.7186, 0.6732, 0.6213, 0.5722, 0.5322];
  const ROBINSON_Y = [0, 0.062, 0.124, 0.186, 0.248, 0.31, 0.372, 0.434, 0.4958, 0.5571, 0.6176, 0.6769, 0.7346, 0.7903, 0.8435, 0.8936, 0.9394, 0.9761, 1];
  const LOCATIONS = {
  // Major craters
  jezero: {
    category: "Craters",
    name: "Jezero Crater",
    region: "Isidis Planitia",
    lat: 18.4,
    lon: 77.5,
    zoom: 7
  },
  gale: {
    category: "Craters",
    name: "Gale Crater",
    region: "Aeolis quadrangle",
    lat: -5.4,
    lon: 137.8,
    zoom: 7
  },
  endeavouR: {
    category: "Craters",
    name: "Endeavour Crater",
    region: "Meridiani Planum",
    lat: -2.28,
    lon: -5.2,
    zoom: 8
  },
  victoria: {
    category: "Craters",
    name: "Victoria Crater",
    region: "Meridiani Planum",
    lat: -2.05,
    lon: -5.5,
    zoom: 8
  },
  gale: {
    category: "Craters",
    name: "Gale Crater",
    region: "Aeolis quadrangle",
    lat: -5.4,
    lon: 137.8,
    zoom: 7
  },

  // Major volcanoes
  olympus: {
    category: "Mountains",
    name: "Olympus Mons",
    region: "Tharsis",
    lat: 18.65,
    lon: -133.8,
    zoom: 5
  },
  arsia: {
    category: "Mountains",
    name: "Arsia Mons",
    region: "Tharsis",
    lat: -8.26,
    lon: -120.09,
    zoom: 6
  },
  pavonis: {
    category: "Mountains",
    name: "Pavonis Mons",
    region: "Tharsis",
    lat: 1.48,
    lon: -112.96,
    zoom: 6
  },

  // Canyons and valleys
  valles: {
    category: "Valleys",
    name: "Valles Marineris",
    region: "The equatorial canyon system",
    lat: -13.9,
    lon: -59.2,
    zoom: 4
  },
  candor: {
    category: "Valleys",
    name: "Candor Chasma",
    region: "Valles Marineris",
    lat: -6.5,
    lon: -70.78,
    zoom: 7
  },
  // Major plains and basins
  hellas: {
    category: "Plains & basins",
    name: "Hellas Planitia",
    region: "Hellas",
    lat: -42.43,
    lon: 70.50,
    zoom: 4
  },
  argyre: {
    category: "Plains & basins",
    name: "Argyre Planitia",
    region: "Southern Highlands",
    lat: -49.84,
    lon: -43.31,
    zoom: 4
  },
  utopia: {
    category: "Plains & basins",
    name: "Utopia Planitia",
    region: "Northern lowlands",
    lat: 46.74,
    lon: 117.52,
    zoom: 4
  },

  // Other notable geological regions
  syrtisMajor: {
    category: "Plateaus & regions",
    name: "Syrtis Major Planum",
    region: "Syrtis Major",
    lat: 9.2,
    lon: 67.1,
    zoom: 5
  },
  // Polar regions
  northPolar: {
    category: "Polar regions",
    name: "Planum Boreum",
    region: "Northern polar region",
    lat: 85,
    lon: 0,
    zoom: 4
  },
  southPolar: {
    category: "Polar regions",
    name: "Planum Australe",
    region: "Southern polar region",
    lat: -85,
    lon: 0,
    zoom: 4
  }


  };
  const ORIGIN = LOCATIONS.jezero;
  const SEARCHABLE_PLACES = Object.keys(LOCATIONS).map(function (key) {
    return Object.assign({ key: key }, LOCATIONS[key]);
  });
  const IMAGERY = {
    viking: SERVICES + "Mars_Viking_MDIM21_ClrMosaic_global_232m/ImageServer",
    relief: SERVICES + "Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp/ImageServer"
  };
  const byId = function (id) { return document.getElementById(id); };
  const mapError = byId("map-error");
  const mapElement = byId("map");
  const geologicMapElement = byId("geologic-map");
  const toastElement = byId("toast");
  let map;
  let baseLayer;
  let thermalLayer;
  let geologicView;
  let arcGISScriptPromise;
  let arcGISModulesPromise;
  let geologicLoadPromise;
  let savedLeafletState;
  let pendingFullMars;
  let ArcGISGraphic;
  let ArcGISPoint;
  let ArcGISScaleBar;
  let geologicFocusGraphic;
  let activeImagery = "viking";
  let toastTimer;
  let focusMarker;
  let activeCoordinates = { lat: ORIGIN.lat, lon: ORIGIN.lon };

  function formatCoordinate(value, axis) {
    const direction = axis === "lat"
      ? (value >= 0 ? "N" : "S")
      : (value >= 0 ? "E" : "W");
    return Math.abs(value).toFixed(4) + "° " + direction;
  }

  function escapeHtml(value) {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
    return value.replace(/[&<>"']/g, function (character) { return entities[character]; });
  }

  function zoomForGroundWidth(latitude, widthMeters, viewportWidth) {
    const metersPerDegree = 3396190 * Math.cos(latitude * Math.PI / 180) * Math.PI / 180;
    const worldScale = viewportWidth * 180 * metersPerDegree / (256 * widthMeters);
    return Math.max(-1, Math.min(11, Math.log2(worldScale)));
  }

  function interpolateRobinson(table, latitude) {
    const position = Math.min(18, Math.abs(latitude) / 5);
    const index = Math.min(17, Math.floor(position));
    const fraction = position - index;
    return table[index] + (table[index + 1] - table[index]) * fraction;
  }

  function projectRobinson(latitude, longitude) {
    const radius = 3396190;
    const absoluteLatitude = Math.min(90, Math.abs(latitude));
    return {
      x: 0.8487 * radius * longitude * Math.PI / 180 *
        interpolateRobinson(ROBINSON_X, absoluteLatitude),
      y: (latitude < 0 ? -1 : 1) * 1.3523 * radius *
        interpolateRobinson(ROBINSON_Y, absoluteLatitude)
    };
  }

  function unprojectRobinson(x, y) {
    const radius = 3396190;
    const normalizedY = Math.min(1, Math.abs(y) / (1.3523 * radius));
    let index = 0;
    while (index < ROBINSON_Y.length - 2 && ROBINSON_Y[index + 1] < normalizedY) {
      index += 1;
    }
    const range = ROBINSON_Y[index + 1] - ROBINSON_Y[index];
    const fraction = range === 0 ? 0 : (normalizedY - ROBINSON_Y[index]) / range;
    const absoluteLatitude = (index + fraction) * 5;
    const longitude = x / (
      0.8487 * radius * interpolateRobinson(ROBINSON_X, absoluteLatitude)
    ) * 180 / Math.PI;
    return {
      lat: (y < 0 ? -1 : 1) * absoluteLatitude,
      lon: Math.max(-180, Math.min(180, longitude))
    };
  }

  function groundWidthForZoom(latitude, zoom, viewportWidth) {
    const metersPerDegree = 3396190 * Math.max(0.000001, Math.cos(latitude * Math.PI / 180)) *
      Math.PI / 180;
    return viewportWidth * 180 * metersPerDegree / (256 * Math.pow(2, zoom));
  }

  function mapViewportWidth() {
    const leafletWidth = map ? map.getSize().x : 0;
    const geologicWidth = geologicMapElement.clientWidth;
    return Math.max(1, activeImagery === "geologic"
      ? geologicWidth || leafletWidth || mapElement.clientWidth
      : leafletWidth || mapElement.clientWidth);
  }

  function currentLeafletGroundWidth() {
    const size = map.getSize();
    const center = map.getCenter();
    const first = map.containerPointToLatLng([0, size.y / 2]);
    const last = map.containerPointToLatLng([size.x, size.y / 2]);
    const longitudeSpan = Math.abs(last.lng - first.lng);
    return 3396190 * Math.max(0.000001, Math.cos(center.lat * Math.PI / 180)) *
      longitudeSpan * Math.PI / 180;
  }

  function geologicGroundWidth(view) {
    const center = unprojectRobinson(view.center.x, view.center.y);
    return Math.abs(view.extent.xmax - view.extent.xmin) *
      Math.max(0.000001, Math.cos(center.lat * Math.PI / 180)) /
      (0.8487 * interpolateRobinson(ROBINSON_X, center.lat));
  }

  function fitGeologicGroundWidth(view, widthMeters) {
    const currentWidth = geologicGroundWidth(view);
    if (!Number.isFinite(widthMeters) || widthMeters <= 0 ||
        !Number.isFinite(currentWidth) || currentWidth <= 0 ||
        !Number.isFinite(view.scale)) {
      return Promise.reject(new Error("Cannot calculate the requested Mars map width."));
    }
    return view.goTo({
      scale: view.scale * widthMeters / currentWidth
    }, { animate: false });
  }

  function getCurrentMapState() {
    if (activeImagery === "geologic" && geologicView && geologicView.center &&
        geologicView.extent && Number.isFinite(geologicView.scale)) {
      const center = unprojectRobinson(geologicView.center.x, geologicView.center.y);
      const widthMeters = geologicGroundWidth(geologicView);
      return {
        lat: center.lat,
        lon: center.lon,
        zoom: zoomForGroundWidth(center.lat, widthMeters, mapViewportWidth()),
        widthMeters: widthMeters
      };
    }
    if (activeImagery === "geologic" && savedLeafletState) {
      return savedLeafletState;
    }
    const center = map.getCenter();
    return {
      lat: center.lat,
      lon: center.lng,
      zoom: map.getZoom(),
      widthMeters: currentLeafletGroundWidth()
    };
  }

  function loadArcGISModules() {
    if (arcGISModulesPromise) return arcGISModulesPromise;
    if (!window.require && !arcGISScriptPromise) {
      arcGISScriptPromise = new Promise(function (resolve, reject) {
        const script = document.createElement("script");
        script.src = "https://js.arcgis.com/4.32/";
        script.async = true;
        script.onload = resolve;
        script.onerror = function () {
          script.remove();
          arcGISScriptPromise = null;
          reject(new Error("The ArcGIS Maps SDK did not load."));
        };
        document.head.appendChild(script);
      });
    }
    const sdkLoaded = window.require ? Promise.resolve() : arcGISScriptPromise;
    arcGISModulesPromise = sdkLoaded.then(function () {
      return new Promise(function (resolve, reject) {
        if (!window.require) {
          reject(new Error("The ArcGIS Maps SDK did not initialize."));
          return;
        }
        window.require(
          [
            "esri/WebMap",
            "esri/views/MapView",
            "esri/Graphic",
            "esri/geometry/Point",
            "esri/widgets/ScaleBar"
          ],
          function (WebMap, MapView, Graphic, Point, ScaleBar) {
            ArcGISGraphic = Graphic;
            ArcGISPoint = Point;
            ArcGISScaleBar = ScaleBar;
            resolve({ WebMap: WebMap, MapView: MapView });
          },
          reject
        );
      });
    }).catch(function (error) {
      arcGISModulesPromise = null;
      throw error;
    });
    return arcGISModulesPromise;
  }

  function updateGeologicFocus() {
    if (!geologicView || !geologicView.ready || !geologicView.spatialReference || !ArcGISGraphic) return;
    const projected = projectRobinson(activeCoordinates.lat, activeCoordinates.lon);
    if (geologicFocusGraphic) geologicView.graphics.remove(geologicFocusGraphic);
    geologicFocusGraphic = new ArcGISGraphic({
      geometry: new ArcGISPoint({
        x: projected.x,
        y: projected.y,
        spatialReference: geologicView.spatialReference
      }),
      symbol: {
        type: "simple-marker",
        style: "circle",
        color: [229, 108, 67, 1],
        size: 10,
        outline: { color: [255, 230, 216, 1], width: 1.5 }
      }
    });
    geologicView.graphics.add(geologicFocusGraphic);
  }

  function watchGeologicPointer(view) {
    view.on("pointer-move", function (event) {
      const point = view.toMap({ x: event.x, y: event.y });
      if (!point) return;
      const coordinates = unprojectRobinson(point.x, point.y);
      byId("pointer-coordinates").textContent =
        formatCoordinate(coordinates.lat, "lat") + "   " +
        formatCoordinate(coordinates.lon, "lon");
    });
    view.on("pointer-leave", function () {
      byId("pointer-coordinates").textContent = "—";
    });
  }

  function ensureGeologicView() {
    if (geologicLoadPromise) return geologicLoadPromise;
    if (geologicView) return Promise.resolve(geologicView);
    geologicLoadPromise = loadArcGISModules().then(function (modules) {
      const webMap = new modules.WebMap({
        portalItem: { id: USGS_WEBMAP_ID }
      });
      geologicView = new modules.MapView({
        container: geologicMapElement,
        map: webMap
      });
      watchGeologicPointer(geologicView);
      return geologicView.when().then(function () {
        geologicView.ui.components = [];
        geologicView.ui.add(new ArcGISScaleBar({
          view: geologicView,
          unit: "metric"
        }), "bottom-left");
        geologicView.constraints.snapToZoom = false;
        geologicView.constraints.maxScale = 0;
        return geologicView;
      });
    }).then(function () {
      updateGeologicFocus();
      return geologicView;
    }).catch(function (error) {
      geologicLoadPromise = null;
      if (geologicView) {
        geologicView.destroy();
        geologicView = null;
      }
      throw error;
    });
    return geologicLoadPromise;
  }

  function showMapError(message) {
    const errorText = byId("map-error-message");
    if (errorText) errorText.textContent = message;
    mapError.hidden = false;
  }

  function thermalRasterUrl() {
    const center = map.getCenter();
    const size = map.getSize();
    const longitude = ((center.lng % 360) + 360) % 360;
    const targetScale = 256 * Math.pow(2, map.getZoom()) / 180;
    const supportedScale = THEMIS_RESOLUTIONS.reduce(function (selected, resolution) {
      return resolution <= targetScale ? resolution : selected;
    }, THEMIS_RESOLUTIONS[0]);
    const dimensionScale = supportedScale / targetScale;
    const query = new URLSearchParams({
      scale: String(supportedScale),
      lat: String(center.lat),
      lon: String(longitude),
      bg: "2",
      dn: "2",
      fg: "1",
      rel: "2",
      wh: String(Math.max(1, Math.round(size.y * dimensionScale))),
      ww: String(Math.max(1, Math.round(size.x * dimensionScale))),
      bdr: "0",
      public: "1",
      col: "3b7aa6"
    });
    return THEMIS_COMPOSITE + "?" + query.toString();
  }

  function refreshThermalLayer() {
    if (!map || activeImagery !== "thermal") return;
    const url = thermalRasterUrl();
    const bounds = map.getBounds();
    if (!thermalLayer) {
      thermalLayer = L.imageOverlay(url, bounds, {
        opacity: 1,
        interactive: false,
        attribution: "THEMIS infrared: Arizona State University / NASA"
      });
      thermalLayer.on("load", function () {
        if (activeImagery === "thermal") mapError.hidden = true;
      });
      thermalLayer.on("error", function () {
        if (activeImagery === "thermal") {
          showMapError("THEMIS could not load thermal imagery. Check your connection and try again.");
        }
      });
      thermalLayer.addTo(map);
    } else {
      thermalLayer.setBounds(bounds);
      thermalLayer.setUrl(url);
      if (!map.hasLayer(thermalLayer)) thermalLayer.addTo(map);
    }
    baseLayer = thermalLayer;
  }

  function openGeologicMap() {
    const savedState = activeImagery === "geologic"
      ? (geologicView && geologicView.ready ? null : savedLeafletState)
      : getCurrentMapState();
    if (savedState) savedLeafletState = savedState;
    if (activeImagery !== "geologic" && baseLayer) {
      map.removeLayer(baseLayer);
      baseLayer = null;
    }
    activeImagery = "geologic";
    byId("map-source").textContent = "USGS GEOLOGIC";
    byId("coordinate-system").textContent = "MARS 2000 · ROBINSON";
    mapError.hidden = true;
    byId("geologic-loading").hidden = false;
    mapElement.hidden = true;
    geologicMapElement.hidden = false;

    return ensureGeologicView().then(function (view) {
      if (activeImagery !== "geologic") return;
      byId("geologic-loading").hidden = true;
      view.resize();
      if (pendingFullMars) {
        pendingFullMars = false;
        return view.goTo({
          target: Object.assign({}, ROBINSON_EXTENT, {
            spatialReference: view.spatialReference
          })
        }, { duration: 700 }).then(updateGeologicFocus);
      }
      if (savedState) {
        const currentState = savedLeafletState || savedState;
        const projected = projectRobinson(currentState.lat, currentState.lon);
        return view.goTo({
          center: new ArcGISPoint({
            x: projected.x,
            y: projected.y,
            spatialReference: view.spatialReference
          })
        }, { animate: false }).then(function () {
          return fitGeologicGroundWidth(view, currentState.widthMeters);
        }).then(function () {
          if (savedLeafletState) savedLeafletState.widthMeters = geologicGroundWidth(view);
          updateGeologicFocus();
        });
      }
      updateGeologicFocus();
    }).catch(function (error) {
      if (activeImagery !== "geologic") return;
      byId("geologic-loading").hidden = true;
      if (error.name !== "AbortError") {
        console.error("Could not load the USGS Mars geologic map.", error);
      }
    });
  }

  function changeMapZoom(delta) {
    if (activeImagery === "geologic") {
      if (geologicView && geologicView.ready && Number.isFinite(geologicView.scale)) {
        geologicView.scale *= Math.pow(2, -delta);
      } else if (savedLeafletState) {
        savedLeafletState.zoom = Math.max(-1, Math.min(11, savedLeafletState.zoom + delta));
        savedLeafletState.widthMeters = groundWidthForZoom(
          savedLeafletState.lat,
          savedLeafletState.zoom,
          mapViewportWidth()
        );
      }
      return;
    }
    if (delta > 0) map.zoomIn();
    else map.zoomOut();
  }

  function showToast(message) {
    toastElement.textContent = message;
    toastElement.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastElement.classList.remove("is-visible");
    }, 2400);
  }

  function setFocus(lat, lon, name, region, zoom, preserveView, locationKey) {
    const latLng = L.latLng(lat, lon);
    activeCoordinates = { lat: lat, lon: lon };
    byId("focus-title").textContent = name;
    byId("focus-coordinates").innerHTML =
      formatCoordinate(lat, "lat") + " <span>·</span> " + formatCoordinate(lon, "lon");
    byId("map-place-title").textContent = name;
    byId("map-region-title").textContent = region;
    document.querySelectorAll(".location-row").forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.location === locationKey);
    });
    const icon = L.divIcon({
      className: "focus-marker",
      html: "<span></span><i>" + escapeHtml(name) + "</i>",
      iconSize: [1, 1],
      iconAnchor: [0, 0]
    });
    if (focusMarker) {
      focusMarker.setLatLng(latLng);
      focusMarker.setIcon(icon);
    } else {
      focusMarker = L.marker(latLng, {
        interactive: false,
        keyboard: false,
        icon: icon,
        zIndexOffset: 500
      }).addTo(map);
    }
    updateGeologicFocus();
    if (!preserveView) {
      if (activeImagery === "geologic" && geologicView &&
          Number.isFinite(geologicView.scale)) {
        const projected = projectRobinson(lat, lon);
        const targetZoom = zoom || DEFAULT_ZOOM;
        const targetWidth = groundWidthForZoom(lat, targetZoom, mapViewportWidth());
        geologicView.goTo({
          center: new ArcGISPoint({
            x: projected.x,
            y: projected.y,
            spatialReference: geologicView.spatialReference
          })
        }, { duration: 700 }).then(function () {
          return fitGeologicGroundWidth(geologicView, targetWidth);
        }).then(function () {
          savedLeafletState = {
            lat: lat,
            lon: lon,
            zoom: targetZoom,
            widthMeters: geologicGroundWidth(geologicView)
          };
        }, function (error) {
          if (error.name !== "AbortError") showToast("Could not move to that location");
        });
      } else if (activeImagery === "geologic") {
        savedLeafletState = {
          lat: lat,
          lon: lon,
          zoom: zoom || DEFAULT_ZOOM,
          widthMeters: groundWidthForZoom(
            lat,
            zoom || DEFAULT_ZOOM,
            mapViewportWidth()
          )
        };
      } else {
        map.flyTo(latLng, zoom || DEFAULT_ZOOM, { duration: 0.7 });
      }
    }
  }

  function replaceBaseLayer(key) {
    if (key === "geologic") {
      openGeologicMap();
      return;
    }
    if (activeImagery === "geologic") {
      const fullMarsPending = pendingFullMars;
      const savedState = !fullMarsPending && geologicView && Number.isFinite(geologicView.scale)
        ? getCurrentMapState()
        : (!fullMarsPending ? savedLeafletState : null);
      geologicMapElement.hidden = true;
      mapElement.hidden = false;
      map.invalidateSize({ pan: false });
      if (fullMarsPending) {
        pendingFullMars = false;
        map.fitBounds(MARS_BOUNDS, { padding: [28, 28] });
      } else if (savedState) {
        const zoom = key === "thermal"
          ? savedState.zoom
          : zoomForGroundWidth(savedState.lat, savedState.widthMeters, map.getSize().x);
        map.setView([savedState.lat, savedState.lon], zoom, { animate: false });
      }
    }
    activeImagery = key;
    if (key === "thermal") {
      byId("map-source").textContent = "ASU THEMIS · DAY + NIGHT IR";
      byId("coordinate-system").textContent = "MARS 2000 · EQUIRECTANGULAR";
      mapError.hidden = true;
      if (baseLayer) {
        map.removeLayer(baseLayer);
        baseLayer = null;
      }
      refreshThermalLayer();
      return;
    }
    byId("map-source").textContent = "NASA TREK DATA";
    byId("coordinate-system").textContent = "MARS 2000 · EQUIRECTANGULAR";
    const next = L.esri.imageMapLayer({
      url: IMAGERY[key],
      opacity: 1,
      useCors: false,
      attribution: "Imagery: NASA Mars Trek / USGS"
    });
    next.on("load", function () {
      if (key === activeImagery) mapError.hidden = true;
    });
    next.on("error", function () {
      if (key === activeImagery) {
        showMapError("NASA Trek could not load the imagery. Check your connection and try again.");
      }
    });
    if (baseLayer) map.removeLayer(baseLayer);
    baseLayer = next.addTo(map);
  }

  function createMap() {
    if (!window.L || !L.esri) {
      mapError.hidden = false;
      return;
    }

    const marsCRS = L.extend({}, L.CRS.EPSG4326, {
      code: "EPSG:104905",
      distance: function (first, second) {
        const toRadians = Math.PI / 180;
        const lat1 = first.lat * toRadians;
        const lat2 = second.lat * toRadians;
        const deltaLat = (second.lat - first.lat) * toRadians;
        const deltaLon = (second.lng - first.lng) * toRadians;
        const haversine = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
          Math.cos(lat1) * Math.cos(lat2) *
          Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        return 3396190 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
      }
    });
    const query = new URLSearchParams(window.location.search);
    const latitudeParam = query.get("lat");
    const longitudeParam = query.get("lon");
    const zoomParam = query.get("zoom");
    const lat = latitudeParam === null ? NaN : Number(latitudeParam);
    const lon = longitudeParam === null ? NaN : Number(longitudeParam);
    const zoom = zoomParam === null ? NaN : Number(zoomParam);
    const hasSharedView = latitudeParam !== null && latitudeParam.trim() !== "" &&
      longitudeParam !== null && longitudeParam.trim() !== "" &&
      Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
      Number.isFinite(lon) && lon >= -180 && lon <= 180;
    const hasSharedZoom = zoomParam !== null && zoomParam.trim() !== "" && Number.isFinite(zoom);
    const initialZoom = hasSharedView && hasSharedZoom
      ? Math.max(-1, Math.min(10, zoom))
      : zoomForGroundWidth(ORIGIN.lat, INITIAL_VIEW_WIDTH_METERS, mapElement.clientWidth);
    map = L.map(mapElement, {
      crs: marsCRS,
      center: hasSharedView ? [lat, lon] : [ORIGIN.lat, ORIGIN.lon],
      zoom: initialZoom,
      minZoom: -1,
      maxZoom: 11,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: true,
      maxBounds: MARS_BOUNDS,
      maxBoundsViscosity: 0.6
    });

    L.control.scale({ position: "bottomleft", imperial: false, maxWidth: 130 }).addTo(map);
    replaceBaseLayer("viking");

    const startPoint = hasSharedView
      ? { lat: lat, lon: lon, name: "Map center", region: "Custom coordinates" }
      : LOCATIONS.jezero;
    renderLocationList();
    setFocus(
      startPoint.lat,
      startPoint.lon,
      startPoint.name,
      startPoint.region,
      DEFAULT_ZOOM,
      true,
      hasSharedView ? null : "jezero"
    );

    map.on("mousemove", function (event) {
      byId("pointer-coordinates").textContent =
        formatCoordinate(event.latlng.lat, "lat") + "   " +
        formatCoordinate(event.latlng.lng, "lon");
    });
    map.on("mouseout", function () {
      byId("pointer-coordinates").textContent = "—";
    });
    map.on("tileerror", function () {
      if (activeImagery !== "geologic") {
        showMapError("NASA Trek could not load the imagery. Check your connection and try again.");
      }
    });
    map.on("moveend resize", refreshThermalLayer);

    document.querySelectorAll(".imagery-option").forEach(function (button) {
      button.addEventListener("click", function () {
        document.querySelectorAll(".imagery-option").forEach(function (option) {
          const selected = option === button;
          option.classList.toggle("is-selected", selected);
          option.setAttribute("aria-pressed", String(selected));
        });
        replaceBaseLayer(button.dataset.imagery);
      });
    });

    byId("reset-view").addEventListener("click", function () {
      setFocus(ORIGIN.lat, ORIGIN.lon, LOCATIONS.jezero.name, LOCATIONS.jezero.region, DEFAULT_ZOOM, true, "jezero");
      if (activeImagery === "geologic" && geologicView && geologicView.ready) {
        geologicView.goTo({
          target: Object.assign({}, ROBINSON_EXTENT, {
            spatialReference: geologicView.spatialReference
          })
        }, { duration: 700 }).catch(function (error) {
          if (error.name !== "AbortError") showToast("Could not fit the full Mars map");
        });
      } else if (activeImagery === "geologic") {
        pendingFullMars = true;
      } else {
        map.fitBounds(MARS_BOUNDS, { padding: [28, 28] });
      }
    });

    byId("search-form").addEventListener("submit", function (event) {
      event.preventDefault();
      searchLocation(byId("place-search").value);
    });
    byId("place-search").addEventListener("input", updateSearchResults);
    byId("place-search").addEventListener("focus", updateSearchResults);
    document.addEventListener("click", function (event) {
      if (!event.target.closest(".search-form")) byId("search-results").hidden = true;
    });

    byId("copy-coordinates").addEventListener("click", function () {
      const text = activeCoordinates.lat.toFixed(4) + ", " + activeCoordinates.lon.toFixed(4);
      copyText(text, "Focus coordinates copied");
    });
    byId("share-view").addEventListener("click", shareCurrentView);
    byId("fullscreen-map").addEventListener("click", toggleFullscreen);
    byId("zoom-in").addEventListener("click", function () { changeMapZoom(1); });
    byId("zoom-out").addEventListener("click", function () { changeMapZoom(-1); });
    byId("retry-map").addEventListener("click", function () {
      mapError.hidden = true;
      if (activeImagery === "geologic" && geologicView) {
        geologicView.map.load().then(function () {
          return geologicView.when();
        }).then(function () {
          mapError.hidden = true;
        }).catch(function (error) {
          if (error.name !== "AbortError") {
            console.error("Could not reload the USGS Mars geologic map.", error);
          }
        });
      } else if (activeImagery === "geologic") {
        openGeologicMap();
      } else {
        replaceBaseLayer(activeImagery);
      }
    });

    addMobileControl();
    window.setTimeout(function () { map.invalidateSize(); }, 0);
  }

  function updateSearchResults() {
    const input = byId("place-search");
    const results = byId("search-results");
    const value = input.value.trim().toLowerCase();
    if (!value) {
      results.hidden = true;
      return;
    }
    const matches = SEARCHABLE_PLACES.filter(function (place) {
      return place.name.toLowerCase().includes(value);
    }).slice(0, 4);
    results.replaceChildren();
    matches.forEach(function (place) {
      const button = document.createElement("button");
      button.className = "search-result";
      button.type = "button";
      button.setAttribute("role", "option");
      button.innerHTML = "<strong></strong><small></small>";
      button.querySelector("strong").textContent = place.name;
      button.querySelector("small").textContent =
        place.category + " · " + formatCoordinate(place.lat, "lat") + " " + formatCoordinate(place.lon, "lon");
      button.addEventListener("click", function () {
        goToPlace(place);
      });
      results.appendChild(button);
    });
    results.hidden = matches.length === 0;
  }

  function renderLocationList() {
    const list = byId("location-list");
    list.replaceChildren();
    const groups = Object.create(null);
    SEARCHABLE_PLACES.forEach(function (place) {
      const category = place.category || "Other features";
      if (!groups[category]) groups[category] = [];
      groups[category].push(place);
    });

    Object.keys(groups).forEach(function (category) {
      const group = document.createElement("section");
      group.className = "location-group";
      group.setAttribute("aria-label", category);

      const heading = document.createElement("h3");
      heading.className = "location-group-title";
      heading.textContent = category;

      const locationRows = document.createElement("div");
      locationRows.className = "location-group-list";
      group.append(heading, locationRows);
      list.appendChild(group);

      groups[category].forEach(function (place) {
        const button = document.createElement("button");
        button.className = "location-row";
        button.dataset.location = place.key;
        button.type = "button";
        button.setAttribute(
          "aria-label",
          place.name + ", " + formatCoordinate(place.lat, "lat") + ", " + formatCoordinate(place.lon, "lon")
        );

        const marker = document.createElement("span");
        marker.className = "location-marker";
        marker.setAttribute("aria-hidden", "true");

        const name = document.createElement("span");
        name.className = "location-name";
        name.textContent = place.name;

        const coordinate = document.createElement("span");
        coordinate.className = "location-coord";
        coordinate.textContent = Math.abs(place.lat).toFixed(1) + "°" + (place.lat >= 0 ? "N" : "S");

        const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        arrow.setAttribute("viewBox", "0 0 24 24");
        arrow.setAttribute("aria-hidden", "true");
        const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        arrowPath.setAttribute("d", "m9 18 6-6-6-6");
        arrow.appendChild(arrowPath);

        button.append(marker, name, coordinate, arrow);
        button.addEventListener("click", function () {
          goToPlace(place);
          closeMobileSidebar();
        });
        locationRows.appendChild(button);
      });
    });
  }

  function searchLocation(rawValue) {
    const value = rawValue.trim();
    if (!value) return;
    const coordinates = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coordinates) {
      const lat = Number(coordinates[1]);
      const lon = Number(coordinates[2]);
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        showToast("Enter latitude from −90 to 90 and longitude from −180 to 180");
        return;
      }
      setFocus(lat, lon, "Map center", "Custom coordinates", 7);
      byId("search-results").hidden = true;
      byId("place-search").value = "";
      closeMobileSidebar();
      return;
    }
    const match = SEARCHABLE_PLACES.find(function (place) {
      return place.name.toLowerCase() === value.toLowerCase();
    });
    if (match) {
      goToPlace(match);
      return;
    }
    updateSearchResults();
    showToast("Search a listed place or enter latitude, longitude");
  }

  function goToPlace(place) {
    setFocus(place.lat, place.lon, place.name, place.region, place.zoom, false, place.key);
    byId("search-results").hidden = true;
    byId("place-search").value = "";
    closeMobileSidebar();
  }

  function copyText(text, message) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      showToast("Clipboard access is unavailable in this browser");
      return;
    }
    navigator.clipboard.writeText(text).then(function () {
      showToast(message);
    }).catch(function () {
      showToast("Could not copy to clipboard");
    });
  }

  function shareCurrentView() {
    const viewState = getCurrentMapState();
    const url = new URL(window.location.href);
    url.searchParams.set("lat", viewState.lat.toFixed(4));
    url.searchParams.set("lon", viewState.lon.toFixed(4));
    url.searchParams.set("zoom", viewState.zoom.toFixed(1));
    copyText(url.toString(), "Map link copied");
  }

  function toggleFullscreen() {
    const target = document.querySelector(".map-stage");
    if (!document.fullscreenElement) {
      if (target.requestFullscreen) {
        target.requestFullscreen().then(function () {
          map.invalidateSize();
          if (geologicView) geologicView.resize();
        }).catch(function () {
          showToast("Full screen is unavailable");
        });
      } else {
        showToast("Full screen is unavailable in this browser");
      }
    } else if (document.exitFullscreen) {
      document.exitFullscreen().then(function () {
        map.invalidateSize();
        if (geologicView) geologicView.resize();
      });
    }
  }

  function addMobileControl() {
    const button = document.createElement("button");
    button.className = "mobile-controls";
    button.type = "button";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "map-controls");
    button.innerHTML = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 6h16M4 12h16M4 18h16\"/></svg><span>Map controls</span>";
    document.querySelector(".sidebar").id = "map-controls";
    mapElement.parentElement.appendChild(button);
    button.addEventListener("click", function () {
      const sidebar = document.querySelector(".sidebar");
      const open = sidebar.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(open));
      button.innerHTML = open
        ? "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m6 6 12 12M18 6 6 18\"/></svg><span>Close controls</span>"
        : "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 6h16M4 12h16M4 18h16\"/></svg><span>Map controls</span>";
    });
  }

  function closeMobileSidebar() {
    if (window.innerWidth > 680) return;
    const sidebar = document.querySelector(".sidebar");
    const button = document.querySelector(".mobile-controls");
    sidebar.classList.remove("is-open");
    if (button) {
      button.setAttribute("aria-expanded", "false");
      button.innerHTML = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 6h16M4 12h16M4 18h16\"/></svg><span>Map controls</span>";
    }
  }

  document.addEventListener("DOMContentLoaded", createMap);
}());
