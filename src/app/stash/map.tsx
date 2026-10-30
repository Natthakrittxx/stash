"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import {
  type GeoJSONSource,
  type MapGeoJSONFeature,
  MapLibreMap,
  Popup,
  ScaleControl,
  setWorkerUrl,
  type StyleSpecification,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { Bounds } from "~/maps";

// MapLibre finds its worker beside its own file, which the bundler moved into
// a chunk; point it at the worker the bundler emits from the package instead.
setWorkerUrl(
  new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
);

export type MapPlace = { id: string; title: string; lat: number; lng: number };
export type Point = { lat: number; lng: number };

// OpenFreeMap: OpenMapTiles vector tiles, no key, attribution added by MapLibre
// from the TileJSON.
const TILES = "https://tiles.openfreemap.org/planet";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
// Below this map width the card sits above its pin instead of beside it.
const NARROW = 480;
// Pins that would overlap merge into a counted cluster up to this zoom; past
// it, a trip's pins show one by one.
const CLUSTER_MAX_ZOOM = 10;
// Pins carry their names from here, where a street-level view has room.
const LABEL_ZOOM = 13;

const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;

// The basemap is drawn in the app's own tokens, read live so it follows the
// theme toggle: land on surface, roads and water one step either side of it.
function palette() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(`--color-${name}`).trim();
  const dark = css.colorScheme === "dark";
  return {
    land: v("surface"),
    water: dark ? v("bg") : v("border"),
    road: dark ? v("border") : v("bg"),
    ink: v("ink"),
    muted: v("muted"),
    paper: v("bg"),
    accent: v("accent"),
  };
}

type Data = {
  pins: MapPlace[];
  focus: [MapPlace, string][];
  user: Point | null;
};

function points(list: { p: Point; props: Record<string, string> }[]) {
  return {
    type: "FeatureCollection" as const,
    features: list.map(({ p, props }) => ({
      type: "Feature" as const,
      properties: props,
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
    })),
  };
}

const pinsData = (d: Data) =>
  points(d.pins.map((p) => ({ p, props: { id: p.id, title: p.title } })));
const focusData = (d: Data) =>
  points(d.focus.map(([p, role]) => ({ p, props: { id: p.id, role } })));
const userData = (d: Data) => points(d.user ? [{ p: d.user, props: {} }] : []);

