# Avatar Composer → Vibrax "My Character" BJ — Design

**Date:** 2026-06-17
**Status:** Approved (pending spec review)

## Goal

Let each user build a personal avatar in an in-app editor (modeled on
`avatar-composer-main`) and save it as "my character." When that user creates a
game, their saved avatar becomes the broadcasting BJ shown in the game's play
modal — replacing today's fixed, randomly-assigned avatar.

## Background (current state)

- **Vibrax** is Next.js 16 / React 19 / Tailwind 4. No three.js deps installed.
- The in-game BJ ("AJ") is rendered by `components/AvatarOverlay.tsx` using the
  **TalkingHead** library (`public/talkinghead.mjs`): it loads a single `.glb`,
  runs Google-TTS lip-sync + idle motion, and toon-shades the result. It picks
  one of 3 fixed GLBs at random per session.
- `AvatarOverlay` is mounted by `components/AiBjPanel.tsx` (desktop + mobile).
  Speech is driven by a `window` `avatar:speak` CustomEvent → Google TTS → per-word
  timing fed to TalkingHead.
- Agent config (name/persona/avatar image) lives in Supabase **`user_metadata`**.
  A storage bucket named `avatars` already exists (agent profile photos).
- Games (`games` table) have `user_id` = creator. `profiles` table holds
  `id` / `username` / `created_at`.

- **avatar-composer-main** (sibling repo, Vite / React 18 / R3F v8 /
  `@pixiv/three-vrm` v3.5 / three 0.170) assembles a base VRoid VRM + swappable
  modular parts at runtime. Its engine files — `src/composer/partLoader.ts` and
  `src/composer/constants.ts` — are **pure three.js + three-vrm with zero React
  or R3F dependency**. Only `AvatarComposer.tsx` and the UI use R3F.

## Key constraints that shape the design

1. **R3F version clash, sidestepped.** The composer's R3F v8 does not support
   React 19, and R3F v9 would require rewriting `AvatarComposer.tsx`. But the
   valuable *engine* is not R3F-bound, so we reuse it in a vanilla-three
   imperative mount — the same pattern `AvatarOverlay` already uses for
   TalkingHead. Zero version risk.
2. **VRoid rig ≠ TalkingHead rig.** The composer base uses VRoid bones
   (`J_Bip_*`) and VRM visemes (`Fcl_*`); TalkingHead expects Ready-Player-Me
   rigs. A composer avatar cannot be lip-synced by TalkingHead. The in-game BJ
   for custom avatars therefore uses a new three-vrm renderer, not TalkingHead.
3. **No facial *shape* sculpting in v1.** The base has only *expression* morphs,
   no Blender shapekeys, so v1 customization = clothing / hair / eye-color /
   expression preview, not face geometry.
4. **Parts are generated artifacts.** The catalog references `.glb`/`.vrm` parts
   produced by the composer's `extractParts.mjs` (`npm run assets`) from source
   VRMs. Only source VRMs + thumbnails are committed in the composer repo, so a
   one-time offline asset build is required.

## Decisions

### Rendering engine
Reuse the composer engine in an imperative `AvatarEngine` class (vanilla three.js
+ three-vrm). It owns scene/camera/renderer + base VRM and exposes:
`applySelection(selection)`, `setEyeColor(hex)`, `setExpression(name, value)`,
`speak(words, wtimes, wdurations)`, `dispose()`. Both the editor and the in-game
BJ mount it via `useEffect`.

### In-game BJ behavior
**Talking + idle (full):** TTS word-timing (already computed in the speech path)
drives the VRM `aa` expression across each word window for a talking mouth, plus
idle gaze drift, breathing, and blink. Replaces TalkingHead **for custom
avatars only**.

### BJ identity
BJ = **the game creator's** saved avatar. Players see the creator broadcasting
their own game.

### Storage (no GLB baking, no per-user GLB)
- The assembled model is **never baked or downloaded.** We store only a small
  config JSON and re-assemble live in the browser.
