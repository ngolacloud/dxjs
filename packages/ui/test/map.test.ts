import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { render } from "@dxjs/dom";
import { worldMap, project } from "../src/map.ts";

test("project: equirectangular math", () => {
  assert.deepEqual(project(0, 0), [180, 90], "center maps to (180,90)");
  const ne = project(180, 90);
  assert.ok(Math.abs(ne[0] - 360) < 1e-9 && Math.abs(ne[1] - 0) < 1e-9, "(180,90)→(360,0)");
  const sw = project(-180, -90);
  assert.ok(Math.abs(sw[0] - 0) < 1e-9 && Math.abs(sw[1] - 180) < 1e-9, "(-180,-90)→(0,180)");
  // Lisbon-ish lands in the upper-left quadrant (west + north).
  const [lx, ly] = project(-9, 38.7);
  assert.ok(lx < 180 && ly < 90, "Lisbon west of centre and above the equator");
});

test("worldMap: renders a circle per marker with its label in a <title>", () => {
  const host = body();
  render(
    worldMap({
      markers: [
        { lon: 0, lat: 0, label: "Null Island" },
        { lon: -9, lat: 38.7, label: "Lisbon" },
        { lon: 13.2, lat: -8.8, label: "Luanda" },
      ],
    }),
    host,
  );
  const circles = host.querySelectorAll("circle.dx-map-pin");
  assert.equal(circles.length, 3, "one circle per marker");
  // The first marker (0,0) must sit at projected (180,90).
  const first = circles[0]!;
  assert.equal(first.getAttribute("cx"), "180.00");
  assert.equal(first.getAttribute("cy"), "90.00");
  // Labels ride along as <title> children.
  const titles = [...host.querySelectorAll("circle.dx-map-pin title")].map((t) => t.textContent);
  assert.deepEqual(titles, ["Null Island", "Lisbon", "Luanda"]);
});

test("worldMap: graticule default on, suppressible", () => {
  const h1 = body();
  render(worldMap({ markers: [] }), h1);
  assert.ok(h1.querySelector(".dx-map-grid"), "graticule drawn by default");

  const h2 = body();
  render(worldMap({ markers: [], graticule: false }), h2);
  assert.equal(h2.querySelector(".dx-map-grid"), null, "graticule suppressed");
});

test("worldMap: markers are reactive", () => {
  const host = body();
  const markers = signal([{ lon: 0, lat: 0, label: "A" }]);
  render(worldMap({ markers: () => markers() }), host);
  assert.equal(host.querySelectorAll("circle.dx-map-pin").length, 1);
  markers.set([
    { lon: 0, lat: 0, label: "A" },
    { lon: 10, lat: 10, label: "B" },
  ]);
  assert.equal(host.querySelectorAll("circle.dx-map-pin").length, 2, "new marker appears");
});
