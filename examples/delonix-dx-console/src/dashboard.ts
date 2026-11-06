// Dashboard — the delonix-console "home" reproduced on dxjs: a KPI row (containers/
// images/stacks/networks/volumes), a status-breakdown chart, and a running-containers
// table. Data comes through @dxjs/query (cache + dedupe + SWR); the KPI cards and the
// table read the SAME ["kpis"] query, so it is one request shared (parity with the
// console's useDashboard).
import { html, type TemplateResult } from "@dxjs/dom";
import { component } from "@dxjs/component";
import { statGrid, card, dataTable, pill, type Column } from "@dxjs/ui";
import { chart } from "@dxjs/charts";
import { query } from "@dxjs/query";
import { useApp } from "./ctx.ts";
import { meter, usageTone } from "./widgets.ts";
import {
  CONTAINER_STATUSES,
  CONTAINER_TONE,
  cpuPercent,
  formatBytes,
  isRunning,
  memoryUsage,
  normaliseStatus,
  runningCount,
  type Container,
} from "./compute.ts";

export const DashboardPage = component(() => {
  const { api, qc, tenant } = useApp();
  const kpis = query(qc, ["kpis"], () => api.kpis(), { staleTime: 10_000 });

  const containers = (): Container[] => kpis.data()?.containers.items ?? [];
  const statusData = (): number[] =>
    CONTAINER_STATUSES.map((s) => containers().filter((c) => normaliseStatus(c.status) === s).length);

  const kpi = (value: () => string, sub: () => string, label: string, tone: "pos" | "mut"): Parameters<typeof statGrid>[0][number] => ({
    label,
    value,
    delta: sub,
    tone,
  });

  const memCell = (c: Container): TemplateResult => {
    const u = memoryUsage(c);
    const label = `${formatBytes(u.used)} / ${u.limit > 0 ? formatBytes(u.limit) : "∞"}`;
    return meter(u.percent, label, u.percent === null ? "mut" : usageTone(u.percent));
  };

  const runningTable = dataTable<Container>({
    columns: [
      { key: "name", label: "Name", sortable: true, render: (r) => html`<span class="name">${r.name}</span>` },
      { key: "image", label: "Image", render: (r) => html`<span class="tag">${r.image}:${r.tag}</span>` },
      { key: "ip", label: "IP", value: (r) => r.ip },
      {
        key: "cpu",
        label: "CPU",
        render: (r) => {
          const p = cpuPercent(r);
          return meter(p, p === null ? "—" : `${p.toFixed(1)} %`, p === null ? "mut" : usageTone(p));
        },
      },
      { key: "memory", label: "Memory", render: memCell },
      {
        key: "status",
        label: "Status",
        value: (r) => r.status,
        render: (r) => pill(r.status, CONTAINER_TONE[normaliseStatus(r.status)]),
      },
    ],
    rows: () => containers().filter(isRunning),
    rowKey: (r) => r.id,
    pageSize: 8,
    search: false,
  });

  return html`
    <h1 class="dx-h1">Overview</h1>
    <p class="dx-sub muted">Tenant <b>${tenant}</b> · GET /v2/containers · /v2/images · /v2/stacks · /v2/net/networks · /v2/volumes</p>

    ${statGrid([
      kpi(
        () => (kpis.data() ? String(kpis.data()!.containers.total) : "…"),
        () => (kpis.data() ? `${runningCount(containers())} running of ${kpis.data()!.containers.count}` : "loading…"),
        "Containers",
        "pos",
      ),
      kpi(
        () => (kpis.data() ? String(kpis.data()!.images.total) : "…"),
        () => (kpis.data() ? `${formatBytes(kpis.data()!.images.bytes)} on disk` : "loading…"),
        "Images",
        "mut",
      ),
      kpi(
        () => (kpis.data() ? String(kpis.data()!.stacks.total) : "…"),
        () => (kpis.data() ? `${kpis.data()!.stacks.healthy} healthy` : "loading…"),
        "Stacks",
        "pos",
      ),
      kpi(() => (kpis.data() ? String(kpis.data()!.networks.total) : "…"), () => "VPC networks", "Networks", "mut"),
      kpi(
        () => (kpis.data() ? String(kpis.data()!.volumes.total) : "…"),
        () => (kpis.data() ? `${formatBytes(kpis.data()!.volumes.bytes)} used` : "loading…"),
        "Volumes",
        "mut",
      ),
    ])}

    <div class="dx-row">
      ${card({
        title: "Containers by status",
        body: chart(() => ({
          kind: "doughnut",
          labels: [...CONTAINER_STATUSES],
          series: [{ label: "Containers", data: statusData() }],
          options: {
            animate: false,
            palette: ["#16a34a", "#64748b", "#d97706", "#dc2626", "#2563eb"],
          },
        })),
      })}
      ${card({ title: "Running containers", body: runningTable })}
    </div>
  `;
});