- **DB (required):** add an `avatar_config jsonb` column to the **`profiles`**
  table (public-readable via existing RLS), not `user_metadata` — because the
  BJ path must read *another* user's (the game creator's) config with a normal
  SELECT. Shape:
  ```json
  { "selection": { "tops": "tops-basic", "bottoms": "bottoms-jean",
                   "hair": "hair-sample", "face": "face-eyesample" },
    "eyeColor": "#5b3a29", "version": 1 }
  ```
- **Part files:** shared/public — shipped as static assets under
  `public/avatars/composer/`, served by CDN. No S3.
- **Preview PNG (optional, recommended):** on save, capture a canvas snapshot
  and upload to the existing `avatars` storage bucket
  (`avatar-models/<userId>.png`). Lets cards/lists show the avatar cheaply
  without booting the 3D engine. Its public URL is stored alongside the config
  (e.g. `avatar_config.previewUrl`). Not required for core function.

## Components & data flow

### New module: `lib/avatar/`
- `catalog.ts` — ported `CATALOG`, `Selection`, `VARIANTS_BY_ID`,
  `defaultSelection`, `BASE_URL`; URLs rebased to `/avatars/composer/...`.
- `partLoader.ts` — ported verbatim (`loadPart` / `loadSpringPart` /
  `loadFacePart`).
- `engine.ts` — new imperative `AvatarEngine` (scene + base VRM load + the
  race-guarded slot-swap orchestration from `AvatarComposer.tsx` rewritten as
  methods, idle loop, toon-shading pass, TTS viseme driver, blink).

New npm deps: `three`, `@pixiv/three-vrm` (pinned to the composer's working
versions: three ~0.170, three-vrm ~3.5).

### Editor page: `app/avatar/page.tsx`
Client page, linked from the profile MY AGENT section. Left: live `AvatarEngine`
canvas. Right: VRoid-style tabbed catalog picker (Tops / Bottoms / Hair / Eye
color / Expression), ported from the composer's `CatalogPicker`/`VariantCard`
look and restyled to vibrax's pixel/neon theme. **SAVE** writes `avatar_config`
to `profiles` (+ optional preview PNG upload).

### In-game wiring
- `GamePlayButton` fetches the **game owner's** `avatar_config` from `profiles`
  (`select avatar_config where id = game.user_id`) and passes it to `AiBjPanel`.
- `AiBjPanel` selects the renderer:
  - valid `avatar_config` → mount new **`CustomAvatarOverlay`** (the
    `AvatarEngine`, fed by the same `avatar:speak` → TTS → viseme path).
  - otherwise → keep mounting the existing `AvatarOverlay` (TalkingHead random
    GLB). No regression for creators who haven't built an avatar.

## Phasing (single spec, sequential)

1. **Engine + assets.** Run composer asset build; copy `male_base.vrm` +
   generated parts + thumbs into `public/avatars/composer/`. Add deps. Create
   `lib/avatar/{catalog,partLoader,engine}.ts`.
2. **Editor.** `app/avatar/page.tsx` + catalog picker UI + save to
   `profiles.avatar_config` (+ optional preview PNG). Add `avatar_config` column
   migration. Link from profile.
3. **In-game BJ.** `CustomAvatarOverlay` + owner-config fetch in
   `GamePlayButton` + renderer switch in `AiBjPanel` + TTS viseme driver.

## Risks

- **TTS viseme realism.** v1 is procedural per-word mouth open on `aa`; can later
  move to amplitude-driven or vowel-mapped visemes.
- **Bundle size from `three`.** Incremental — TalkingHead already loads three at
  runtime; npm three replaces the duplicate, net neutral-to-positive.
- **Spring-bone hair.** Only 1 variant, known ~2.5cm offset on the stand-in;
  acceptable for v1.
- **Asset build dependency.** `extractParts.mjs` needs `@gltf-transform/*` +
  source VRMs in the composer repo; run once and commit artifacts to vibrax.

## Out of scope (v1)

- Facial shape sculpting (needs authored Blender shapekeys).
- User-uploaded custom parts (would require S3 + per-user asset pipeline).
- Multiple base bodies (male2 / female1) — engine already takes `baseVrm` as a
  parameter, so this is a later catalog promotion.
