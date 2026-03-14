MotionRoll GSAP Velocity Demo

Files:
- index.html
- demo.mp4
- frames/*.webp

Run from a local server, for example:
  python -m http.server 8080

Then open:
  http://localhost:8080

Notes:
- Uses high-quality WebP frames extracted from demo.mp4
- Uses native RAF-based runtime for pinning and scroll progress
- Uses velocity-aware smoothing so fast wheel input catches up faster
- Includes Manual scrub mode with a slider
