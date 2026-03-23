# MotionRoll

MotionRoll is an editor-first local web app for creating cinematic scroll sections for websites. You open directly into the Editor with a demo project already loaded, bring in a source video or imported AI clip, refine the section timing and copy, and publish a hosted embed powered by a typed manifest and a lean native runtime.

## Product philosophy

MotionRoll is intentionally not a generic site builder and not a timeline-heavy video editor.

The product stays focused on one job:

- start from a cinematic section preset
- map scroll progress to frames with deterministic behavior
- keep overlay timing and copy understandable
- publish a hosted result that can also be embedded elsewhere

That focus is what makes the app easier to understand on a first run.

## What is real in this repo

- Next.js App Router product app in `apps/web`
- shared Zod contracts in `packages/shared`
- lean native RAF runtime in `packages/runtime`
- custom lower timeline with a MotionRoll adapter layer
- self-hosted editor fonts via Fontsource
- upload restrictions and in-editor upload UX via Uppy
- Docker-assisted local Postgres and MinIO setup
- Clerk-authenticated per-user workspace model
- project-switching editor with one persistent sidebar
- media processing pipeline with FFmpeg and Sharp helpers
- hosted publish flow with immutable publish-version snapshots
- first-sign-in demo workspace seeding for product walkthroughs and screenshots

## What is intentionally stubbed

- live AI provider generation and downloads
- downloadable export packaging as a polished primary flow

Those unfinished areas are wired honestly. The architecture and persistence boundaries are real; the unfinished external integrations are not disguised as complete.

## Presets

MotionRoll currently ships with six presets:

1. Scroll Sequence
2. Product Reveal
3. Feature Walkthrough
4. Before / After
5. Device Spin
6. Chaptered Scroll Story

Recommended starting point: `Product Reveal`

It is the fastest way to understand the product because it shows the preset model, overlay pacing, Editor flow, and hosted publish path clearly.

## Seeded demo projects

The repo seeds one real working MotionRoll self-demo plus three additional polished samples:

- `MotionRoll Demo`
  Real velocity frame-sequence demo committed as WebP frames, poster, and source video
- `Aether Phone Launch`
  Product Reveal demo
- `Cascade Workflow Walkthrough`
  Feature Walkthrough demo
- `Orbit Speaker Spin`
  Device Spin demo

These are real project records with seeded overlays, lightweight local placeholder media, publish targets, and manifest-ready data. They exist to make MotionRoll presentable on a first run, not to pretend that external media processing has already happened for every case.

## Architecture overview

- `apps/web`
  Library, Template Picker, Editor, Publish flow, route handlers, persistence, and processing orchestration.
- `packages/shared`
  Shared contracts for presets, overlays, assets, manifests, processing jobs, publish targets, and AI-provider adapters.
- `packages/runtime`
  Lean browser runtime that consumes the published manifest and handles frame mapping, overlay timing, reduced motion, and cleanup.

## Local setup

Requirements:

- Node.js `22+`
- npm `10+`
- Docker Desktop
- FFmpeg on the host and available on `PATH`

Local infrastructure:

- Postgres on `127.0.0.1:5432`
- MinIO API on `127.0.0.1:9000`
- MinIO Console on `127.0.0.1:9001`

Quick start:

```powershell
npm install
Copy-Item .env.example .env
docker compose up -d
npm run db:migrate
npm run db:seed
npm run storage:init
npm run dev
```

Open `http://localhost:3000`

If you are updating from an older local branch, reset and reseed your local database before running the app:

```powershell
docker compose down -v
docker compose up -d
npm run db:migrate
npm run db:seed
```

## Common scripts

- `npm run dev`
  Start the product app locally.
- `npm run build`
  Build all packages.
- `npm run test`
  Run package test suites.
- `npm run typecheck`
  Run package typechecks.
- `npm run db:generate`
  Generate Drizzle migrations.
- `npm run db:migrate`
  Apply migrations to local Postgres.
- `npm run db:seed`
  Seed global templates. Starter demo workspaces are created on first sign-in.
- `npm run storage:init`
  Ensure the configured object-storage bucket exists.

## First-run path

The intended first-run experience is:

1. Sign in to MotionRoll.
2. Open the home page.
3. Land directly in the Editor on your first-run `MotionRoll Demo` workspace.
4. Scrub the preview, adjust timing in the timeline, and edit content directly in the canvas.
5. Review the Template Picker only if you want a different preset direction.
6. Import media or study a seeded demo, then open Publish and inspect readiness, preview URL, and embed options.