function style(d: Data): StyleSpecification {
  const c = palette();
  const label = [
    "coalesce",
    ["get", "name:en"],
    ["get", "name:latin"],
    ["get", "name"],
  ];
  const halo = { "text-halo-color": c.land, "text-halo-width": 1.5 };
  const road = (
    id: string,
    classes: string[],
    minzoom: number,
    widths: number[],
  ) => ({
    id,
    type: "line" as const,
    source: "omt",
    "source-layer": "transportation",
    minzoom,
    filter: ["match", ["get", "class"], classes, true, false],
    layout: { "line-cap": "round" as const, "line-join": "round" as const },
    paint: {
      "line-color": c.road,
      "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], ...widths],
    },
  });
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      omt: { type: "vector", url: TILES },
      pins: {
        type: "geojson",
        data: pinsData(d),
        cluster: true,
        clusterRadius: 24,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
      },
      focus: { type: "geojson", data: focusData(d) },
      user: { type: "geojson", data: userData(d) },
    },
    layers: [
      { id: "land", type: "background", paint: { "background-color": c.land } },
      {
        id: "park",
        type: "fill",
        source: "omt",
        "source-layer": "park",
        paint: { "fill-color": c.ink, "fill-opacity": 0.05 },
      },
      {
        id: "water",
        type: "fill",
        source: "omt",
        "source-layer": "water",
        paint: { "fill-color": c.water },
      },
      {
        id: "waterway",
        type: "line",
        source: "omt",
        "source-layer": "waterway",
        paint: {
          "line-color": c.water,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 16, 4],
        },
      },
      road("road-minor", ["minor", "service"], 13, [13, 1, 18, 10]),
      road("road-mid", ["secondary", "tertiary"], 9, [9, 0.5, 18, 14]),
      road("road-major", ["motorway", "trunk", "primary"], 5, [5, 0.5, 18, 18]),
      {
        id: "rail",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        minzoom: 11,
        filter: ["==", ["get", "class"], "rail"],
        paint: {
          "line-color": c.muted,
          "line-opacity": 0.4,
          "line-width": 1,
          "line-dasharray": [3, 3],
        },
      },
      {
        id: "road-label",
        type: "symbol",
        source: "omt",
        "source-layer": "transportation_name",
        minzoom: 14,
        layout: {
          "symbol-placement": "line",
          "text-field": label,
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
        },
        paint: { "text-color": c.muted, ...halo },
      },
      {
        id: "place-label",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        filter: [
          "match",
          ["get", "class"],
          ["city", "town", "village", "suburb", "quarter", "neighbourhood"],
          true,
          false,
        ],
        layout: {
          "text-field": label,
          "text-font": ["Noto Sans Regular"],
          "text-size": ["match", ["get", "class"], "city", 13, "town", 12, 11],
          "text-max-width": 8,
        },
        paint: { "text-color": c.muted, ...halo },
      },
      {
        id: "clusters",
        type: "circle",
        source: "pins",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": c.ink,
          "circle-radius": ["step", ["get", "point_count"], 13, 10, 16, 50, 20],
          "circle-stroke-color": c.paper,
          "circle-stroke-width": 2,
        },
      },
      {
        id: "cluster-count",
        type: "symbol",
        source: "pins",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 12,
          "text-allow-overlap": true,
        },
        paint: { "text-color": c.paper },
      },
      {
        id: "pins",
        type: "circle",
        source: "pins",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": c.ink,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 4, 15, 7],
          "circle-stroke-color": c.paper,
          "circle-stroke-width": 2,
        },
      },
      // Each pin's name, below it. Ink, not muted: a place's name must not read
      // as a street's. Placed under the colliders, so it never covers a pin.
      {
        id: "pin-label",
        type: "symbol",
        source: "pins",
        minzoom: LABEL_ZOOM,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": ["get", "title"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
          "text-anchor": "top",
          // Clear of its own pin's reserved space, or the pin hides its name.
          "text-offset": [0, 1.25],
          "text-max-width": 10,
        },
        paint: { "text-color": c.ink, ...halo },
      },
      // Pins are circles, which labels don't collide with. An invisible glyph at
      // each pin, cluster and you reserves the space, so a label gives way
      // instead of being stamped over. Placed above the labels, it wins.
      {
        id: "pin-space",
        type: "symbol",
        source: "pins",
        layout: {
          "text-field": "O",
          "text-font": ["Noto Sans Regular"],
          "text-size": 18,
          "text-allow-overlap": true,
        },
        paint: { "text-opacity": 0 },
      },
      {
        id: "user-space",
        type: "symbol",
        source: "user",
        layout: {
          "text-field": "O",
          "text-font": ["Noto Sans Regular"],
          "text-size": 18,
          "text-allow-overlap": true,
        },
        paint: { "text-opacity": 0 },
      },
      // Hover rings in ink; selection is teal plus a wider ring, so the shape
      // carries the state as well as the colour.
      {
        id: "hover-ring",
        type: "circle",
        source: "focus",
        filter: ["==", ["get", "role"], "hover"],
        paint: {
          "circle-radius": 13,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": c.ink,
          "circle-stroke-width": 2,
        },
      },
      {
        id: "selected-ring",
        type: "circle",
        source: "focus",
        filter: ["==", ["get", "role"], "selected"],
        paint: {
          "circle-radius": 16,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": c.accent,
          "circle-stroke-width": 2.5,
        },
      },
      {
        id: "selected",
        type: "circle",
        source: "focus",
        filter: ["==", ["get", "role"], "selected"],
        paint: {
          "circle-radius": 8,
          "circle-color": c.accent,
          "circle-stroke-color": c.paper,
          "circle-stroke-width": 2.5,
        },
      },
      // You: a hollow ink ring, never teal (teal means selected).
      {
        id: "user",
        type: "circle",
        source: "user",
        paint: {
          "circle-radius": 8,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": c.ink,
          "circle-stroke-width": 3,
        },
      },
    ] as StyleSpecification["layers"],
  };
}

function fit(map: MapLibreMap, pts: Point[]) {
  const duration = reducedMotion() ? 0 : 600;
  if (pts.length === 1)
    return map.easeTo({
      center: [pts[0]!.lng, pts[0]!.lat],
      zoom: Math.max(map.getZoom(), 14),
      duration,
    });
  const lngs = pts.map((p) => p.lng);
  const lats = pts.map((p) => p.lat);
  map.fitBounds(
    [
      Math.min(...lngs),
      Math.min(...lats),
      Math.max(...lngs),
      Math.max(...lats),
    ],
    { padding: 64, maxZoom: 15, duration },
  );
}

