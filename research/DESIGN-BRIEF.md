# Amaravati Observatory: cinematic city explorer

User-approved direction: realistic 3D city with a timeline. Working creative line: **A capital, taking shape.** This is the implementation brief, not an implemented website.

## The experience

Open on a wide aerial view of the Krishna river and capital landscape in warm early-evening light. Introduce the city with oversized, restrained typography. The camera moves toward the government spine while the river, existing settlements, roads and construction remain geographically grounded.

The hero transitions into an explorable city. A compact timeline sits across the lower edge: Today / +6 months / +1 year / +2 years / Masterplan. Buildings change only under explicit scenario rules. The selected date, scenario mode and evidence age remain legible throughout.

Click a landmark to open an evidence panel containing its current stage, latest dated milestone, map/model provenance, announced target and sources. Unknown measurements display as unavailable. Project-list navigation provides the same content without requiring 3D interaction.

Switch layers for Government, Mobility, Water, Housing and Institutions. Road packages glow softly on selection; water infrastructure shows its planned extent with a clear legend. A compare control shows present evidence beside a future illustration using the same camera position.

## Art direction

Use river blue, warm stone, forest green and restrained brass highlights. The interface sits on a near-black background with opaque, readable panels. The 3D world should feel like an architectural documentary: realistic proportions, soft atmospheric depth, warm sun, physically plausible materials and selective lighting.

Use one striking composition per chapter rather than repeated cards: government aerial, road corridor, water network, then evidence ledger. Avoid generic fabricated skyline density. Actual villages and incomplete construction are part of the story.

Suggested tokens, subject to contrast QA:

| Purpose | Value |
|---|---|
| Page background | `#071719` |
| Panel | `#102629` |
| Main text | `#F6F1E6` |
| Secondary text | `#C4D4D0` |
| Selected control | `#E9BC72` with dark text |
| Existing / verified stage | Text label + solid geometry |
| Announced target | Text label + outlined geometry |
| Illustrative reconstruction | Text label + patterned / translucent geometry |

Typography: a display face for titles and a clear sans serif for controls and evidence. Font licensing and Telugu glyph coverage need verification before selection. Keep 16px body text, visible keyboard focus and touch targets at least 44px. Color is never the only status indicator.

## Skills used

Installed project-local copies: [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), [Three.js scenes](https://github.com/full-stack-skills/threejs-skills/tree/main/skills/threejs-scenes), [Three.js loaders](https://github.com/full-stack-skills/threejs-skills/tree/main/skills/threejs-loaders).

The UI skill's design-system query returned a generic Swiss-style landing page; the narrowed retry did too. That result does not match this city explorer. This brief therefore uses a custom cinematic direction and the skill's general accessibility, responsiveness and motion guidance; it is not presented as a matched database recommendation.

The Three.js guidance informs atmospheric fog tied to scene scale and camera range, glTF asset loading with progress/errors, compressed-asset decoder paths and disposal when scenes change. Official API references: [Scene](https://threejs.org/docs/pages/Scene.html), [Fog](https://threejs.org/docs/pages/Fog.html), [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html).

## Rendering and data plan

Use Three.js for the scene. Prefer glTF/GLB for reviewed landmark assets. Convert GIS longitude/latitude into local metres around a documented origin, with consistent north/up conventions. Preserve source IDs on meshes so clicks resolve to the project registry.

Start with planning geometry, openly licensed building footprints and simple evidence-labelled reconstructions. Add licensed detailed landmarks progressively. Heights inferred from floor counts must retain their formula and uncertainty, and stay distinct from surveyed heights. FAR zoning does not supply either height or floor count.

Keep the regional road/rail context separate from the core-capital scene. A roadmap outside the capital boundary does not become an artificial urban skyline. Future growth outside funded projects remains a planning illustration.

Performance targets for the build: stable interaction on an ordinary laptop; adaptive pixel ratio and shadows; instanced repeated objects; progressively loaded landmarks; paused rendering when hidden; restrained post-processing. These are targets, not benchmarked results. Mobile gets fewer detailed meshes and a list/map fallback. Respect reduced motion and offer a static initial camera without autoplay.

Use loading and failure states that preserve the evidence panel even if WebGL or a model fails. Provide keyboard project selection and reset-view controls. Do not trap normal page scrolling in camera controls.

## First build slice

1. Ground the capital boundary, government parcels, river/water planning layer and selected roads in a single navigable scene.
2. Model the government landmarks from reviewed references, with explicit reconstruction labels.
3. Connect the 18-group registry to clickable features and source panels.
4. Add a working timeline with labelled scenarios; unsupported dates keep the last verified stage or an unknown state.
5. Add present/future comparison, responsive layout and accessible project list.
6. Validate camera alignment, model dimensions, coordinate transforms, timeline states and browser performance before hosting.

The build can begin with this foundation. Full photorealism and accurate building-specific future staging still depend on acquiring additional model references and current field evidence.
