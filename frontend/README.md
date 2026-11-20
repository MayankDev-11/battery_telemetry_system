# Voltview — BMS Telemetry Dashboard

A local, browser-based dashboard for exploring BMS telemetry exported from a CAN logger as CSV. It is designed for recorded vehicle runs: load a CSV, inspect pack signals, compare cell voltages, filter the samples, and export the rows you are investigating.

> **Important:** This is a telemetry visualizer, not a BMS, fault detector, protection system, or vehicle-safety instrument. It does not decode CAN frames, communicate with the car, establish safe operating limits, or replace the BMS. Status labels are displayed from the CSV as recorded.

## 1. Run it locally

Install Node.js 22 LTS (or a version satisfying Vite's Node requirement), then from this folder:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

For a production build:

```bash
npm run build
npm run preview
```

The project runs entirely in the browser after it is served. There is no Python server, database, API, or cloud upload required for CSV analysis.

## 2. Included demo data

The dashboard initially loads `public/sample-bms.csv`, which contains the 21 sample records supplied for this project. An additional `examples/extended-telemetry-example.csv` file demonstrates extra numeric channels such as motor RPM, inverter/coolant temperatures, and DC bus power; import it manually to try the dynamic graph picker. The UI labels it **DEMO DATA**. Select **Import CSV** to load a run recorded by the car. Select **Demo** in the top bar to return to the bundled example. Use the **Dark mode / Light mode** control in the top bar to switch the full dashboard theme; your selection is saved in this browser and restored on the next visit.

## 3. Expected CSV format

The parser requires only these structural columns:

```csv
timestamp_ms,can_id,pack_voltage_v,pack_current_a,soc_percent,pack_temperature_c,cell_01_voltage_v,cell_02_voltage_v,cell_03_voltage_v,cell_04_voltage_v,status
```

Example row:

```csv
0,0x100,360.03,42.21,85,28.98,3.601,3.609,3.588,3.600,NORMAL
```

Additional numeric columns can be appended before `status` or elsewhere in the header; the parser matches data by header name, not by column position.

Rules and assumptions:

- `timestamp_ms`, `can_id`, and `status` are the required structural columns.
- `timestamp_ms` is a numeric timestamp in **milliseconds**, relative to the start of the recording. The chart x-axis converts it to elapsed seconds.
- `can_id` is treated as text, so values such as `0x100` stay intact.
- Every other column containing at least one numeric value is discovered as a telemetry signal. This includes the four current pack signals, future channels such as `motor_rpm` or `inverter_temperature_c`, and cell voltages.
- Cell columns are identified by `cell_<number>_voltage_v`. The dashboard is not limited to four cells, and cell columns are handled in the dedicated Cell analysis page rather than being added to the overview graph picker.
- `status` is shown as text from the source log. Known labels such as `NORMAL`, `WARNING`, and `CRITICAL` receive visual styling, but no status is inferred from the electrical signals.
- Empty or non-numeric signal values are skipped in calculations and counted in the data-quality notes. Rows without a numeric timestamp are skipped. Duplicate timestamps are retained.
- Rows are sorted by timestamp for time-series analysis. The original source row number is retained internally.

Unknown numeric columns are immediately chartable. The signal registry only controls presentation metadata (friendly label, unit, colour, decimal precision, and whether the channel appears in the Recommended preset). The UI does not inspect a DBC file or discover signal scaling from raw CAN frames; the decoder must write correctly scaled values and unit-aware column names into the CSV.

## 4. Project structure

```text
bms-telemetry-dashboard/
├── public/
│   └── sample-bms.csv
├── examples/
│   └── extended-telemetry-example.csv
├── src/
│   ├── components/
│   │   ├── ChartCard.tsx
│   │   ├── SignalChartCard.tsx
│   │   ├── FileUploader.tsx
│   │   ├── MetricCard.tsx
│   │   ├── Sidebar.tsx
│   │   └── StatusPill.tsx
│   ├── lib/
│   │   ├── analytics.ts
│   │   ├── signalRegistry.ts
│   │   └── csv.ts
│   ├── pages/
│   │   ├── CellAnalysisPage.tsx
│   │   ├── OverviewPage.tsx
│   │   └── RawDataPage.tsx
│   ├── types/
│   │   └── telemetry.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

### What belongs in each file

| File | Responsibility |
|---|---|
| `src/main.tsx` | React entry point; mounts the app and global CSS. |
| `src/App.tsx` | Owns the active dataset, navigation, import state, demo reload, persistent light/dark theme selection, and top-level error/diagnostic messages. |
| `src/types/telemetry.ts` | Shared types for parsed rows, datasets, signal summaries, cell summaries, and dashboard navigation. |
| `src/lib/csv.ts` | Parses CSV text/files, checks structural headers, discovers every numeric telemetry column and cell channel, normalizes values, records data-quality diagnostics, and exports filtered rows. |
| `src/lib/analytics.ts` | Pure calculations for min/max/average/latest, cell comparisons, status transitions, time formatting, chart down-sampling, and table filters. |
| `src/lib/signalRegistry.ts` | Presentation catalogue for known telemetry keys plus automatic unit/label inference for unknown names. Add custom definitions here when a new signal needs a specific label, unit, colour, precision, or Recommended visibility. |
| `src/pages/OverviewPage.tsx` | Pack KPI cards, configurable signal graph picker/grid, latest cell snapshot, status distribution, run duration, and sample interval. |
| `src/pages/CellAnalysisPage.tsx` | Selectable cell-voltage time-series, latest cell comparison, and per-cell summary table. |
| `src/pages/RawDataPage.tsx` | Search, status filtering, pagination, complete parsed row inspection, and filtered CSV export. |
| `src/components/Sidebar.tsx` | Navigation and loaded-sample count. |
| `src/components/FileUploader.tsx` | File picker and drag-and-drop CSV import. |
| `src/components/MetricCard.tsx` | Reusable pack-signal KPI card. |
| `src/components/ChartCard.tsx` | Reusable chart panel framing and headings. |
| `src/components/SignalChartCard.tsx` | Reusable per-signal line/area graph with its own time-range brush and hide action. |
| `src/components/StatusPill.tsx` | Consistent visual treatment for recorded status strings. |
| `src/index.css` | Dashboard design tokens, light/dark theme palettes, layout, chart/table styling, and responsive behavior. |
| `public/sample-bms.csv` | Small example CSV used when the app first opens. |
| `examples/extended-telemetry-example.csv` | Optional test fixture with extra system/motor numeric signals to try automatic discovery. |
| `vite.config.ts` | Vite + React development/build configuration. |

## 5. Dependencies

### Runtime dependencies

- **React / React DOM** — component model and UI rendering.
- **Recharts** — responsive, interactive SVG charts, tooltips, legends, and brush controls.
- **Papa Parse** — CSV parsing and CSV export. File parsing uses a Web Worker where supported; worker configuration is kept free of callback functions so it can be safely transferred by the browser.
- **Lucide React** — consistent interface icons.

### Development dependencies

- **Vite** — local development server and production bundler.
- **TypeScript** — static typing for CSV rows, analytics, and React components.
- **@vitejs/plugin-react** — React support in Vite.
- **React / Papa Parse type packages** — TypeScript definitions.

No chart service, UI component framework, database, or backend dependency is required.

## 6. Adding a telemetry channel in the future

No parser or chart-page change is needed when the logger adds a new **numeric** column. For example, a later CSV can contain `motor_rpm`, `inverter_temperature_c`, `dc_bus_power_kw`, or `coolant_temperature_c`. The parser will discover the channel, the overview will show it in Telemetry graph controls, and Raw data will include the column automatically.

To customize how an automatically discovered channel appears, add it to `src/lib/signalRegistry.ts`:

```ts
const SIGNAL_REGISTRY = {
  // Existing entries...
  motor_rpm: {
    label: 'Motor speed',
    unit: 'rpm',
    color: '#527ce8',
    precision: 0,
    defaultVisible: true,
    category: 'motion',
  },
};
```

The generic signal catalogue already infers common suffix units such as `_voltage_v`, `_current_a`, `_temperature_c`, `_percent`, `_rpm`, `_speed_kmh`, `_pressure_kpa`, `_power_kw`, and `_energy_wh`. Add an explicit registry entry when the source uses a custom unit or needs a team-approved display name. These are presentation hints only; keep physical-unit conversion and scaling in the CAN decoder.

Cell voltage columns matching `cell_<number>_voltage_v` remain managed in Cell analysis, where the user can independently select visible cell traces.

## 7. How the data flows

```text
BMS on vehicle
   │
   ▼
CAN bus + CAN logger (outside this UI)
   │
   ▼
Raw/decoded CSV file
   │
   ▼
FileUploader.tsx ──► csv.ts ──► Dataset
                               │
                 ┌─────────────┼─────────────┐
                 ▼             ▼             ▼
            analytics.ts + signalRegistry.ts   OverviewPage / CellAnalysisPage / RawDataPage
                 │             │             │
                 └─────────────┴─────────────┘
                               ▼
                         Recharts + tables
```

The UI consumes **decoded signal columns**, as in the sample table. It is downstream of your Python `python-can` logger/decoder. A raw CAN logger normally records frame IDs and payload bytes; that raw log must first be decoded using the BMS message definition/DBC (or your documented byte layout), then aggregated into these wide snapshot rows. In particular, if pack and cell signals arrive in different CAN frames, an upstream step must align/merge them into one row per sampling instant. This UI does not receive CAN frames or parse arbitration IDs into BMS signals.

## 8. Interactive features

- Import a CSV from the top bar, or drag and drop it onto the empty-state uploader.
- Overview charts expose tooltips and individual brush controls to zoom the displayed time range.
- **Telemetry graph controls** lets you show/hide each numeric signal graph, select Recommended / Show all / Clear, hide the latest-cell snapshot, and switch an individual graph between Line and Area. The selected graph list is saved in browser local storage.
- New numeric columns are discovered from the CSV and added to the graph picker and raw-data table without changing the parser or page components.
- The cell page lets you show/hide individual cell traces, compare latest voltages, and use its own draggable time-range brush below the cell-voltage-over-time chart.
- Raw data can be searched across the row values and filtered by the recorded status.
- Filtered raw rows can be exported to a separate CSV.
- Switch between light and dark appearance from any page; the preference is stored locally in the browser (`localStorage`) and applied to charts, tables, controls, cards, and navigation.
- The CSV parser reports missing structural columns, invalid timestamps, missing signal values, out-of-order rows, and duplicate timestamps.
- Time-series charts down-sample to at most roughly 1,200 plotted points for responsiveness. Summary values, cell summaries, the raw table, and exports use the full accepted dataset.

## 9. Sensible next steps for a real car workflow

1. **Freeze the logging schema.** Keep units, column names, timestamp origin, and status semantics stable across test sessions. Record a schema/version field in the file or in a run manifest.
2. **Add run metadata.** Include car number, test date, driver, track/session, firmware commit, BMS configuration, and logger version in a sidecar JSON or a metadata header. Do not overload signal columns with metadata.
3. **Add signal provenance.** Record which CAN ID/message and DBC signal produced each CSV field, including scaling, byte order, signedness, and units. This is especially important if the logger later changes from decoded CSV to raw CAN frames.
4. **Agree on alarm semantics with the BMS team.** If warning limits are ever displayed, load reviewed, chemistry- and configuration-specific limits from a versioned config. Do not bake guessed thresholds into chart colors.
5. **Test against captured files.** Add fixture CSVs for missing samples, malformed rows, status transitions, different cell counts, long runs, and timestamp discontinuities.
6. **Scale only when needed.** This implementation keeps accepted rows in browser memory. For very large multi-hour logs, move parsing/aggregation to a backend or IndexedDB-backed worker and fetch chart windows on demand.

## 10. Verification status

The source project and example CSV are included. Dependency installation/build could not be run in this environment because the package registry connection timed out; run `npm install` and `npm run build` locally to verify dependency resolution and the production bundle.
