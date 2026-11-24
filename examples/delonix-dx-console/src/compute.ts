// Pure container domain — ported faithfully from the delonix-console React app
// (src/domains/compute). Zero UI, zero network: it returns tokens (`running`,
// `unknown`), and the UI gives them words/colour. This is the parity reference.

export const CONTAINER_STATUSES = ["running", "exited", "paused", "dead", "created"] as const;
export type ContainerStatus = (typeof CONTAINER_STATUSES)[number];
export type NormalisedStatus = ContainerStatus | "unknown";
export type Tone = "pos" | "neg" | "warn" | "mut";

export interface Container {
  id: string;
  name: string;
  image: string;
  tag: string;
  status: string;
  cpu: number; // percent
  mem: number; // bytes used
  memLimit: number; // bytes; 0 = no limit (∞)
  stack: string;
  uptime: string;
  ip: string;
}

/** Unknown words become `unknown` — never faked as a known state. */
export function normaliseStatus(raw: string): NormalisedStatus {
  return (CONTAINER_STATUSES as readonly string[]).includes(raw) ? (raw as ContainerStatus) : "unknown";
}

export const isRunning = (c: Container): boolean => normaliseStatus(c.status) === "running";

/** The console's status→tone map (running green, exited neutral, paused amber, dead red, created blue). */
export const CONTAINER_TONE: Record<NormalisedStatus, Tone> = {
  running: "pos",
  exited: "mut",
  paused: "warn",
  dead: "neg",
  created: "mut",
  unknown: "mut",
};

/** CPU of a stopped container is `—` (null), not "0 %". */
export function cpuPercent(c: Container): number | null {
  return isRunning(c) ? c.cpu : null;
}

export interface MemoryUsage {
  used: number;
  limit: number; // 0 = no limit
  percent: number | null; // null when there is no limit or the container is stopped
}
export function memoryUsage(c: Container): MemoryUsage {
  const percent = c.memLimit > 0 && isRunning(c) ? Math.min(100, (c.mem / c.memLimit) * 100) : null;
  return { used: c.mem, limit: c.memLimit, percent };
}

export const runningCount = (cs: readonly Container[]): number => cs.filter(isRunning).length;

/** First 12 hex chars of the id (the console's shortId). */
export const shortId = (id: string): string => (id.length > 12 ? id.slice(0, 12) : id);

// --- actions ---------------------------------------------------------------
export const CONTAINER_ACTIONS = ["start", "stop", "restart", "pause", "unpause", "rm"] as const;
export type ContainerAction = (typeof CONTAINER_ACTIONS)[number];

/** Exactly the console's rule: which actions a status allows. */
export function availableActions(status: NormalisedStatus): readonly ContainerAction[] {
  switch (status) {
    case "running":
      return ["stop", "restart", "pause", "rm"];
    case "paused":
      return ["unpause", "rm"];
    case "exited":
    case "created":
      return ["start", "rm"];
    case "dead":
      return ["rm"];
    default:
      return [];
  }
}

// --- client filters (over the current page) --------------------------------
export const CONTAINER_FILTERS = ["all", "running", "paused", "stopped"] as const;
export type ContainerFilter = (typeof CONTAINER_FILTERS)[number];

const FILTER_SET: Record<ContainerFilter, readonly NormalisedStatus[] | null> = {
  all: null,
  running: ["running"],
  paused: ["paused"],
  stopped: ["exited", "dead", "created"],
};

export function matchesFilter(c: Container, filter: ContainerFilter): boolean {
  const wanted = FILTER_SET[filter];
  return wanted === null || wanted.includes(normaliseStatus(c.status));
}

/** Human bytes (MiB/GiB), matching the console's formatBytes shape. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