## Recommended demo flow

The fastest way to show MotionRoll to someone else:

1. Open `MotionRoll Demo` from the home page redirect.
2. Show the Editor layout, playhead scrubbing, and live preview.
3. Show direct canvas editing, transport controls, and the lower timeline.
4. Point out that the demo uses a real committed video-derived frame sequence.
5. Open Publish and show the real runtime preview plus the script embed snippet.
6. Jump back to the Template Picker and show that the default demo still sits on the standard `Scroll Sequence` preset.

See [DEMO.md](./DEMO.md) for a shorter walkthrough script.

## Media pipeline notes

- Uploaded video and AI-imported clips both enter the same normalized video pipeline contract.
- FFmpeg handles extraction, poster output, and fallback video generation.
- Sharp handles image normalization and variants.
- Derived assets are preserved.
- Original sources are temporary by default and can be deleted after successful processing.

## Fallback behavior

MotionRoll now resolves fallbacks per preset instead of treating every section the same.

- `poster` is the default safe fallback for most demo and publish flows
- `fallback video` is generated when the pipeline has enough source material and the preset benefits from it
- `first frame` is an acceptable fallback for presets that can degrade gracefully without motion
- `sequence disabled` is the last resort when a runtime-safe media path is not available

Important behavior:

- fallback video is recommended, not universally required
- readiness checks evaluate fallback needs per preset
- preview and hosted publish use the same fallback resolution rules
- reduced-motion and mobile paths both resolve from the same normalized manifest data

## Publish model

Hosted publish is the primary real output path in this version.

The publish flow persists:

- publish target records
- generated manifest data
- preview URL metadata
- embed bootstrap information

Script embed is the only embed output in this version.

## Publish lifecycle

Publish is versioned and intentionally explicit:

- editing a published project makes it current in the Editor but marks the hosted target as needing republish
- republish regenerates the manifest, bumps the hosted publish version, and updates the publish target timestamp
- the Publish screen reflects whether the current hosted target is up to date or stale
- preview and published embeds consume the same manifest contract, so the runtime behavior stays aligned

This keeps MotionRoll honest about whether the hosted output matches the latest Editor state.

## Demo vs real projects

Seeded demos and real user-created projects now follow the same manifest, readiness, and publish code paths.

- the default MotionRoll demo ships with committed demo frames and seeded publish targets
- the remaining demo projects still use lightweight placeholder frames where appropriate
- real uploaded or AI-imported media still goes through the processing pipeline
- fallback warnings may differ between demo and real projects depending on available derived assets
- demo media is intentionally presentable, but it does not pretend to be fully processed production footage

That boundary is deliberate: demos exist to explain the product quickly without hiding where live processing still matters.

## Retention behavior

Source retention is biased toward practical local operation:

- original uploaded and AI-imported source files are temporary by default
- derived frames, posters, manifests, and published assets are preserved
- source deletion only runs after successful derivation
- if source cleanup fails after processing, the project still stays ready and the retention error is recorded in metadata
- temporary work directories are cleaned up after processing runs

## AI provider adapter notes

Current provider enum support:

- `runway`
- `luma`
- `sora`
- `other`

What works today:

- connection persistence
- encrypted credential storage boundary
- provider registry and adapter interface
- stub asset listing and import hand-off scaffolding

What does not claim to work yet:

- live provider credential validation
- real generation creation
- polling external generations
- downloading completed provider assets from live APIs

## Current limitations

- requires Clerk configuration for authenticated app access
- starter demo workspaces are created per user on first sign-in
- hosted publish is primary; export packaging is still a scaffold
- AI provider integrations are honest stubs
- one primary cinematic section is the supported editing path in v1
- local processing depends on FFmpeg and Docker-assisted local infra
- supported input is video-first: direct video upload plus AI-imported clip handoff
- the timeline interaction layer is custom to MotionRoll
- preview manipulation uses `react-moveable`
- editor fonts are self-hosted via Fontsource
- uploads use Uppy restrictions plus server validation
- Video-only upload is intentional for product simplicity and safety
- fallback video generation is practical but not universal for every preset and every demo asset shape
- publish diagnostics are product-facing, but not yet a full production observability layer

## Extension points

- real provider integrations behind the existing adapter interface
- multi-section editing using the existing section persistence model
- more production-ready publish diagnostics
- production Cloudflare R2 configuration
- richer media samples beyond the current lightweight demo placeholders
