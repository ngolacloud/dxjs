// @dxjs/ui/map — a self-contained world map as pure SVG. No external tiles, no
// network, no canvas: an equirectangular (plate carrée) projection drawn with
// SVG attributes, so it is CSP-safe and reactive. Pass an accessor of markers
// and the pins redraw when the data signal changes. For real geospatial work use
// a dedicated library; this is for inline "where are my nodes" dot maps.

import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, cx, type Maybe, type Tone } from "./base.ts";

export interface MapMarker {
  lon: number;
  lat: number;
  label?: string;
  tone?: Tone;
}

export interface WorldMapOptions {
  markers?: Maybe<MapMarker[]>;
  width?: number;
  height?: number;
  /** Draw lon/lat grid lines every 30°. Default true. */
  graticule?: boolean;
  ariaLabel?: string;
}

// The map canvas is the equirectangular world: 360 units wide (one per degree of
// longitude) by 180 tall (one per degree of latitude).
const MAP_W = 360;
const MAP_H = 180;

/** Project geographic (lon,lat) to map coordinates on a 360×180 equirectangular
 *  canvas. lon ∈ [-180,180] → x ∈ [0,360]; lat ∈ [90,-90] → y ∈ [0,180]. Pure, so
 *  the center (0,0) is exactly (180,90). */
export function project(lon: number, lat: number): [number, number] {
  return [lon + 180, 90 - lat];
}

/** A compact dot map. The viewBox is the whole equirectangular world; markers are
 *  SVG <circle>s projected with `project`, each with a <title> for its label. */
export function worldMap(o: WorldMapOptions): TemplateResult {
  const W = o.width ?? 360;
  const H = o.height ?? 180;
  const grid = o.graticule ?? true;

  // Longitude meridians every 30° (−180…180) and latitude parallels every 30°
  // (−90…90), as static geometry — vertical/horizontal <line>s in map space.
  const meridians: number[] = [];
  for (let lon = -180; lon <= 180; lon += 30) meridians.push(lon);
  const parallels: number[] = [];
  for (let lat = -90; lat <= 90; lat += 30) parallels.push(lat);

  return html`<svg
    class="dx-map"
    viewBox=${`0 0 ${MAP_W} ${MAP_H}`}
    width=${W}
    height=${H}
    role="img"
    aria-label=${o.ariaLabel ?? false}
  ><rect class="dx-map-ocean" x="0" y="0" width=${MAP_W} height=${MAP_H}></rect>${grid
    ? html`<g class="dx-map-grid" aria-hidden="true">${meridians.map((lon) => {
        const x = project(lon, 0)[0];
        return html`<line class="dx-map-line" x1=${x} y1="0" x2=${x} y2=${MAP_H}></line>`;
      })}${parallels.map((lat) => {
        const y = project(0, lat)[1];
        return html`<line class="dx-map-line" x1="0" y1=${y} x2=${MAP_W} y2=${y}></line>`;
      })}</g>`
    : ""}<g class="dx-map-markers">${list(
    () => read(o.markers ?? []),
    (m, i) => m.label ?? i,
    (m) => {
      const [x, y] = project(m.lon, m.lat);
      return html`<circle
        class=${cx("dx-map-pin", m.tone && `is-${m.tone}`)}
        r="3"
        cx=${x.toFixed(2)}
        cy=${y.toFixed(2)}
      >${m.label ? html`<title>${m.label}</title>` : ""}</circle>`;
    },
  )}</g></svg>`;
}