export default function PlaceMap(props: {
  pins: MapPlace[];
  /** A new key fits the view to `points`. */
  fit: { key: string; points: Point[] };
  selectedId: string | null;
  hoveredId: string | null;
  user: Point | null;
  locating: boolean;
  /** The title of a place waiting for its pin, while "Set location" is on. */
  dropping: string | null;
  label: string;
  popover: React.ReactNode;
  onSelect: (id: string | null) => void;
  onUserMove: (bounds: Bounds) => void;
  onLocate: () => void;
  onDrop: (pin: Point) => void;
  onCancelDrop: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [popupNode] = useState(() => document.createElement("div"));
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // Handlers bind once at mount; they read the latest props through this.
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
    dataRef.current = data;
  });

  const byId = new Map(props.pins.map((p) => [p.id, p]));
  const data: Data = {
    pins: props.pins,
    focus: [
      [props.hoveredId, "hover"],
      [props.selectedId, "selected"],
    ].flatMap(([id, role]) => {
      const p = id ? byId.get(id) : undefined;
      return p ? [[p, role!] as [MapPlace, string]] : [];
    }),
    user: props.user,
  };
  const dataRef = useRef(data);

  useEffect(() => {
    const map = new MapLibreMap({
      container: box.current!,
      style: style(dataRef.current),
      center: [100.5, 13.75],
      zoom: 2,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      // Always the words, never the "i" button: its icon is black in both themes.
      attributionControl: { compact: false },
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    // A phone-width map has no room beside a pin: the card sits above it, no
    // wider than the map.
    const narrow = box.current!.clientWidth < NARROW;
    popupRef.current = new Popup({
      closeButton: false,
      closeOnClick: false,
      focusAfterOpen: false,
      offset: 18,
      anchor: narrow ? "bottom" : undefined,
      maxWidth: narrow ? `${box.current!.clientWidth - 32}px` : "22rem",
      className: "place-popup",
    }).setDOMContent(popupNode);

    map.on("load", () => setReady(true));
    // Set location from the keyboard: Enter on the map pins at the cross.
    map.getCanvas().addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || !latest.current.dropping) return;
      e.preventDefault();
      const c = map.getCenter();
      latest.current.onDrop({ lat: c.lat, lng: c.lng });
    });
    // A failed tile still leaves the index usable; say so once, on the map.
    map.on("error", (e) => {
      if ((e as { sourceId?: string }).sourceId === "omt") setFailed(true);
    });

    const idOf = (f?: MapGeoJSONFeature) =>
      f?.properties?.id as string | undefined;
    map.on("click", (e) => {
      const p = latest.current;
      if (p.dropping) return p.onDrop({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      const [hit] = map.queryRenderedFeatures(e.point, {
        layers: ["selected", "pins", "clusters"],
      });
      if (hit?.layer.id === "clusters") {
        const source = map.getSource<GeoJSONSource>("pins")!;
        void source
          .getClusterExpansionZoom(hit.properties.cluster_id as number)
          .then((zoom) =>
            map.easeTo({
              center: (hit.geometry as GeoJSON.Point).coordinates as [
                number,
                number,
              ],
              zoom,
              duration: reducedMotion() ? 0 : 400,
            }),
          );
        return;
      }
      p.onSelect(idOf(hit) ?? null);
    });
    for (const layer of ["pins", "clusters", "selected"]) {
      map.on(
        "mouseenter",
        layer,
        () => (map.getCanvas().style.cursor = "pointer"),
      );
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
    }
    // Only a move the visitor made narrows the index; fits and fly-tos don't.
    map.on("moveend", (e) => {
      if (!e.originalEvent && !(e as { user?: boolean }).user) return;
      const b = map.getBounds();
      latest.current.onUserMove({
        west: b.getWest(),
        south: b.getSouth(),
        east: b.getEast(),
        north: b.getNorth(),
      });
    });

    // The column resizes without the window (the rail opens and closes).
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(box.current!);

    // The theme toggle flips the tokens; redraw the basemap in the new ones.
    const repaint = () => map.setStyle(style(dataRef.current), { diff: true });
    const mo = new MutationObserver(repaint);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", repaint);

    return () => {
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", repaint);
      map.remove();
      mapRef.current = null;
    };
  }, [popupNode]);

  // Pins, the hovered and selected pin, and you: each source re-sent only when
  // what it draws changes, so hovering a row never re-indexes every pin.
  const pinsKey = props.pins.map((p) => `${p.id}:${p.lat}:${p.lng}`).join();
  const focusKey = data.focus
    .map(([p, role]) => `${role}:${p.id}:${p.lat}:${p.lng}`)
    .join();
  const userKey = props.user ? `${props.user.lat}:${props.user.lng}` : "";
  const send = (name: string, json: ReturnType<typeof points>) => {
    if (ready)
      void mapRef.current?.getSource<GeoJSONSource>(name)?.setData(json);
  };
  useEffect(() => send("pins", pinsData(data)), [pinsKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => send("focus", focusData(data)), [focusKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => send("user", userData(data)), [userKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (map && ready && props.fit.points.length > 0) fit(map, props.fit.points);
    // Only a new key refits; the points ride along with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.fit.key, ready]);

  // A selection off-screen comes into view; one already showing stays put. On
  // a phone-width map it always centres, a little low, so its card fits above.
  const selected = props.selectedId ? byId.get(props.selectedId) : undefined;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selected) return;
    const at: [number, number] = [selected.lng, selected.lat];
    const pt = map.project(at);
    const { clientWidth: w, clientHeight: h } = map.getContainer();
    const duration = reducedMotion() ? 0 : 600;
    if (w < NARROW)
      map.easeTo({
        center: at,
        zoom: Math.max(map.getZoom(), 12),
        offset: [0, h / 5],
        duration,
      });
    else if (pt.x < 48 || pt.y < 48 || pt.x > w - 48 || pt.y > h - 48)
      map.easeTo({ center: at, duration });
  }, [selected?.id, selected?.lat, selected?.lng, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const showPopup = !!(selected && props.popover);
  useEffect(() => {
    const map = mapRef.current;
    const popup = popupRef.current;
    if (!map || !popup || !ready) return;
    if (showPopup && selected)
      popup.setLngLat([selected.lng, selected.lat]).addTo(map);
    else popup.remove();
  }, [showPopup, selected?.lat, selected?.lng, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = props.dropping ? "crosshair" : "";
    // Set location from the keyboard: the arrows pan the map under the cross.
    if (props.dropping) map.getCanvas().focus();
  }, [props.dropping]);

  useEffect(() => {
    mapRef.current?.getCanvas().setAttribute("aria-label", props.label);
  }, [props.label, ready]);

  const control =
    "grid size-8 place-items-center text-ink hover:bg-surface pointer-coarse:size-11 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";
  const zoom = (dir: 1 | -1) => {
    const map = mapRef.current;
    if (!map) return;
    // About the selected pin while it's on screen, so it stays in view.
    const at: [number, number] | undefined = selected && [
      selected.lng,
      selected.lat,
    ];
    // `user` marks it as the visitor's own move, so the index narrows.
    map.easeTo(
      {
        zoom: map.getZoom() + dir,
        around: at && map.getBounds().contains(at) ? at : undefined,
        duration: reducedMotion() ? 0 : 250,
      },
      { user: true },
    );
  };

  const pinAtCross = () => {
    const c = mapRef.current?.getCenter();
    if (c) props.onDrop({ lat: c.lat, lng: c.lng });
  };

  return (
    <div className="bg-surface relative h-full w-full">
      {/* The overlays come before the map in the DOM (and sit above it), so
          Shift+Tab from the focused map reaches them before MapLibre's links. */}
      {props.dropping && (
        <>
          {/* The spot "Pin here" uses: the map's centre. */}
          <svg
            aria-hidden="true"
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            className="text-ink pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
          >
            <path d="M14 2v8M14 18v8M2 14h8M18 14h8" />
          </svg>
          <div className="bg-bg border-border text-label text-ink absolute top-3 left-3 z-10 flex max-w-[calc(100%-5rem)] flex-wrap items-center gap-x-3 gap-y-1 rounded border px-3 py-2 shadow-lg">
            <p role="status" className="min-w-0 basis-full">
              <span className="pointer-coarse:hidden">Click</span>
              <span className="hidden pointer-coarse:inline">Tap</span> the map
              where “{props.dropping}” is, or move it under the cross
              <span className="pointer-coarse:hidden"> and press Enter</span>.
            </p>
            <button
              type="button"
              onClick={pinAtCross}
              className="text-accent focus-visible:outline-accent rounded font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11"
            >
              Pin here
            </button>
            <button
              type="button"
              onClick={props.onCancelDrop}
              className="text-muted hover:text-ink focus-visible:outline-accent rounded font-medium focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      <div className="border-field bg-bg divide-border absolute top-3 right-3 z-10 flex flex-col divide-y overflow-hidden rounded border">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => zoom(1)}
          className={control}
        >
          <Icon d="M12 6v12M6 12h12" />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => zoom(-1)}
          className={control}
        >
          <Icon d="M6 12h12" />
        </button>
        <button
          type="button"
          aria-label="Show places near me"
          aria-pressed={!!props.user}
          disabled={props.locating}
          onClick={props.onLocate}
          className={`${control} disabled:opacity-60 ${props.user ? "text-accent" : ""}`}
        >
          <Icon d="M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
        </button>
      </div>

      {failed && !props.dropping && (
        <p className="bg-bg/90 text-label text-muted absolute top-3 left-3 z-10 max-w-[calc(100%-5rem)] rounded px-2 py-1">
          Map tiles didn&apos;t load. Your places are still listed.
        </p>
      )}

      {/* MapLibre makes this position: relative, so it is sized, not inset. */}
      <div ref={box} className="h-full w-full" />

      {createPortal(props.popover, popupNode)}
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
