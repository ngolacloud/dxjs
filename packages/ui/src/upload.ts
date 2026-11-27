// @dxjs/ui/upload — a file dropzone with a selected-file list (name, size,
// per-file progress and status). The picker is a native <label><input hidden>
// pair, so clicking opens the file dialog with NO javascript (CSP-safe); drag &
// drop reads e.dataTransfer.files. Progress fill is an SVG rect width ATTRIBUTE,
// never an inline style. Pure `formatBytes` exported so the math is testable.

import { signal } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, cx, type Maybe } from "./base.ts";
import { icon } from "./icons.ts";

/** Human-readable byte size (1024-based): 980 → "980 B", 1536 → "1.5 KB". */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10} ${units[i]}`;
}

export type UploadStatus = "pending" | "uploading" | "done" | "error";
export interface UploadItem {
  id: string;
  name: string;
  size: number;
  /** 0..1 upload fraction (for status "uploading"). */
  progress?: number;
  status?: UploadStatus;
  /** Error message (for status "error"). */
  error?: string;
}

export interface UploadOptions {
  /** Called with the dropped/picked files (the caller starts the upload and owns `items`). */
  onFiles?: (files: File[]) => void;
  /** The controlled list of files to show with their progress/status. */
  items?: Maybe<UploadItem[]>;
  onRemove?: (id: string) => void;
  /** `accept` attribute, e.g. "image/*,.pdf". */
  accept?: string;
  multiple?: boolean;
  /** Reject files larger than this many bytes before calling onFiles. */
  maxSize?: number;
  /** Helper line under the prompt. */
  hint?: string;
  disabled?: boolean;
}

/** A file upload dropzone + list. Drop files or click to pick; each file shows
 *  its size and, when the caller feeds `items`, a progress bar and status. */
export function fileUpload(o: UploadOptions): TemplateResult {
  const dragging = signal(false);

  const take = (files: FileList | File[] | null | undefined): void => {
    if (!files || o.disabled) return;
    let list = Array.from(files);
    if (o.maxSize != null) list = list.filter((f) => f.size <= o.maxSize!);
    if (list.length) o.onFiles?.(list);
  };

  const statusIcon = (it: UploadItem): TemplateResult | string => {
    switch (it.status) {
      case "done": return icon("check", { class: "dx-up-ok" });
      case "error": return icon("alert", { class: "dx-up-err" });
      default: return "";
    }
  };

  const row = (it: UploadItem): TemplateResult => {
    const pct = (): number => Math.max(0, Math.min(1, it.progress ?? 0)) * 100;
    const uploading = it.status === "uploading";
    return html`<li class=${cx("dx-up-item", it.status && `is-${it.status}`)}>
      <span class="dx-up-file-ico" aria-hidden="true">${icon("file-text", { size: 16 })}</span>
      <div class="dx-up-file">
        <div class="dx-up-file-head">
          <span class="dx-up-name" title=${it.name}>${it.name}</span>
          <span class="dx-up-size">${formatBytes(it.size)}</span>
        </div>
        ${uploading
          ? html`<svg class="dx-up-bar" viewBox="0 0 100 3" preserveAspectRatio="none" aria-hidden="true"><rect class="dx-up-bar-fill" x="0" y="0" width=${() => pct()} height="3" rx="1.5"></rect></svg>`
          : ""}
        ${it.status === "error" && it.error ? html`<span class="dx-up-msg">${it.error}</span>` : ""}
      </div>
      <span class="dx-up-status" aria-hidden="true">${statusIcon(it)}</span>
      ${o.onRemove
        ? html`<button class="dx-up-x" type="button" aria-label=${`Remove ${it.name}`} @click=${() => o.onRemove!(it.id)}>${icon("x", { size: 15 })}</button>`
        : ""}
    </li>`;
  };

  return html`<div class="dx-up">
    <label
      class=${() => cx("dx-up-zone", dragging() && "is-drag", o.disabled && "is-disabled")}
      @dragover=${(e: DragEvent) => {
        if (o.disabled) return;
        e.preventDefault();
        dragging.set(true);
      }}
      @dragleave=${() => dragging.set(false)}
      @drop=${(e: DragEvent) => {
        e.preventDefault();
        dragging.set(false);
        take(e.dataTransfer?.files);
      }}
    >
      <span class="dx-up-zone-ico" aria-hidden="true">${icon("upload", { size: 24 })}</span>
      <span class="dx-up-prompt"><strong>Click to upload</strong> or drag and drop</span>
      ${o.hint ? html`<span class="dx-up-hint">${o.hint}</span>` : ""}
      <input
        class="dx-up-input"
        type="file"
        accept=${o.accept ?? false}
        ?multiple=${o.multiple ?? false}
        ?disabled=${o.disabled ?? false}
        @change=${(e: Event) => {
          const el = e.target as HTMLInputElement;
          take(el.files);
          el.value = "";
        }}
      />
    </label>
    ${() => {
      const items = read(o.items ?? []);
      return items.length ? html`<ul class="dx-up-list">${list(() => read(o.items ?? []), (it) => it.id, row)}</ul>` : "";
    }}
  </div>`;
}
