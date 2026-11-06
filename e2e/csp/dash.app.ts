// A polished admin dashboard built from @dxjs/ui, served under the SAME strict
// CSP as the other proofs (style-src 'self' via the linked dash.css — the kit
// only toggles classes, no inline styles). Mirrors the TalentPros reference:
// dark sidebar, a grid of KPI tiles, and a sortable/searchable/paginated table.
import { signal } from "@dxjs/core";
import { html } from "@dxjs/dom";
import { appShell, statGrid, dataTable, pill, type Tone } from "@dxjs/ui";

interface Company {
  id: string;
  name: string;
  plan: "Solo" | "Team";
  mrr: number;
  status: "Active" | "Trial" | "Past due" | "Canceled";
}
const PLANS = ["Solo", "Team"] as const;
const STATUS = ["Active", "Trial", "Past due", "Canceled"] as const;
const companies: Company[] = Array.from({ length: 23 }, (_, i) => ({
  id: `c${i}`,
  name: `${["Acme", "Globex", "Initech", "Umbrella", "Stark", "Wayne", "Hooli", "Pied Piper"][i % 8]} ${i + 1}`,
  plan: PLANS[i % 2]!,
  mrr: 29 + ((i * 53) % 420),
  status: STATUS[i % 4]!,
}));
const statusTone = (s: Company["status"]): Tone =>
  s === "Active" ? "pos" : s === "Trial" ? "mut" : s === "Past due" ? "warn" : "neg";

const active = signal("Overview");
const navItem = (label: string) => ({ label, active: active() === label, onSelect: () => active.set(label) });

const content = html`
  <h1 class="dx-h1">Overview</h1>
  <p class="dx-sub">Your command center — key metrics at a glance.</p>
  ${statGrid([
    { label: "Active Companies", value: "1,247", delta: "+12.4%", tone: "pos" },
    { label: "Trial Companies", value: "89", delta: "12 this week", tone: "mut" },
    { label: "MRR", value: "$62,350", delta: "+12.4% MoM", tone: "pos" },
    { label: "ARPU", value: "49.96", delta: "-2.30% MoM", tone: "neg" },
    { label: "Churn Rate", value: "2.1%", delta: "-0.3% MoM", tone: "pos" },
    { label: "Failed Payments", value: "7", delta: "3 retrying", tone: "warn" },
    { label: "Canceled", value: "34", delta: "This month", tone: "neg" },
    { label: "YoY Growth", value: "68.2%", delta: "vs last year", tone: "mut" },
  ])}
  ${dataTable<Company>({
    title: "Companies",
    columns: [
      { key: "name", label: "Company", sortable: true, render: (r) => html`<a class="dx-link" href="#">${r.name}</a>` },
      { key: "plan", label: "Plan", sortable: true },
      { key: "mrr", label: "MRR", numeric: true, sortable: true, value: (r) => r.mrr, render: (r) => `$${r.mrr}` },
      { key: "status", label: "Status", sortable: true, value: (r) => r.status, render: (r) => pill(r.status, statusTone(r.status)) },
    ],
    rows: companies,
    rowKey: (r) => r.id,
    pageSize: 8,
    toolbar: html`<button class="dx-btn">Customise</button><button class="dx-btn is-primary">Export CSV</button>`,
  })}
`;

const shell = appShell({
  brand: "TalentPros",
  nav: () =>
    ["Overview", "Companies", "Analytics", "Coupons", "Broadcasts", "Activity Logs", "System Alerts", "Admin Management", "Settings"].map(
      navItem,
    ),
  user: { name: "Super Admin", initials: "AU" },
  search: { placeholder: "Search companies, invoices…" },
  content,
});

import { render } from "@dxjs/dom";
render(shell, document.getElementById("app")!);
(window as unknown as { __dxready: boolean }).__dxready = true;
