# FirelineLab

A single-page, browser-local educational forest/fire simulation studio. **Fireline** is amber; **Lab** is mint. The original contour-flame mark lives in `icon.svg`.

## Run locally

Requires Node.js 20 or newer. No package installation is needed.

```sh
npm start
```

Open http://127.0.0.1:4173. The server binds only to loopback. `npm test` runs the deterministic simulation checks.

## Explore

1. Choose mixed woodland, dry pine, or dense regrowth. Adjust forest structure, then **Apply landscape & reset**.
2. Set **Duration (years)** at the top of Experiment setup (1–200 years). Increasing it extends an existing run without resetting. On the Experiments page, select **Duration** above the parallel maps, then **Load current setup**; that same duration also applies to newly started multi-seed tests. Set weather, lightning, spread model, growth, and treatment schedule. These settings apply on the next simulation step.
3. Use **Ignite** or **Rx burn** and click the map; press **Run simulation**, or step a day at a time. With the map focused, arrow keys select a cell and Enter applies the current tool.
4. Paint thinning and persistent firebreaks. Edits made before the first ignition/time step become part of the baseline. Later edits are interventions.
5. Open **Experiments** and **Load current setup** to watch synchronized unmanaged and managed forests. Run, pause, step, fast-forward, reset the frozen pair, switch both map layers, or save both outcomes to the notebook.
6. Choose 20, 50, or 100 paired seeds and **Test across seeds**. A background worker holds the exact starting forest fixed and varies stochastic weather, lightning, spread, and recruitment. Within every pair, weather and lightning match. Canceling discards the new incomplete sample and preserves the preceding completed result.
7. Export an **Experiment report** from the current simulation, a paired experiment, a saved run, or a multi-seed result. The self-contained HTML embeds maps, trajectories, settings, and results. Its Print / Save as PDF button uses the browser print dialog. Export the multi-seed CSV for individual endpoint measurements.

The map supports vegetation, fuel load, age, terrain, and burn history layers. The event journal records ignitions, treatment, and runtime setting changes. Export time-series data as CSV or a complete starting scenario as JSON.

**Save workspace** stores the starting landscape, current settings, and experiment summaries in this browser. It intentionally does not resume an in-progress simulation. Scenario JSON includes the painted baseline but not saved run summaries. No accounts, server database, analytics, or external APIs are used. Google Fonts is an optional visual dependency with system fallbacks.

The latest completed multi-seed result is saved separately in browser storage, including report images and sampled histories. Older saved single runs remain compatible but may lack map images and original mature-cohort survival. Storage-limit failures are shown in the app; export files to keep results independently of browser storage.

Multi-seed summaries use the **median of paired differences**, not the difference of the two policy medians. The 10th–90th percentile band is the empirical spread of sampled outcomes, not a confidence interval. Improvement is defined separately for each metric. Original mature survival tracks the starting cohort and includes losses to both fire and thinning; recruitment cannot replenish it. Fire-caused stand losses exclude thinning.

## Model contract

- 80 × 56 stand cells; each is 50 × 50 m (0.25 ha). Area is illustrative; spread timing is not calibrated to this spatial scale.
- An ecological day advances age, brush, litter, and recruitment, then runs four abstract fire pulses. There are 365 days per model year.
- **Neighbor threshold:** adjacent mature stands ignite probabilistically. Weather is excluded from propagation in this baseline mode.
- **Surface + wind:** fuel, moisture, wind alignment, relative slope, and neighbor distance modify spread probability.
- **Ember + crown:** adds wind-carried spot ignitions and mature-canopy propagation at higher source intensity.
- Fire consumes fuel and can kill tree stands, with lower modeled mortality for mature stands. Recruitment resumes after a 90-day post-burn delay. Mortality counts are cumulative; a regenerated stand can die again.
- Prescribed fires begin with lower intensity and can escape their target strip. There is no operational weather safety gate. The strip rotates at each treatment cycle. Thinning exports biomass before ignition.
- The pre-burn landscape is copied, never mutated by simulation. Reset retains current environmental/management settings. Separate counter-based random channels preserve paired weather/lightning regardless of differing fire activity.
- Unique burned footprint counts a cell once. Cumulative area counts repeated ignitions, attributed to wildfire/manual or prescribed origin, including escaped prescribed-origin fire.
- Fuel index = `100 * (mean brush + 0.8 * mean dead fuel) / 1.8`. Intensity and fuel are dimensionless scores, not measured energy or fuel tonnage.
- Coefficients are authored for qualitative exploration, not calibrated to real ecosystems. No prediction, safe-burn planning, smoke, buildings, fire crews, or validated mortality model is provided. Sources and assumptions are accessible in **Model notes**.

## Publishing later

The public app is static: deploy `index.html`, `style.css`, `icon.svg`, and all browser `.js` files (`app`, `engine`, `experiments`, `experiments-core`, `experiment-graphics`, `experiment-report`, and `ensemble-worker`) together on any static host. Serve JavaScript with a JavaScript MIME type so the module worker can load. `server.mjs` is only the local preview server. Nothing has been publicly deployed. Before a public launch, decide on branding/domain availability, a license, and whether to add hosted scenario sharing. Local JSON exports already allow scenario exchange.

## Files

- `engine.js`: deterministic, DOM-independent simulation.
- `app.js`: controls, map/chart rendering, experiments, and persistence.
- `style.css`: responsive dashboard styling.
- `experiments.js`: synchronized comparison UI, multi-seed worker orchestration, and report previews.
- `experiments-core.js`: paired-run coordination, seed selection, empirical summaries, and CSV serialization.
- `ensemble-worker.js`: background multi-seed simulations.
- `experiment-graphics.js`: comparison maps and portable SVG charts.
- `experiment-report.js`: self-contained report generation and print styles.
- `tests/engine.test.mjs`: repeatability, environmental invariants, scheduling, probability distribution, boundary validation, and model checks.
- `tests/experiments.test.mjs`: paired clocks, seed selection, cohort survival, aggregation, CSV, and report escaping.
