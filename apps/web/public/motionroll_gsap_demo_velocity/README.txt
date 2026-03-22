MotionRoll GSAP Velocity Demo

Files:
- index.html
- poster.webp
- frames/*.webp

Run from a local server, for example:
  python -m http.server 8080

Then open:
  http://localhost:8080

Notes:
- Uses high-quality WebP frames plus poster.webp for the asset preview
- Uses GSAP + ScrollTrigger for pinning and scroll progress
- Uses velocity-aware smoothing so fast wheel input catches up faster
- Includes Manual scrub mode with a slider
