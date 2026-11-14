# Mars Marswalk Route Planner: Path Safety Model

This document explains which features determine whether a path across the Martian surface is **safe** or **dangerous**, grouped by data type (topographic, optical, thermal, geophysical). It also shows how to turn those features into a cost value for an A* pathfinding grid.

---

## Table of Contents

1. [Approach Overview](#approach-overview)
2. [Topographic Data](#topographic-data)
3. [Optical Data](#optical-data)
4. [Thermal Data](#thermal-data)
5. [Geophysical Data](#geophysical-data)
6. [Bonus Layers](#bonus-layers)
7. [Cost Function (JavaScript)](#cost-function-javascript)
8. [Hard Constraints vs. Soft Costs](#hard-constraints-vs-soft-costs)
9. [Pitch Tips](#pitch-tips)

---

## Approach Overview

For each data type, we define:

- **What to measure**
- **What it tells us** about safety
- **How to convert it** into a cost value for the A* grid

Each grid cell receives a "how bad is it to walk here" score. A* then finds the lowest-cost route between science stops.

---

## Topographic Data

**Sources:** HiRISE or CTX digital terrain models (DTMs), MOLA elevation.
The most important data type for path safety.

| Feature | Why it matters | How to use it |
|---|---|---|
| **Slope angle** | Steep ground risks falls; a suited astronaut with a heavy pack has limited mobility | Cost rises sharply past ~10°; mark as impassable above ~20-25° (assumption: set your own limit and state it) |
| **Aspect** (slope direction) | Determines sun exposure, which feeds into temperature and lighting | Combine with thermal data |
| **Roughness** (local elevation variation) | Rough ground slows walking and raises trip risk | Standard deviation of elevation in a small window |
| **Curvature** | Identifies ridge crests, crater rims, and cliff edges | Penalize sharp convex edges, which hide drop-offs |
| **Cliffs and scarps** | Sudden drops are the worst hazard | Mark as impassable, with a buffer zone |
| **Depressions and pits** | Hard to escape or see into | Penalize or avoid |

---

## Optical Data

**Sources:** HiRISE (~25 cm/pixel), CTX, rover and lander surface photos.

| Feature | Why it matters | How to use it |
|---|---|---|
| **Boulders and large rocks** | Physical obstacles (mentioned directly in the challenge text) | Detect from imagery or use rock-abundance maps; make large ones impassable |
| **Surface texture** | Smooth, dark, or ripple-covered areas hint at ground composition | Classify terrain types |
| **Sand dunes and ripples** | Loose sand can bog down walkers and rovers (Spirit got stuck this way) | High cost or avoid |
| **Shadows** | Reduce visibility; shadow angle reveals relief | Flag deep shadows as low-visibility zones |
| **Albedo (brightness)** | Dark areas often mean basaltic sand; bright areas often mean dust | Dust can mean soft, deep ground |
| **Fresh features** (new craters, recent slope streaks) | May indicate unstable or recently active ground | Penalize |

---

## Thermal Data

**Sources:** THEMIS, TES (thermal inertia and surface temperature).

| Feature | Why it matters | How to use it |
|---|---|---|
| **Surface temperature** | Extreme cold stresses suit heaters and batteries, and affects boots and joints | Compute a time-of-day cost; show safe time windows |
| **Thermal inertia** | Indicates ground type: low = loose dust or fine sand (soft, risky); high = solid rock or bedrock (firm) | One of the best proxies for how firm the surface is |
| **Diurnal temperature swing** | Large swings suggest dust-covered ground | Supports terrain classification |
| **Shade vs. sun exposure** | Ground and suit temperatures differ a lot | Plan stops in warmer areas; avoid long shaded stretches |

> **Key point:** Thermal inertia gives a trafficability estimate that optical imagery alone cannot.

---

## Geophysical Data

This category is broader, and some of it applies more to **destination choice** than to the path itself.

| Feature | Why it matters | How to use it |
|---|---|---|
| **Subsurface voids, lava tubes, caves** | Risk of ground collapse (also a science and shelter opportunity) | Radar or gravity hints; mark suspected areas as exclusion zones |
| **Subsurface ice or loose material** | Ice-rich ground can slump or be slippery | Radar (SHARAD) shows layers; use as a caution flag |
| **Gravity anomalies** | Reveal buried density changes | Low resolution, so mostly for site selection |
| **Seismic activity** (InSight data) | Marsquakes are small but could matter near steep slopes | Minor factor, but a good mention for the pitch |
| **Magnetic field** | Weak and patchy; little impact on walking | Skip for pathfinding |

> **Note:** Geophysical data is usually too coarse to affect step-by-step routing. Use it for flags and exclusion zones, not for the main cost surface.

---

## Bonus Layers

The challenge asks for at least three data types. These two matter a lot for safety:

- **Radiation:** Shielding from terrain (gullies, crater walls), plus space weather alerts (RAD instrument data from Curiosity).
- **Atmospheric:** Dust storms reduce visibility and sunlight; wind speed matters for equipment (REMS and MARCI data).

---

## Cost Function (JavaScript)

A simple weighted cost for each grid cell:

```javascript
function cellCost(cell) {
  // Hard limits: impassable
  if (cell.slope > 20 || cell.isBoulder || cell.isCliff) return Infinity;

  let cost = 1; // base cost of walking one cell

  cost += Math.pow(cell.slope / 10, 2) * 3;        // slope penalty (grows fast)
  cost += cell.roughness * 2;                       // rough ground
  cost += (1 - cell.thermalInertiaNorm) * 2;        // soft/sandy ground
  cost += cell.coldPenalty;                         // temperature at planned time
  cost += cell.radiationExposure * 1.5;             // dose
  cost += cell.shadowPenalty;                       // low visibility

  return cost;
}
```

The weights are **placeholders**. In your pitch, explain why you chose them and show that changing a weight changes the route. This proves the map responds to the data.

---

## Hard Constraints vs. Soft Costs

Split hazards into two types:

1. **Hard constraints (no-go):** steep slopes, cliffs, boulders, suspected voids. A* never enters these cells.
2. **Soft costs (avoid if possible):** roughness, soft ground, cold, radiation. A* weighs these against distance.

This mirrors how real mission planners work and makes your safety logic easy to explain to judges.



