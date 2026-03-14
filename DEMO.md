# MotionRoll Demo Flow

## Best 3-minute walkthrough

1. Open the home page.
2. Let the app open directly into `MotionRoll Demo`.
3. In the Editor, point out:
   - left side for structure, assets, overlays, and imports
   - center live preview using the shared runtime
   - right side for content and playback controls
4. Trigger fullscreen preview and then exit with `Esc`.
5. Scrub the preview and click one timing block in the bottom timeline.
6. Open `Publish`.
7. Show:
   - readiness checks
   - preview URL
   - hosted embed snippet
   - script embed snippet
   - manifest inspection
8. Return to `Template Picker`.
9. Compare `Product Reveal`, `Feature Walkthrough`, and `Device Spin`.

## What to say clearly

- MotionRoll is preset-driven on purpose.
- MotionRoll is video-first on purpose.
- The default MotionRoll demo is a real committed frame-sequence asset, not a fake placeholder frame set.
- Hosted publish is the main real output path.
- AI provider adapters are architecturally ready but still stubbed honestly.
- The default demo is real and the supporting samples stay lightweight so the product is still easy to show locally.
- Fallback video is recommended where it helps, but MotionRoll can publish with poster or first-frame fallback when the preset allows it.
- If you edit a published demo, the Publish screen will mark it as needing republish until the hosted target is updated.

## Reliability notes for demos

- Seeded demos use the same manifest, readiness, and publish code paths as normal projects.
- Preview and hosted publish now resolve mobile and reduced-motion fallbacks from the same manifest rules.
- A published demo should start in a current state, not already marked as stale.

## Best screenshots

- Editor with the MotionRoll demo preview visible
- Publish screen with readiness and embed panels
- Template Picker with Scroll Sequence and Product Reveal visible
