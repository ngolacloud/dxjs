// @dxjs/ui/media — responsive media: image (lazy, aspect-ratio, graceful error),
// video (same-origin, CSP media-src 'self') and a slide carousel.
//
// Class-only styling (CSP-safe). Dynamic geometry (aspect-ratio) goes through a
// CSS custom property set on the element via a `ref` effect — never a `style=`
// attribute. Booleans bind through `?attr`, events through `@event`.

import { html, list, type TemplateResult } from "@dxjs/dom";
import { signal, onCleanup } from "@dxjs/core";
import { read, cx, sizeClass, type Maybe, type Size } from "./base.ts";

// --- Image -----------------------------------------------------------------
export interface ImageOptions {
  /** Same-origin or data: URL (CSP img-src 'self' data:). */
  src: string;
  alt: string;
  /** Aspect ratio, e.g. "16/9" or "1/1". Applied via a CSS var, not an attr. */
  ratio?: string;
  rounded?: boolean;
  fit?: "cover" | "contain";
  size?: Size;
  caption?: string;
  loading?: "lazy" | "eager";
}

/** A responsive, lazy image in a <figure>. On load error a class swaps in a
 *  placeholder (no inline style, no innerHTML). */
export function image(o: ImageOptions): TemplateResult {
  const broken = signal(false);
  const cls = (): string =>
    cx(
      "dx-img",
      sizeClass(o.size),
      o.rounded && "is-rounded",
      o.fit === "contain" && "is-contain",
      o.ratio && "has-ratio",
      broken() && "is-broken",
    );
  const setRatio = (el: Element): void => {
    if (o.ratio) (el as HTMLElement).style.setProperty("--dx-img-ratio", o.ratio);
  };
  return html`<figure class=${() => cls()} ref=${setRatio}>
    <img
      class="dx-img-el"
      src=${o.src}
      alt=${o.alt}
      loading=${o.loading ?? "lazy"}
      decoding="async"
      @error=${() => broken.set(true)}
    />
    <span class="dx-img-ph" aria-hidden="true"></span>
    ${o.caption ? html`<figcaption class="dx-img-cap">${o.caption}</figcaption>` : ""}
  </figure>`;
}

// --- Video -----------------------------------------------------------------
export interface VideoOptions {
  /** Same-origin URL (CSP media-src 'self'). */
  src: string;
  poster?: string;
  controls?: boolean;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  ratio?: string;
  caption?: string;
}

/** A <video> in a <figure>. Controls default on; booleans bind through `?attr`. */
export function video(o: VideoOptions): TemplateResult {
  const cls = cx("dx-video", o.ratio && "has-ratio");
  const setRatio = (el: Element): void => {
    if (o.ratio) (el as HTMLElement).style.setProperty("--dx-img-ratio", o.ratio);
  };
  return html`<figure class=${cls} ref=${setRatio}>
    <video
      class="dx-video-el"
      src=${o.src}
      poster=${o.poster ?? false}
      ?controls=${() => o.controls ?? true}
      ?autoplay=${() => o.autoplay ?? false}
      ?muted=${() => o.muted ?? false}
      ?loop=${() => o.loop ?? false}
    ></video>
    ${o.caption ? html`<figcaption class="dx-video-cap">${o.caption}</figcaption>` : ""}
  </figure>`;
}

// --- Carousel --------------------------------------------------------------
export interface CarouselOptions {
  slides: Maybe<TemplateResult[]>;
  /** If set, auto-advance every N ms (paused on hover). */
  autoplayMs?: number;
  showDots?: boolean;
  showArrows?: boolean;
  ariaLabel?: string;
}

/** A slide carousel. Only the active slide is shown (`?hidden`); prev/next and
 *  dot buttons plus Left/Right keys move with wrap-around. Autoplay (if set) is
 *  paused on pointer enter and torn down on cleanup. */
export function carousel(o: CarouselOptions): TemplateResult {
  const active = signal(0);
  const paused = signal(false);
  const count = (): number => read(o.slides).length;
  const go = (i: number): void => {
    const n = count();
    if (n > 0) active.set(((i % n) + n) % n);
  };
  const next = (): void => go(active() + 1);
  const prev = (): void => go(active() - 1);

  if (o.autoplayMs && o.autoplayMs > 0) {
    const handle = setInterval(() => {
      if (!paused()) next();
    }, o.autoplayMs);
    onCleanup(() => clearInterval(handle));
  }

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "ArrowRight") { next(); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { prev(); e.preventDefault(); }
  };

  return html`<div
    class="dx-carousel"
    role="region"
    aria-roledescription="carousel"
    aria-label=${o.ariaLabel ?? "Carousel"}
    tabindex="0"
    @keydown=${onKey}
    @pointerenter=${() => paused.set(true)}
    @pointerleave=${() => paused.set(false)}
  >
    <div class="dx-carousel-track">${list(
      () => read(o.slides),
      (_s, i) => i,
      (slide, i) =>
        html`<div
          class="dx-carousel-slide"
          role="group"
          aria-roledescription="slide"
          ?hidden=${() => active() !== i}
        >${slide}</div>`,
    )}</div>
    ${o.showArrows === false
      ? ""
      : html`<button class="dx-carousel-arrow is-prev" type="button" aria-label="Previous slide" @click=${prev}>‹</button>
          <button class="dx-carousel-arrow is-next" type="button" aria-label="Next slide" @click=${next}>›</button>`}
    ${o.showDots === false
      ? ""
      : html`<div class="dx-carousel-dots" role="tablist">${list(
          () => read(o.slides),
          (_s, i) => i,
          (_slide, i) =>
            html`<button
              class=${() => cx("dx-carousel-dot", active() === i && "is-active")}
              type="button"
              role="tab"
              aria-label=${`Slide ${i + 1}`}
              aria-selected=${() => (active() === i ? "true" : "false")}
              @click=${() => go(i)}
            ></button>`,
        )}</div>`}
  </div>`;
}
