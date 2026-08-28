# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Better Planner is a [Super Productivity](https://super-productivity.com/) **plugin**, not a
standalone app. It renders inside an iframe hosted by the Super Productivity host app and adds
a "Better Planner" nav tab: a wide, multi-day planning view (3-Day columns today, with a 1-Day
timeline view still a placeholder — see `renderComingSoon` in `src/index.ts`).

## Commands

```bash
npm run dev         # Vite dev server, for quick iteration on markup/styles
npm run build        # produces a self-contained dist/index.html
npm run package       # build + zip dist/ into better-planner-vX.Y.Z.zip
npm run typecheck
npm run lint
npm run format        # prettier --write .
```

No test suite exists in this repo.

For local end-to-end testing against a real Super Productivity checkout, set
`SP_BUNDLED_PLUGINS_DIR` before running `dev`/`build` so Vite copies each build straight into
that checkout's bundled-plugins dir:

```bash
SP_BUNDLED_PLUGINS_DIR=../super-productivity/assets/bundled-plugins/better-planner npm run dev
```

There is no live hot-reload of a _running_ plugin instance inside the host app — after a build,
reload the host app or toggle the plugin off/on in Settings → Plugins.

Releasing: `.github/workflows/release-please.yml` runs `release-please` on every push to `main`,
which opens/updates a release PR that bumps `package.json`/`src/manifest.json` from Conventional
Commits and maintains `CHANGELOG.md`. Merging that PR makes release-please tag the repo and
publish a GitHub Release; a second job in the same workflow (gated on release-please's
`release_created` output) then checks out that tag, runs `npm run package`, and uploads the
resulting zip as a release asset. This has to live in the *same* workflow as release-please
rather than a separate workflow triggered by the `release` event — GitHub Actions doesn't let
events produced by the default `GITHUB_TOKEN` trigger other workflows, so a `release: [published]`
trigger would never fire here. Version bumps are driven by release-please from commit messages,
not by hand-editing `manifest.json`/`package.json` locally.

## Architecture

### It's an iframe app, not a web app

