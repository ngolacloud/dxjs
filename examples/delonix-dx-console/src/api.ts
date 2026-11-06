// A self-contained mock of the delonix-paas tenant API (no network). It mirrors
// the shapes the console reads: GET /v2/containers (server-paginated), the KPI
// resource counts, container actions, deploy, and logs. Deterministic data so the
// browser proof + screenshots are stable.

import { CONTAINER_STATUSES, normaliseStatus, type Container, type ContainerAction } from "./compute.ts";

export interface Page<T> {
  items: T[];
  total: number; // the server's total (across pages)
  count: number; // items returned on this page
}

const IMAGES = ["nginx", "postgres", "redis", "node", "golang", "caddy", "rabbitmq", "grafana"];
const STACKS = ["", "web", "web", "data", "edge", "observability"];
const TAGS = ["1.27", "16", "7", "22", "1.23", "latest", "3.13", "11"];

const MiB = 1024 * 1024;

function seedContainers(n: number): Container[] {
  const out: Container[] = [];
  for (let i = 0; i < n; i++) {
    const status = CONTAINER_STATUSES[i % CONTAINER_STATUSES.length]!;
    const img = IMAGES[i % IMAGES.length]!;
    const running = status === "running";
    out.push({
      id: `6a99bc${(i * 48271).toString(16).padStart(10, "0").slice(0, 10)}`,
      name: `${img}-${i + 1}`,
      image: img,
      tag: TAGS[i % TAGS.length]!,
      status,
      cpu: running ? Number((((i * 37) % 950) / 10).toFixed(1)) : 0,
      mem: running ? (40 + ((i * 53) % 400)) * MiB : 0,
      memLimit: i % 4 === 0 ? 0 : 512 * MiB, // every 4th: no limit (∞)
      stack: STACKS[i % STACKS.length]!,
      uptime: running ? `${1 + (i % 72)}h` : "—",
      ip: running ? `10.1.${(i % 6) + 1}.${(i % 200) + 2}` : "—",
    });
  }
  return out;
}

// The in-memory store (mutated by actions/deploy), plus static KPI counts.
let containers = seedContainers(57);
const counts = { images: 23, stacks: 6, networks: 4, volumes: 11 };
const volumeBytes = 48 * 1024 * MiB;
const imageBytes = 3100 * MiB;

const delay = (ms = 140): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const api = {
  async listContainers(opts: { limit: number; offset: number }): Promise<Page<Container>> {
    await delay();
    const items = containers.slice(opts.offset, opts.offset + opts.limit).map((c) => ({ ...c }));
    return { items, total: containers.length, count: items.length };
  },

  async kpis(): Promise<{
    containers: Page<Container>;
    images: { total: number; bytes: number };
    stacks: { total: number; healthy: number };
    networks: { total: number };
    volumes: { total: number; bytes: number };
  }> {
    await delay();
    return {
      containers: { items: containers.map((c) => ({ ...c })), total: containers.length, count: containers.length },
      images: { total: counts.images, bytes: imageBytes },
      stacks: { total: counts.stacks, healthy: 4 },
      networks: { total: counts.networks },
      volumes: { total: counts.volumes, bytes: volumeBytes },
    };
  },

  /** Apply a lifecycle action; mirrors the console's optimistic → confirm flow. */
  async action(id: string, action: ContainerAction): Promise<void> {
    await delay(90);
    containers = containers
      .map((c) => {
        if (c.id !== id) return c;
        const next: Container = { ...c };
        if (action === "stop") Object.assign(next, { status: "exited", cpu: 0, mem: 0, uptime: "—", ip: "—" });
        else if (action === "start" || action === "restart")
          Object.assign(next, { status: "running", cpu: 4.2, mem: 64 * MiB, uptime: "0h", ip: "10.1.9.9" });
        else if (action === "pause") next.status = "paused";
        else if (action === "unpause") next.status = "running";
        return next;
      })
      .filter((c) => !(c.id === id && action === "rm"));
  },

  /** Deploy a new container (prepended, like the console after a create). */
  async deploy(spec: { name: string; image: string; tag: string }): Promise<void> {
    await delay(120);
    const id = `6a99bcnew${Date.now().toString(16)}`.slice(0, 16);
    containers = [
      {
        id,
        name: spec.name,
        image: spec.image,
        tag: spec.tag || "latest",
        status: "running",
        cpu: 1.1,
        mem: 32 * MiB,
        memLimit: 512 * MiB,
        stack: "",
        uptime: "0h",
        ip: "10.1.9.42",
      },
      ...containers,
    ];
  },

  /** Container logs — long, so the UI virtualizes them. */
  async logs(id: string): Promise<string[]> {
    await delay(60);
    const c = containers.find((x) => x.id === id);
    const name = c ? c.name : id;
    return Array.from({ length: 4000 }, (_, i) => {
      const lvl = i % 23 === 0 ? "WARN" : i % 101 === 0 ? "ERROR" : "INFO";
      return `2026-11-06T10:${String(i % 60).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}Z ${lvl} [${name}] request ${i} handled in ${(i % 90) + 3}ms`;
    });
  },
};

export type Api = typeof api;
export { normaliseStatus };
