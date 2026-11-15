(function () {
  "use strict";

  const DEFAULT_ZOOM = 1;
  const INITIAL_VIEW_WIDTH_METERS = 1000000;
  const MARS_BOUNDS = [[-90, -180], [90, 180]];
  const SERVICES = "https://trek.nasa.gov/mars/trekarcgis/rest/services/";
  const GEOLOGIC_SERVICE = SERVICES + "SIM3292_Global_Geology/MapServer";
  const THEMIS_COMPOSITE = "https://global-data.mars.asu.edu/bin/compositeRasterTHEMIS.pl";
  const THEMIS_RESOLUTIONS = [1.666667, 4, 8, 16, 32, 64];
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
  const MISSIONS = [
    {
      title: "Subsurface Ice Mining & Purification",
      region: "Arcadia Planitia · Northern Lowlands",
      protocol: "Drill 1-2 meters through surface regolith to reach buried ice. Test thermal extraction and filtration systems that remove perchlorates for potable water and fuel.",
      rationale: "Shallow water ice beneath flat, low-elevation terrain makes this a candidate for heavy landings and in-situ resource use.",
      targets: [
        { name: "Candidate Site AP-1", lat: 39.800, lonEast: 202.100 },
        { name: "Alternate Site AP-9", lat: 40.024, lonEast: 203.331 }
      ]
    },
    {
      title: "Scaled-Up Rocket Fuel & Oxygen Production",
      region: "Arcadia Planitia · Northern Lowlands",
      protocol: "Run a high-capacity Sabatier reactor using extracted water and atmospheric CO2. Produce and liquefy methane and oxygen propellant for an Earth return.",
      rationale: "Co-locating fuel synthesis with shallow ice deposits reduces transport and tests closed-loop resource production.",
      targets: [
        { name: "Candidate Site AP-1", lat: 39.800, lonEast: 202.100 }
      ]
    },
    {
      title: "Regolith Sintering & Radiation Shielding",
      region: "Arcadia Planitia · Erebus Montes border",
      protocol: "Compact local soil into modular bags or microwave-sinter it into structural bricks. Measure shielding from galactic cosmic rays and solar particle events.",
      rationale: "Low elevation provides a thicker atmospheric column, while the area offers fine-grained basaltic regolith for construction tests.",
      targets: [
        { name: "Candidate Site EM-16", lat: 39.890, lonEast: 192.030 }
      ]
    },
    {
      title: "Deep Core Biosignature Drilling",
      region: "Jezero Crater · Western Isidis Planitia",
      protocol: "Extract intact rock cores 2-5 meters below the surface. Analyze shielded samples for complex amino acids, lipids, or microfossils.",
      rationale: "The ancient lakebed and river delta contain clay minerals, carbonates, and organic molecules that may preserve signs of past habitability.",
      targets: [
        { name: "Perseverance Landing Zone", lat: 18.4663, lonEast: 77.4298 },
        { name: "Delta Front Target", lat: 18.447, lonEast: 77.452 }
      ]
    },
    {
      title: "Perchlorate Soil Remediation & Agriculture",
      region: "Jezero Crater · Western Isidis Planitia",
      protocol: "Wash delta clays and introduce perchlorate-reducing bacteria in a sealed greenhouse. Test crops such as potatoes, soybeans, and spirulina in treated soil.",
      rationale: "Clay-rich soil provides a candidate substrate for testing soil detoxification and closed-loop agriculture.",
      targets: [
        { name: "Jezero Crater Floor", lat: 18.4663, lonEast: 77.4298 }
      ]
    },
    {
      title: "Lava Tube Habitat Mapping & Shielding",
      region: "Arsia Mons · Tharsis Montes",
      protocol: "Deploy autonomous drones and ground-penetrating radar into collapsed skylight pits. Measure thermal stability, structural integrity, and natural radiation shielding.",
      rationale: "Candidate skylight entrances may provide access to underground volcanic caverns for habitat and shielding studies.",
      targets: [
        { name: "Arsia Mons Skylight Pit", lat: -3.433, lonEast: 236.314 },
        { name: "Secondary Pit", lat: -3.069, lonEast: 236.062 }
      ]
    },
    {
      title: "Multi-Station Seismic Network",
      region: "Arsia Mons · Tharsis Volcanic Province",
      protocol: "Deploy a triangular array of broadband seismometers spaced several kilometers apart. Triangulate marsquake epicenters and map subsurface structure.",
      rationale: "A regional network can build on InSight measurements to study the crust and mantle around a major volcanic province.",
      targets: [
        { name: "Arsia Mons Regional Array", lat: -8.350, lonEast: 239.910 }
      ]
    },
    {
      title: "Electrostatic Dust Mitigation & Ballooning",
      region: "Multi-site · Arcadia Planitia and Jezero Crater",
      protocol: "Test electrodynamic dust shields on spacesuits, visors, and solar arrays. Use instrumented weather balloons to profile boundary-layer wind shear and dust lifting.",
      rationale: "Comparing northern plains and an equatorial basin helps characterize winds relevant to entry, descent, landing, and surface operations.",
      targets: [
        { name: "Arcadia Planitia Site", lat: 39.800, lonEast: 202.100 },
        { name: "Jezero Crater Site", lat: 18.466, lonEast: 77.430 }
      ]
    }
  ];
  const IMAGERY = {
    viking: SERVICES + "Mars_Viking_MDIM21_ClrMosaic_global_232m/ImageServer",
    relief: SERVICES + "Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp/ImageServer",
    geologic: GEOLOGIC_SERVICE
  };
  const ROUTE_COLORS = {
    viking: "#39ff14",
    relief: "#ffbef1",
    geologic: "#060606",
    thermal: "#000000"
  };
  const byId = function (id) { return document.getElementById(id); };
  const mapError = byId("map-error");
  const mapElement = byId("map");
  const toastElement = byId("toast");
  let map;
  let baseLayer;
  let thermalLayer;
  let activeImagery = "viking";
  let toastTimer;
  let focusMarker;
  let plannedRouteLayer;
  let plannedEndpointMarkers = [];
  let activeCoordinates = { lat: ORIGIN.lat, lon: ORIGIN.lon };
  let routeSelection = { from: null, to: null };
  let routeHighlight = { from: -1, to: -1 };
  let routeReturnView = null;
  let routeReturnFocus = null;

  function normalizeEastLongitude(longitude) {
    return ((longitude + 180) % 360 + 360) % 360 - 180;
  }

  function renderMissions() {
    const list = byId("mission-list");
    const targetCount = MISSIONS.reduce(function (count, mission) {
      return count + mission.targets.length;
    }, 0);
    byId("mission-count").textContent = MISSIONS.length + " experiments · " + targetCount + " target sites";
    list.replaceChildren();

    MISSIONS.forEach(function (mission, missionIndex) {
      const card = document.createElement("details");
      card.className = "mission-card";

      const summary = document.createElement("summary");
      summary.className = "mission-summary";
      const heading = document.createElement("div");
      heading.className = "mission-card-heading";
      const index = document.createElement("span");
      index.className = "mission-index";
      index.textContent = String(missionIndex + 1).padStart(2, "0");
      const title = document.createElement("h3");
      title.textContent = mission.title;
      heading.append(index, title);

      const region = document.createElement("p");
      region.className = "mission-region";
      region.textContent = mission.region;
      summary.append(heading, region);

      const content = document.createElement("div");
      content.className = "mission-details";
      const protocol = document.createElement("p");
      protocol.className = "mission-protocol";
      protocol.textContent = mission.protocol;
      const rationale = document.createElement("p");
      rationale.className = "mission-rationale";
      rationale.textContent = mission.rationale;

      const targets = document.createElement("div");
      targets.className = "mission-targets";
      mission.targets.forEach(function (target, targetIndex) {
        const row = document.createElement("div");
        row.className = "mission-target";
        const details = document.createElement("div");
        details.className = "mission-target-details";
        const name = document.createElement("strong");
        name.textContent = target.name;
        const coordinates = document.createElement("span");
        coordinates.textContent = formatCoordinate(target.lat, "lat") + " · " +
          formatCoordinate(normalizeEastLongitude(target.lonEast), "lon");
        details.append(name, coordinates);

        const go = document.createElement("button");
        go.className = "mission-target-go";
        go.type = "button";
        go.textContent = "Go to";
        go.setAttribute("aria-label", "Go to " + target.name);
        go.addEventListener("click", function () {
          const destination = {
            key: "mission-" + missionIndex + "-" + targetIndex,
            name: target.name,
            label: target.name,
            category: mission.title,
            region: mission.region,
            lat: target.lat,
            lon: normalizeEastLongitude(target.lonEast)
          };
          openRoutePlanner(destination, go);
        });
        row.append(details, go);
        targets.appendChild(row);
      });

      content.append(protocol, rationale, targets);
      card.append(summary, content);
      list.appendChild(card);
    });
  }

  function openMissions() {
    byId("route-planner").hidden = true;
    byId("mission-browser").hidden = false;
    byId("sidebar-content").hidden = true;
    byId("map-controls").classList.remove("is-routing");
    byId("map-controls").classList.add("is-missions");
    if (window.matchMedia("(max-width: 680px)").matches) {
      byId("map-controls").classList.add("is-open");
    }
    byId("open-missions").setAttribute("aria-expanded", "true");
  }

  function closeMissions() {
    byId("mission-browser").hidden = true;
    byId("sidebar-content").hidden = false;
    byId("map-controls").classList.remove("is-missions", "is-open");
    byId("open-missions").setAttribute("aria-expanded", "false");
    byId("open-missions").focus();
  }

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

  function getCurrentMapState() {
    const center = map.getCenter();
    return {
      lat: center.lat,
      lon: center.lng,
      zoom: map.getZoom()
    };
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

  function changeMapZoom(delta) {
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
    if (!preserveView) map.flyTo(latLng, zoom || DEFAULT_ZOOM, { duration: 0.7 });
  }

  function updateLayerLegend(key) {
    const legend = byId("layer-legend");
    const labels = {
      relief: {
        text: "Color = elevation · shade = relief",
        title: "NASA Trek describes this layer as a color hillshade blend; its layer description does not list numeric color intervals."
      },
      geologic: {
        text: "Distinct colors = geologic units",
        title: "Each mapped color identifies a geologic map unit."
      },
      thermal: {
        text: "Cool night: blue/green · warm: red/yellow",
        title: "THEMIS false color: dust and sand are cooler at night; exposed rock and compacted material retain more heat."
      }
    };
    legend.hidden = !labels[key];
    legend.closest(".map-bottomline").classList.toggle("has-layer-legend", Boolean(labels[key]));
    if (!labels[key]) return;
    byId("layer-legend-swatch").className = "layer-legend-swatch is-" + key;
    byId("layer-legend-text").textContent = labels[key].text;
    legend.title = labels[key].title;
  }

  function replaceBaseLayer(key) {
    activeImagery = key;
    updateLayerLegend(key);
    if (plannedRouteLayer) plannedRouteLayer.setStyle({ color: ROUTE_COLORS[key] || ROUTE_COLORS.viking });
    if (baseLayer) {
      map.removeLayer(baseLayer);
      baseLayer = null;
    }
    mapError.hidden = true;
    byId("coordinate-system").textContent = "MARS 2000 · EQUIRECTANGULAR";

    if (key === "thermal") {
      byId("map-source").textContent = "ASU THEMIS · DAY + NIGHT IR";
      refreshThermalLayer();
      return;
    }

    let next;
    if (key === "geologic") {
      byId("map-source").textContent = "USGS GEOLOGIC";
      next = L.tileLayer(GEOLOGIC_SERVICE + "/tile/{z}/{y}/{x}", {
        minZoom: -1,
        maxZoom: 11,
        minNativeZoom: 0,
        maxNativeZoom: 11,
        noWrap: true,
        bounds: MARS_BOUNDS,
        attribution: "Geologic map: USGS SIM 3292 / NASA Mars Trek"
      });
    } else {
      byId("map-source").textContent = "NASA TREK DATA";
      next = L.esri.imageMapLayer({
        url: IMAGERY[key],
        opacity: 1,
        useCors: false,
        attribution: "Imagery: NASA Mars Trek / USGS"
      });
    }
    next.on("load", function () {
      if (key === activeImagery) mapError.hidden = true;
    });
    next.on("error", function () {
      if (key === activeImagery) {
        showMapError("NASA Trek could not load the selected map style. Check your connection and try again.");
      }
    });
    baseLayer = next.addTo(map);
  }

  function getRouteSuggestions(query) {
    const value = query.trim().toLowerCase();
    const suggestions = [];
    const center = getCurrentMapState();
    const centerOption = {
      key: "map-center",
      name: "Current map center",
      category: "Current view",
      region: "Map center",
      lat: center.lat,
      lon: center.lon,
      label: "Current map center"
    };
    const matchesCenter = !value || ["current map center", "map center", "center"].some(function (label) {
      return label.indexOf(value) === 0;
    });
    if (matchesCenter) suggestions.push(centerOption);

    const coordinates = query.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coordinates) {
      const lat = Number(coordinates[1]);
      const lon = Number(coordinates[2]);
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        suggestions.push({
          key: "coordinates-" + lat + "-" + lon,
          name: "Custom coordinates",
          category: "Coordinates",
          region: "Entered coordinates",
          lat: lat,
          lon: lon,
          label: coordinates[0].trim()
        });
      }
    }

    SEARCHABLE_PLACES.forEach(function (place) {
      const haystack = (place.name + " " + place.region + " " + place.category).toLowerCase();
      if (!value || haystack.includes(value)) suggestions.push(place);
    });
    return suggestions.slice(0, 10);
  }

  function hideRouteSuggestions(side) {
    byId("route-" + side + "-options").hidden = true;
    byId("route-" + side).setAttribute("aria-expanded", "false");
    byId("route-" + side).removeAttribute("aria-activedescendant");
  }

  function renderRouteSuggestions(side) {
    const input = byId("route-" + side);
    const list = byId("route-" + side + "-options");
    const suggestions = getRouteSuggestions(input.value);
    list.replaceChildren();
    routeHighlight[side] = -1;

    if (!suggestions.length) {
      const empty = document.createElement("div");
      empty.className = "route-empty";
      empty.textContent = "No matching places. Try latitude, longitude.";
      list.appendChild(empty);
    } else {
      suggestions.forEach(function (place, index) {
        const option = document.createElement("button");
        option.className = "route-suggestion";
        option.type = "button";
        option.id = "route-" + side + "-option-" + index;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.addEventListener("mousedown", function (event) { event.preventDefault(); });
        option.addEventListener("click", function () { selectRoutePlace(side, place); });

        const marker = document.createElement("span");
        marker.className = "route-suggestion-mark";
        marker.textContent = place.key === "map-center" ? "◎" :
          (place.key.indexOf("coordinates-") === 0 ? "°" : "•");
        marker.setAttribute("aria-hidden", "true");
        const copy = document.createElement("span");
        copy.className = "route-suggestion-copy";
        const name = document.createElement("strong");
        name.textContent = place.label || place.name;
        const details = document.createElement("small");
        details.textContent = place.region + " · " +
          formatCoordinate(place.lat, "lat") + "  " + formatCoordinate(place.lon, "lon");
        copy.append(name, details);
        option.append(marker, copy);
        list.appendChild(option);
      });
    }

    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function updateRouteFieldMeta(side) {
    const selected = routeSelection[side];
    byId("route-" + side + "-meta").textContent = selected
      ? formatCoordinate(selected.lat, "lat") + "   " + formatCoordinate(selected.lon, "lon")
      : "Place or latitude, longitude";
  }

  function selectRoutePlace(side, place) {
    routeSelection[side] = place;
    byId("route-" + side).value = place.label || place.name;
    updateRouteFieldMeta(side);
    hideRouteSuggestions(side);
    updateRouteButtons();
    byId("route-status").textContent = routeSelection.from && routeSelection.to
      ? "Both locations selected."
      : "Choose the other location to continue.";
  }

  function updateRouteButtons() {
    const ready = Boolean(routeSelection.from && routeSelection.to);
    byId("route-go").disabled = !ready;
  }

  function setRouteOptionHighlight(side, index) {
    const input = byId("route-" + side);
    const options = Array.from(byId("route-" + side + "-options").querySelectorAll("[role='option']"));
    if (!options.length) return;
    routeHighlight[side] = Math.max(0, Math.min(options.length - 1, index));
    options.forEach(function (option, optionIndex) {
      const active = optionIndex === routeHighlight[side];
      option.classList.toggle("is-active", active);
      option.setAttribute("aria-selected", String(active));
    });
    input.setAttribute("aria-activedescendant", options[routeHighlight[side]].id);
  }

  function clearPlannedRoute() {
    if (plannedRouteLayer && map.hasLayer(plannedRouteLayer)) map.removeLayer(plannedRouteLayer);
    plannedEndpointMarkers.forEach(function (marker) {
      if (map.hasLayer(marker)) map.removeLayer(marker);
    });
    plannedRouteLayer = null;
    plannedEndpointMarkers = [];
  }

  function drawPlannedRoute(coordinates) {
    clearPlannedRoute();
    if (!map.getPane("plannedRoutePane")) {
      map.createPane("plannedRoutePane");
      map.getPane("plannedRoutePane").style.zIndex = 625;
      map.getPane("plannedRoutePane").style.pointerEvents = "none";
    }
    if (!map.getPane("plannedRouteLabelsPane")) {
      map.createPane("plannedRouteLabelsPane");
      map.getPane("plannedRouteLabelsPane").style.zIndex = 640;
      map.getPane("plannedRouteLabelsPane").style.pointerEvents = "none";
    }
    plannedRouteLayer = L.polyline(coordinates, {
      pane: "plannedRoutePane",
      color: ROUTE_COLORS[activeImagery] || ROUTE_COLORS.viking,
      weight: 4,
      opacity: 0.96,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);
    [
      { place: routeSelection.from, label: "From", isDestination: false },
      { place: routeSelection.to, label: "To", isDestination: true }
    ].forEach(function (endpointInfo) {
      const place = endpointInfo.place;
      const endpoint = L.circleMarker([place.lat, place.lon], {
        pane: "plannedRouteLabelsPane",
        radius: 6,
        color: "#f2e9db",
        weight: 2,
        fillColor: endpointInfo.isDestination ? "#74b8a0" : "#e56c43",
        fillOpacity: 1,
        interactive: false
      }).bindTooltip(endpointInfo.label + " · " + place.name, {
        permanent: true,
        direction: "right",
        offset: [9, 0],
        className: endpointInfo.isDestination
          ? "route-place-tooltip route-place-tooltip-to"
          : "route-place-tooltip",
        opacity: 1
      });
      plannedEndpointMarkers.push(endpoint.addTo(map));
    });
    if (coordinates.length > 1) {
      map.fitBounds(plannedRouteLayer.getBounds(), { padding: [48, 48], maxZoom: 7 });
    }
  }

  async function calculateRoute() {
    if (!routeSelection.from || !routeSelection.to) return;
    hideRouteSuggestions("from");
    hideRouteSuggestions("to");
    byId("route-form").hidden = true;
    byId("route-preview").hidden = false;
    byId("route-preview-tag").textContent = "MARS ROUTE PLANNER";
    byId("route-preview-title").textContent = "Calculating route…";
    byId("route-preview-note").textContent = "Loading elevation and thermal-inertia data, then searching for the lowest-cost path.";
    byId("route-preview-metrics").hidden = true;
    byId("route-preview-from").textContent = routeSelection.from.name;
    byId("route-preview-to").textContent = routeSelection.to.name;
    byId("route-preview-from-coords").textContent =
      formatCoordinate(routeSelection.from.lat, "lat") + "   " + formatCoordinate(routeSelection.from.lon, "lon");
    byId("route-preview-to-coords").textContent =
      formatCoordinate(routeSelection.to.lat, "lat") + "   " + formatCoordinate(routeSelection.to.lon, "lon");
    byId("route-status").textContent = "Fetching public Mars terrain data and calculating the route…";
    byId("route-go").disabled = true;
    byId("route-go").textContent = "Planning…";
    clearPlannedRoute();

    try {
      const response = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: { lat: routeSelection.from.lat, lon: routeSelection.from.lon },
          to: { lat: routeSelection.to.lat, lon: routeSelection.to.lon }
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The route could not be calculated.");

      drawPlannedRoute(result.path);
      byId("route-preview-title").textContent = "Least-cost route found";
      byId("route-preview-note").textContent =
        "This is a planning estimate, not a safety guarantee.";
      const used = ["MOLA elevation: slope and local roughness"];
      if (result.data && result.data.tesThermalInertia) used.push("TES thermal inertia");
      const omitted = (result.omitted || []).join(", ");
      const metrics = [
        ["Distance", Number(result.distanceKm).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " km"],
        ["Grid cell", Number(result.gridCellKm).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " km"],
        ["Data used", used.join("; ")],
        
      ];
      const metricsElement = byId("route-preview-metrics");
      metricsElement.replaceChildren();
      metrics.forEach(function (item) {
        const row = document.createElement("div");
        row.className = "route-metric-row";
        const label = document.createElement("span");
        label.className = "route-metric-label";
        label.textContent = item[0];
        const value = document.createElement("span");
        value.className = "route-metric-value";
        value.textContent = item[1];
        row.append(label, value);
        metricsElement.appendChild(row);
      });
      metricsElement.hidden = false;
      byId("route-status").textContent = "Route line shown on the map.";
    } catch (error) {
      byId("route-preview").hidden = true;
      byId("route-form").hidden = false;
      byId("route-status").textContent = error.message || "Route calculation failed. Check that the Python backend is running.";
    } finally {
      updateRouteButtons();
      byId("route-go").textContent = "Go";
    }
  }

  function openRoutePlanner(destination, returnFocus) {
    clearPlannedRoute();
    routeSelection = { from: null, to: null };
    routeHighlight = { from: -1, to: -1 };
    routeReturnView = destination ? "missions" : null;
    routeReturnFocus = returnFocus || null;
    ["from", "to"].forEach(function (side) {
      byId("route-" + side).value = "";
      updateRouteFieldMeta(side);
      hideRouteSuggestions(side);
    });
    byId("route-form").hidden = false;
    byId("route-preview").hidden = true;
    byId("route-status").textContent = "";
    updateRouteButtons();
    byId("mission-browser").hidden = true;
    byId("route-planner").hidden = false;
    byId("map-controls").classList.remove("is-missions");
    byId("map-controls").classList.add("is-routing");
    byId("sidebar-content").hidden = true;
    if (window.matchMedia("(max-width: 680px)").matches) {
      byId("map-controls").classList.add("is-open");
    }
    byId("open-route-planner").setAttribute("aria-expanded", "true");
    if (destination) {
      const center = getCurrentMapState();
      routeSelection.from = {
        key: "map-center",
        name: "Current map center",
        label: "Current map center",
        category: "Current view",
        region: "Map center",
        lat: center.lat,
        lon: center.lon
      };
      routeSelection.to = destination;
      ["from", "to"].forEach(function (side) {
        byId("route-" + side).value = routeSelection[side].label || routeSelection[side].name;
        updateRouteFieldMeta(side);
      });
      updateRouteButtons();
      window.setTimeout(calculateRoute, 0);
    } else {
      window.setTimeout(function () { byId("route-from").focus(); }, 0);
    }
  }

  function closeRoutePlanner() {
    ["from", "to"].forEach(hideRouteSuggestions);
    byId("route-planner").hidden = true;
    byId("open-route-planner").setAttribute("aria-expanded", "false");
    if (routeReturnView === "missions") {
      byId("mission-browser").hidden = false;
      byId("map-controls").classList.remove("is-routing");
      byId("map-controls").classList.add("is-missions");
      byId("open-missions").setAttribute("aria-expanded", "true");
      if (routeReturnFocus) routeReturnFocus.focus();
      routeReturnView = null;
      routeReturnFocus = null;
      return;
    }
    byId("sidebar-content").hidden = false;
    byId("map-controls").classList.remove("is-routing", "is-open");
    routeReturnView = null;
    routeReturnFocus = null;
    byId("open-route-planner").focus();
  }

  function initializeRoutePlanner() {
    renderMissions();
    ["from", "to"].forEach(function (side) {
      const input = byId("route-" + side);
      input.addEventListener("focus", function () { renderRouteSuggestions(side); });
      input.addEventListener("input", function () {
        routeSelection[side] = null;
        updateRouteFieldMeta(side);
        updateRouteButtons();
        byId("route-status").textContent = "";
        renderRouteSuggestions(side);
      });
      input.addEventListener("keydown", function (event) {
        const list = byId("route-" + side + "-options");
        const optionCount = list.querySelectorAll("[role='option']").length;
        if (event.key === "ArrowDown" && !list.hidden && optionCount) {
          event.preventDefault();
          setRouteOptionHighlight(side, routeHighlight[side] + 1);
        } else if (event.key === "ArrowUp" && !list.hidden && optionCount) {
          event.preventDefault();
          setRouteOptionHighlight(side, routeHighlight[side] < 0 ? optionCount - 1 : routeHighlight[side] - 1);
        } else if (event.key === "Enter" && !list.hidden && optionCount) {
          event.preventDefault();
          const index = routeHighlight[side] < 0 ? 0 : routeHighlight[side];
          list.querySelectorAll("[role='option']")[index].click();
        } else if (event.key === "Escape") {
          event.preventDefault();
          if (!list.hidden) hideRouteSuggestions(side);
          else closeRoutePlanner();
        }
      });
    });

    byId("open-route-planner").addEventListener("click", function () { openRoutePlanner(); });
    byId("close-route-planner").addEventListener("click", closeRoutePlanner);
    byId("open-missions").addEventListener("click", openMissions);
    byId("close-missions").addEventListener("click", closeMissions);
    byId("mission-browser").addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMissions();
    });
    byId("route-form").addEventListener("submit", function (event) {
      event.preventDefault();
      calculateRoute();
    });
    byId("edit-route").addEventListener("click", function () {
      clearPlannedRoute();
      byId("route-preview").hidden = true;
      byId("route-form").hidden = false;
      byId("route-status").textContent = "";
      byId("route-from").focus();
    });
    byId("swap-route-points").addEventListener("click", function () {
      const previousFrom = routeSelection.from;
      routeSelection.from = routeSelection.to;
      routeSelection.to = previousFrom;
      ["from", "to"].forEach(function (side) {
        byId("route-" + side).value = routeSelection[side]
          ? (routeSelection[side].label || routeSelection[side].name)
          : "";
        updateRouteFieldMeta(side);
      });
      byId("route-status").textContent = "Starting point and destination swapped.";
      updateRouteButtons();
    });
    byId("route-planner").addEventListener("click", function (event) {
      if (!event.target.closest(".route-input-wrap")) {
        hideRouteSuggestions("from");
        hideRouteSuggestions("to");
      }
    });
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
      showMapError("NASA Trek could not load the selected map style. Check your connection and try again.");
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
      map.fitBounds(MARS_BOUNDS, { padding: [28, 28] });
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
      replaceBaseLayer(activeImagery);
    });

    addMobileControl();
    initializeRoutePlanner();
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
      setFocus(lat, lon, coordinates[1] + ", " + coordinates[2], "Custom coordinates", 7);
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
        }).catch(function () {
          showToast("Full screen is unavailable");
        });
      } else {
        showToast("Full screen is unavailable in this browser");
      }
    } else if (document.exitFullscreen) {
      document.exitFullscreen().then(function () {
        map.invalidateSize();
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