The host app builds an `iframe[srcdoc]` from `dist/index.html` and fills the routed content area
with it — genuinely separate DOM, own CSS/JS, no host-imposed component framework. There is a
hard **100KB size cap** on the built `index.html` (enforced at upload by the host). This is why
the UI is vanilla TypeScript + DOM (`src/dom.ts`'s tiny `el()`/`clear()` helpers), no framework
runtime, and native HTML5 drag-and-drop (`src/dnd.ts`) instead of a DnD library.

The custom Vite plugin (`scripts/super-productivity-vite-plugin.ts`, vendored from Super
Productivity's own `packages/vite-plugin` since it isn't published to npm) inlines the built JS
and CSS directly into `index.html` (`inlineAssets: true`) so the shipped plugin is one
self-contained file, and copies `manifest.json`/icon/i18n into `dist/`. Keep this size budget in
mind before adding dependencies or large assets.

### Two entry points

- `src/plugin.ts` — the background script that runs in the host renderer (declared as `plugin:`
  in the Vite build). Kept minimal by design; currently just logs on load. Hook registration for
  things that must run even when the UI isn't open would go here, not in `index.ts`.
- `src/index.ts` — the UI entry point, loaded inside the iframe. Owns the render loop: fetches
  state via `PluginAPI.getAppState()`, derives `PlannerData` (`src/data.ts`), and re-renders the
  whole tree on every relevant change. There's no diffing/virtual DOM — `render()` clears and
  rebuilds `#root` each time (see `clear`/`el` in `src/dom.ts`). Re-renders are triggered by
  `PluginAPI.registerHook(...)` callbacks (`ANY_TASK_UPDATE`, `TASK_CREATED`, `TASK_DELETE`,
  `TASK_COMPLETE`, `CURRENT_TASK_CHANGE`) so edits made anywhere in the host app (not just this
  plugin) stay reflected live.

`PluginAPI` is a global provided by the host at runtime (declared in `src/global.d.ts`), typed
via the vendored `@super-productivity/plugin-api` types under `types/plugin-api/` (path-mapped
in `tsconfig.json`). **Don't edit `types/plugin-api/`** — it's vendored, and is excluded from
both ESLint (`eslint.config.js` ignores) and Prettier (`.prettierignore`).

### Data flow

- `src/data.ts` — `buildPlannerData(appState, todayKey)` turns the raw host state (tasks,
  projects, tags) into a `PlannerData` snapshot, splitting non-done tasks into `overdue` and
  `unplanned` buckets. `getDayBucket(data, date, todayKey, persistedOrder)` derives one day's
  `scheduled` (has `dueWithTime`) and `unscheduled` (day-assigned, no time) task lists on demand,
  applying persisted manual ordering via `reconcileOrder` (`src/persistence.ts`).
- `src/persistence.ts` — plugin-local state (currently just per-day manual task ordering) synced
  via `PluginAPI.persistDataSynced`/`loadSyncedData` under the key `'better-planner-state'`.
  `reconcileOrder` drops stale ids and appends new/unordered ones at the end — always run live
  task ids through this rather than trusting persisted order blindly.
- `src/views/*.ts` — pure-ish DOM-builder functions (`renderToolbar`, `renderThreeDayView`,
  `renderDayColumn`, `renderTaskRow`, `renderUnscheduledRail`, `renderAddTaskRow`), each
  returning an `HTMLElement` and taking callbacks for user actions. They don't call `PluginAPI`
  directly — `src/index.ts` owns all writes and passes callbacks down.
- `src/dnd.ts` — drag-source/drop-zone attachment helpers built on native HTML5 DnD events.
- `src/colors.ts` — resolves a stable display color for a project/tag, falling back to a
  hash-based palette pick when the host doesn't provide one.

### The `dueDay` vs. `PlannerState.days` gotcha

The host app has **two independent mechanisms** for "which day is this task on": the
plugin-visible `task.dueDay` field, and a separate NgRx `PlannerState.days` entity that is
**not exposed to plugins at all** and is what the host's own built-in Planner renders for
non-today days.

- **Writing** is fully interoperable: `PluginAPI.updateTask(id, { dueDay })` and
  `PluginAPI.addTask({ dueDay })` go through the host's generic update path, which mirrors the
  change into `PlannerState.days` (or into the `TODAY` tag's `taskIds` for today) automatically.
  This is the _only_ way this plugin should assign a task to a day — never try to invent another
  path.
- **Reading** has one disclosed, accepted gap: a task planned onto a _future_ day using the
  built-in Planner's own inline "+ Add" box (not dragged) leaves `dueDay` unset, so this plugin
  won't see it until it's edited or dragged elsewhere. This is a known host-app inconsistency,
  not a bug to "fix" in this plugin.
- **Today is a full exception**: `dueDay === today` also mirrors into the `TODAY` tag's
  `taskIds`, which _is_ independently readable/writable/reorderable via `PluginAPI.updateTag('TODAY',
{ taskIds })`. This plugin uses that for fully-native ordering of today's column
  (`onDropOnDay` in `src/index.ts`); other days' ordering is plugin-local only (`dayOrder` in
  `persistence.ts`) since the host exposes no API to persist order within a future day.

The day-bucketing priority order this plugin follows (see `taskDayKey` in `src/data.ts`) is:
`dueWithTime` (timed) → `dueDay` → membership in the `TODAY` tag → unplanned. Follow this same
priority order in any new code that classifies a task's day.

### Manifest & permissions

`src/manifest.json` declares the host-facing contract: `iFrame: true` (what makes this a
permanent nav tab rather than a modal/side panel), the permission list, and the hook list. If
you add a call to a new `PluginAPI` method or register a new hook, add it to both
`permissions`/`hooks` here — permission strings are declarative/trust-UI only (not individually
enforced by the host) but must still accurately reflect what the plugin does, since it's shown to
the user at install time.

Known, deliberate host-API limitations that shape scope (don't try to work around these): no
per-future-day ordering API (hence
plugin-local ordering), no deadline fields on the plugin `Task` type (deadline chips are out of
scope), and `updateTask()` rejects `parentId`/`subTaskIds` (no subtask reparenting through it).
