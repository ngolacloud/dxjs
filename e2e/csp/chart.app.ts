// A charts demo built from @dxjs/charts, served under the SAME strict CSP as the
// other proofs (style-src 'self' via chart.css; script-src 'self' via the bundled
// module). Chart.js draws to <canvas> (no inline styles for the plot, no eval), so
// it must render with ZERO CSP violations. A signal drives a live update to prove
// the reactive path (signal → chart.update()).
import { signal } from "@dxjs/core";
import { html } from "@dxjs/dom";
import { component, mount } from "@dxjs/component";
import { chart } from "@dxjs/charts";

// A reactive series, mutated by the test to prove signal → chart.update().
const revenue = signal([120, 190, 140, 230, 200, 290]);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

const App = component(() => {
  return html`
    <h1>dxjs charts (strict CSP)</h1>
    <div class="grid">
      ${chart(() => ({
        kind: "bar",
        labels: MONTHS,
        series: [{ label: "Revenue", data: revenue() }],
        options: { animate: false },
      }))}
      ${chart({
        kind: "line",
        labels: MONTHS,
        series: [
          { label: "Signups", data: [30, 45, 38, 62, 70, 95] },
          { label: "Churn", data: [5, 8, 6, 9, 7, 11] },
        ],
        options: { animate: false },
      })}
      ${chart({
        kind: "doughnut",
        labels: ["Active", "Trial", "Past due", "Canceled"],
        series: [{ label: "Status", data: [62, 18, 7, 13] }],
        options: { animate: false },
      })}
    </div>
  `;
});

mount(App, document.getElementById("app")!, {});

// Expose hooks for the browser proof.
(window as unknown as { __bump: () => void }).__bump = () => revenue([300, 100, 320, 80, 260, 150]);
(window as unknown as { __dxready: boolean }).__dxready = true;
