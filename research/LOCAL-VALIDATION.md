# Local site verification — 12 October 2026

Local URL: http://127.0.0.1:4267/

The Node HTTP server returned HTTP 200 and the browser loaded the Three.js scene successfully. The app is static and loads its runtime and datasets locally.

Browser checks completed:

- Timeline selection updates the selected horizon, date and scenario label.
- Present/future comparison enables a split view.
- Explore and return-to-introduction controls work.
- Landmark-layer visibility toggles on and off.
- Government filter returns three project groups.
- Search for `quantum` returns two groups.
- Assembly evidence panel shows its sources, unknown measurements and verification gaps.
- Quantum Valley panel displays the reported 3 February 2027 target.
- Desktop and 390px mobile layouts render the city; no mobile horizontal page overflow was observed.

Stationary context geometry is batched by material, tree geometry is instanced, the pixel ratio is capped and rendering pauses offscreen or when the page is hidden. These are implemented optimizations; no cross-device frame-rate benchmark was performed.

Limitations: current project evidence is the research snapshot, not a live feed. Building volumes and heights are illustrative. Future views vary the study's visual treatment and do not constitute a validated construction forecast. Detailed official BIM assets and current site photography remain future acquisition work.
