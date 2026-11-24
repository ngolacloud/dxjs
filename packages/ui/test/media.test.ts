import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "@dxjs/dom";
import { html } from "@dxjs/dom";
import { image, video, carousel } from "../src/media.ts";

// --- image -----------------------------------------------------------------
test("image: renders <img> with src/alt inside the figure", () => {
  const host = body();
  render(image({ src: "/photo.png", alt: "A photo", ratio: "16/9", caption: "Hi" }), host);
  const fig = host.querySelector("figure.dx-img")!;
  assert.ok(fig, "figure.dx-img present");
  assert.ok(fig.classList.contains("has-ratio"));
  const img = fig.querySelector("img.dx-img-el")! as unknown as HTMLImageElement;
  assert.equal(img.getAttribute("src"), "/photo.png");
  assert.equal(img.getAttribute("alt"), "A photo");
  assert.equal(img.getAttribute("loading"), "lazy");
  assert.ok(fig.querySelector(".dx-img-cap")!.textContent!.includes("Hi"));
  // error swaps in the broken class (graceful placeholder)
  assert.equal(fig.classList.contains("is-broken"), false);
  fire(img as unknown as Element, "error");
  assert.ok(fig.classList.contains("is-broken"), "is-broken after @error");
});

// --- video -----------------------------------------------------------------
test("video: controls attribute toggles off when controls:false", () => {
  const h1 = body();
  render(video({ src: "/clip.mp4" }), h1);
  const v1 = h1.querySelector("video.dx-video-el")!;
  assert.ok(v1.hasAttribute("controls"), "controls default on");

  const h2 = body();
  render(video({ src: "/clip.mp4", controls: false, poster: "/p.png", loop: true }), h2);
  const v2 = h2.querySelector("video.dx-video-el")!;
  assert.equal(v2.hasAttribute("controls"), false, "controls off");
  assert.ok(v2.hasAttribute("loop"));
  assert.equal(v2.getAttribute("poster"), "/p.png");
});

// --- carousel --------------------------------------------------------------
test("carousel: renders N slides, next/prev move active, dots reflect, wrap", () => {
  const host = body();
  const slides = [html`<p>one</p>`, html`<p>two</p>`, html`<p>three</p>`];
  render(carousel({ slides }), host);

  const slideEls = host.querySelectorAll(".dx-carousel-slide");
  assert.equal(slideEls.length, 3, "three slides");
  const dots = host.querySelectorAll(".dx-carousel-dot");
  assert.equal(dots.length, 3, "three dots");

  const visible = (): number =>
    [...slideEls].findIndex((s) => !s.hasAttribute("hidden"));
  const activeDot = (): number =>
    [...dots].findIndex((d) => d.classList.contains("is-active"));

  // initial: first slide shown, first dot active
  assert.equal(visible(), 0);
  assert.equal(activeDot(), 0);

  // next
  fire(host.querySelector(".dx-carousel-arrow.is-next")!, "click");
  assert.equal(visible(), 1);
  assert.equal(activeDot(), 1);
  assert.equal(dots[1]!.getAttribute("aria-selected"), "true");
  assert.equal(dots[0]!.getAttribute("aria-selected"), "false");

  // prev back to 0, then prev again wraps to last (2)
  fire(host.querySelector(".dx-carousel-arrow.is-prev")!, "click");
  assert.equal(visible(), 0);
  fire(host.querySelector(".dx-carousel-arrow.is-prev")!, "click");
  assert.equal(visible(), 2, "wrap-around to last");
  assert.equal(activeDot(), 2);

  // next from last wraps to first
  fire(host.querySelector(".dx-carousel-arrow.is-next")!, "click");
  assert.equal(visible(), 0, "wrap-around to first");

  // clicking a dot jumps directly
  fire(dots[2]!, "click");
  assert.equal(visible(), 2);

  // keyboard arrows on the root
  const root = host.querySelector(".dx-carousel")!;
  root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  assert.equal(visible(), 0, "ArrowRight wraps 2 -> 0");
  root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  assert.equal(visible(), 2, "ArrowLeft wraps 0 -> 2");
});
