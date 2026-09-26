# Taste match and harvest: who already states the owner's details (CS-26, pass 6)

Fetched and checked on 2026-09-26. Every page cited below was downloaded (curl, converted to text with w3m; Apple HIG pages through their public JSON). Every quotation was then string-matched by a script against the fetched text with whitespace collapsed, and is at most 25 words. Two exceptions are marked where they occur: one Geist sentence contains decorative component glyphs between two words in the page text, and the Refactoring UI article returned HTTP 403 live, so it was read from its web.archive.org copy.

Undated pages: Emil Kowalski's articles carry no date, so each shows "first archived" = the earliest Wayback Machine capture, which only bounds the date from above (inference). "Living" = a documentation page with no page date, read on 2026-09-26.

**Scoring.** A source gets 1 point for each owner example it clearly and independently states. Examples 7, 11 and 17 contain two separate ideas (a and b), worth 0.5 each. **✓** counts. **~** means related but not the same idea, and does not count. **✗** means the source recommends the opposite. **·** means not found. Cells cite evidence IDs from the next section.

**Column key.** 1 interruptible animation · 2 reserve space, no layout shift · 3 icon stroke matched to size and adjacent text · 4 empty states with an action · 5 line height set per text role · 6 touch targets of at least 44 px · 7 (a) optimistic UI, (b) few colours per view · 8 skeletons · 9 stagger with the most valuable item first · 10 reduced motion, weak or battery-limited devices · 11 (a) tooltip delay group, (b) tabular-nums · 12 scroll fades used properly · 13 safe triangle for submenus · 14 morph · 15 shared-element transition · 16 origin-aware popovers · 17 (a) rubber-band, (b) icon cross-fade inside buttons.

## Taste-match table

| Source (role; why credible) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | Score |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Vercel Web Interface Guidelines** (Vercel's design engineering rulebook; grew from Rauno Freiberg's 2023 list; ships as an agent skill) | ✓V1 | ✓V2 | ✓V3 | ✓V4 | · | ✓V5 | a✓V6 | ✓V7 | · | ✓V8 | ab✓V9,V10 | · | ✓V11 | · | · | ✓V12 | · | **10.5** |
| **Apple, HIG and WWDC** (platform owner; WWDC18 "Designing Fluid Interfaces" by Karunamuni, de Vries, Alonso, the talk Rauno and Emil cite) | ✓A1 | · | ✓A2 | · | ✓A3 | ✓A4 | · | ✓A5 | · | ✓A6 | · | ✓A7 | · | ✓A8 | · | ✓A9 | ab✓A10,A11 | **10** |
| **Jakub Krehel** (founding design engineer, Interfere; ex-OpenSea; author of the vendored make-interfaces-feel-better skill; interfaces.dev) | ✓J1 | · | ✓J2 | · | · | ✓J3 | · | · | · | ✓J4 | b✓J5 | · | · | ✓J6 | ✓J7 | ✓J8 | ab✓J9,J10 | **8.5** |
| **Emil Kowalski** (Linear web team, ex-Vercel design; Sonner, Vaul, animations.dev) | ✓E1 | ✓E2 | · | · | · | ✓E3 | · | · | · | ✓E4 | ab✓E5,E6 | · | · | ✓E7 | · | ✓E8 | ab✓E9,E10 | **8** |
| **Adam Argyle** (ex-Chrome CSS DevRel and CSSWG, now Shopify; Open Props, GUI Challenges) | ✓AA1 | · | · | · | · | · | · | · | · | ✓AA2 | · | ✓AA3 | · | ✓AA4 | · | ✓AA5 | ab✓AA6,AA7 | **6** |
| **Rauno Freiberg** (staff design engineer at Vercel, ex-The Browser Company; wrote the original Web Interface Guidelines, "Invisible Details", Devouring Details) | ✓R1 | · | · | ✓R2 | · | · | a✓R3 | · | · | ✓R4 | b✓R5 | · | ✓R6 | ✓R7 | · | · | · | **6** |
| **Nielsen Norman Group** (UX research firm; named researchers) | · | · | · | ✓N1 | · | ✓N2 | · | ✓N3 | · | ✓N4 | · | · | ✓N5 | · | · | · | · | **5** |
| **Vercel Geist design system** (Vercel's component docs with best-practice sections) | · | ✓G1 | · | ✓G2 | ✓G3 | · | · | ✓G4 | · | ✓G5 | · | · | · | · | · | · | · | **5** |
| **Benji Taylor** (designed Family, the iOS wallet known for its fluid trays; "Family Values") | · | · | · | ✓B1 | · | · | · | · | · | · | · | · | · | ✓B2 | ✓B3 | ✓B4 | b✓B5 | **4.5** |
| **Josh W. Comeau** (CSS and animation educator; long-form interactive guides) | ✓C1 | · | · | · | · | · | · | · | · | ✓C2 | · | · | ✓C3 | ✓C4 | · | · | · | **4** |
| **Ahmad Shadeed** (design engineer; Defensive CSS; RTL Styling 101, the main RTL/Arabic-script source) | · | ✓S1 | · | · | ~S4 | ✓S2 | · | · | · | · | · | ✓S3 | · | · | · | · | · | **3** |
| **Google Material Design** (Material Symbols, Material Web tokens, Material 1 archive) | · | · | ✓M1 | · | ✓M2 | · | · | · | · | · | · | · | · | · | ✓M3 | · | · | **3** |
| **React Aria** (Adobe; Devon Govett's team; accessibility-first primitives) | · | · | · | · | · | · | · | · | · | · | a✓RA1 | · | ✓RA2 | · | · | · | · | **1.5** |
| **Ariakit** (Diego Haz's accessible toolkit) | · | · | · | · | · | · | · | · | · | · | a✓AK1 | · | ✓AK2 | · | · | · | · | **1.5** |
| **Floating UI** (positioning library behind many popovers) | · | · | · | · | · | · | · | · | · | · | a✓FU1 | · | ✓FU2 | · | · | · | · | **1.5** |
| **Radix Primitives** (WorkOS unstyled primitives) | · | · | · | · | · | · | · | · | · | · | a✓RX1 | · | · | · | · | ✓RX2 | · | **1.5** |
| **Base UI** (MUI unstyled components) | · | · | · | · | · | · | · | · | · | · | a✓BU1 | · | · | · | · | ✓BU2 | · | **1.5** |
| **Refactoring UI** (Adam Wathan, Steve Schoger) | · | · | ✓RUI1 | ~RUI3 | ~RUI3 | · | b✓RUI2 | · | · | · | · | · | · | · | · | · | · | **1.5** |
| **IBM Carbon** (IBM design system) | · | · | · | · | · | · | · | · | ✗IBM2 | · | · | · | · | · | ✓IBM1 | · | · | **1** |
| **Microsoft Fluent 2** (Microsoft design system) | · | · | · | · | · | · | · | · | ~F2 | ✓F1 | · | · | · | · | · | · | · | **1** |
| **Laws of UX** (Jon Yablonski) | · | · | · | · | · | ✓L1 | ~L3 | · | ~L2 | · | · | · | · | · | · | · | · | **1** |
| **Stripe** (Benjamin De Cock, Stripe design) | · | · | · | · | · | · | · | · | · | ✓ST1 | · | · | · | · | · | · | · | **1** |
| **Chrome View Transitions docs** (Bramus, Chrome DevRel) | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓VT1 | · | · | **1** |
| **Ben Kamens** (originated the menu-aim triangle, 2013) | · | · | · | · | · | · | · | · | · | · | · | · | ✓K1 | · | · | · | · | **1** |
| **Lea Verou** (CSS WG member; scrolling-shadows technique) | · | · | · | · | · | · | · | · | · | · | · | ✓LV1 | · | · | · | · | · | **1** |
| **Linear** (product design blog) | · | · | · | · | · | · | b✓LN1 | · | · | · | · | · | · | · | · | · | · | **0.5** |
| **Paco Coursey** (Linear webmaster; ex-Vercel design system; cmdk, next-themes) | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **0** |
| **Jhey Tompkins** (Shopify; ex-Chrome DevRel, ex-Vercel) | n/s | | | | | | | | | | | | | | | | | **not scored** |
| **Sources stating it** | 7 | 4 | 5 | 5 | 3 | 7 | a2 b2 | 4 | 0 | 11 | a7 b4 | 4 | 8 | 7 | 5 | 8 | a4 b5 | |

What the table shows:

- **Strongest matches:** the Vercel Web Interface Guidelines (10.5), Apple (10), Jakub Krehel (8.5) and Emil Kowalski (8). They independently state most of the owner's list. Adam Argyle and Rauno Freiberg (6 each) come next, then NN/g and Vercel Geist (5 each).
- **No source says example 9** ("most valuable first"). IBM Carbon says the opposite: end the sequence on the most important item. Fluent 2 only says the order should direct attention. Material 1 and Carbon give 20 ms row staggers. This disagreement needs a decision.
- **Example 5 (line height per role) has only platform-level support:** Apple's text styles, Geist's type classes and Material's typescale roles. The Latin ratios work out at about 1.2 for titles and 1.3 to 1.5 for body (arithmetic from their tables, so inference). Only Ahmad Shadeed ties line height to Arabic script: Arabic-script content needs its own, larger value, and buttons can clip diacritics. The Persian typography pass has to settle the actual values.
- **Paco Coursey scores 0 on text.** His craft pages are demos with one to three sentences each (iOS Menu, Exclusion Tabs, Carousel, Command Menu, Spotify Filters, Video), and his writing has only one relevant rule (theme transitions, used in H-7).
- **Jhey Tompkins is not scored.** jhey.dev points to CodePen and X demos, and his Chrome articles are feature explainers. No fetched text of his states an owner example.
- **Vercel's page contradicts itself on zoom:** "Respect zoom. Never disable browser zoom." sits next to an alternative to 16 px inputs: "Or set <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />." The project rule (zoom never disabled) should win.

## Evidence

Format: ID (example) — author — title — URL — date — "quote".

**Vercel Web Interface Guidelines** — https://vercel.com/design/guidelines (living; repo vercel-labs/web-interface-guidelines created 2025-09-10, last commit 2026-08-18)
- V1 (1) — "Interruptible. Animations are cancelable by user input."
- V2 (2) — "No image-caused CLS. Set explicit image dimensions & reserve space."
- V3 (3) — "a thin-stroke icon may need a bolder stroke next to medium-weight text."
- V4 (4) — "No dead ends. Every screen offers a next step or recovery path."
- V5 (6) — "Exception: if the visual target is < 24px, expand its hit target to ≥ 24px. On mobile, the minimum size is 44px."
- V6 (7a) — "Optimistic updates. Update the UI immediately when success is likely; reconcile on server response."
- V7 (8) — "Stable skeletons. Skeletons mirror final content exactly to avoid layout shift."
- V8 (10) — "Honor prefers-reduced-motion. Provide a reduced-motion variant."
- V9 (11a) — "Tooltip timing. Delay the first tooltip in a group; subsequent peers have no delay."
- V10 (11b) — "Tabular numbers for comparisons. Use font-variant-numeric: tabular-nums"
- V11 (13) — "Controls minimize finickiness with generous hit targets, clear affordances, & predictable interactions, e.g., prediction cones."
- V12 (16) — "Correct transform origin. Anchor motion to where it “physically” starts."

**Apple**
- A1 (1) — Karunamuni, de Vries, Alonso — "Designing Fluid Interfaces" (WWDC18) — https://developer.apple.com/videos/play/wwdc2018/803/ — June 2018 — "Next, we want to allow for constant redirection and interruption. This one's big." Also HIG Motion — https://developer.apple.com/design/human-interface-guidelines/motion — change log 2025-09-09 — "Let people cancel motion. As much as possible, don’t make people wait for an animation to complete before they can do anything"
- A2 (3) — HIG SF Symbols — https://developer.apple.com/design/human-interface-guidelines/sf-symbols — change log 2025-07-28 — "helping you achieve precise weight matching between symbols and adjacent text"; "The scales are defined relative to the cap height of the San Francisco system font."
- A3 (5) — HIG Typography — https://developer.apple.com/design/human-interface-guidelines/typography — change log 2025-12-16 — "A text style specifies a combination of font weight, point size, and leading values for each text size." iOS default ("Large") size/leading in pt: Large Title 34/41, Title 1 28/34, Title 2 22/28, Body 17/22, Subhead 15/20, Footnote 13/18, Caption 1 12/16. Ratios of about 1.21 for titles and 1.29 for body are my arithmetic (inference).
- A4 (6) — HIG Accessibility — https://developer.apple.com/design/human-interface-guidelines/accessibility — change log 2025-06-09 — table: iOS default control size 44x44 pt, minimum 28x28 pt; "Strive to meet the recommended minimum control size for each platform to ensure controls and menus are comfortable for all when tapping and clicking."
- A5 (8) — HIG Loading — https://developer.apple.com/design/human-interface-guidelines/loading — change log 2025-06-09 — "consider showing placeholder text, graphics, or animations as content loads, replacing these elements as content becomes available."
- A6 (10) — HIG Motion (2025-09-09) — "Make motion optional." and HIG Accessibility (2025-06-09) — "When this setting is active, ensure your app or game responds by reducing automatic and repetitive animations, including zooming, scaling, and peripheral motion." (The battery aspect appears in Apple only for games: "optimize performance or battery life"; not counted separately.)
- A7 (12) — HIG Scroll views — https://developer.apple.com/design/human-interface-guidelines/scroll-views — change log 2026-06-08 — "Only use a scroll edge effect when a scroll view is behind floating interface elements. Scroll edge effects aren’t decorative."
- A8 (14) — HIG SF Symbols — "Magic Replace — Performs a smart transition between two symbols with related shapes."
- A9 (16) — WWDC18 — "it grows from the initial state to the final state, whether it's through a gesture or an animation." (said about hinting the direction of a gesture, with Control Center modules growing toward the finger)
- A10 (17a) — WWDC18 — "The next one is called rubberbanding. It means we're softly indicating boundaries of the interface."
- A11 (17b) — HIG SF Symbols — "Down-up, where the outgoing symbol scales down and the incoming symbol scales up, communicating a change in state."
- Supporting evidence for 1 — "Animate with springs" (WWDC23) — https://developer.apple.com/videos/play/wwdc2023/10158/ — June 2023 — "a spring animation uses the velocity it had when it was retargeted as the initial velocity towards its new destination"

**Jakub Krehel** (dates from https://jakub.kr/api/rss)
- J1 (1) — "Details that make interfaces feel better" — https://jakub.kr/writing/details-that-make-interfaces-feel-better — 2026-03-10 — "If animations aren’t interruptible, it can make the interface feel broken."
- J2 (3) — skill `icons.md` — https://github.com/jakubkrehel/make-interfaces-feel-better/blob/main/skills/make-interfaces-feel-better/icons.md — last commit 2026-07-24 — "An icon next to text should carry the same optical weight as the text."
- J3 (6) — skill `surfaces.md` (same repo) — "Interactive elements should prefer a 44×44px hit area for touch or mobile contexts."
- J4 (10) — skill `animations.md` (same repo) — "**Honor reduced-motion preferences.** Preserve the static cue and remove unnecessary movement." Also "The invisible side of design engineering" (https://jakub.kr/writing/the-invisible-side-of-design-engineering, 2026-08-14) lists reduced motion as part of design engineering's unseen work.
- J5 (11b) — "Details…" — 2026-03-10 — "If your numbers shift when they update, use font-variant-numeric: tabular-nums"
- J6 (14) — "How I use shared layout animations" — https://jakub.kr/work/shared-layout-animations — 2025-11-24 — "In this example, the elements have different positions, sizes and border radii." (Motion interpolates between the shapes)
- J7 (15) — same — "There are two separate components: a card and a dialog. Motion animates between them using a shared layoutId."
- J8 (16) — "Drag gestures on the web" — https://jakub.kr/work/drag-gesture — 2026-01-27 — "Depending on where the indicator renders, we add a corresponding origin so it animates in from the correct direction."
- J9 (17a) — same — "dragElastic controls the resistance when dragging past the boundaries."
- J10 (17b) — "Details…" — "Animating opacity, scale and blur on icons when they are shown contextually makes the transition feel better and more responsive." (copy icon to check icon inside a button)

**Emil Kowalski** (pages undated; first Wayback capture shown)
- E1 (1) — "Great Animations" — https://emilkowal.ski/ui/great-animations — first archived 2024-06-19 — "Interruptibility helps your animations feel more natural and responsive."
- E2 (2) — "The Magic of Clip Path" — https://emilkowal.ski/ui/the-magic-of-clip-path — first archived 2024-07-09 — "Using clip-path also prevents us from having a layout shift when the image is revealed". Also "Agents with Taste" — https://emilkowal.ski/ui/agents-with-taste — first archived 2026-04-20 — "Declare a fallback stack whose x-height and weight match the primary face so loading does not cause layout shift."
- E3 (6) — "Agents with Taste" — "| Small buttons hard to tap | Use 44px minimum hit area (pseudo-element) |"
- E4 (10) — "Great Animations" — "our animations need to account for people who don’t want animations."
- E5 (11a) — "7 Practical Animation Tips" — https://emilkowal.ski/ui/7-practical-animation-tips — first archived 2025-09-30 — "Once a tooltip is open, hovering over other tooltips should open them with no delay and no animation."
- E6 (11b) — "Agents with Taste" — "Apply `tabular-nums` to price columns so digits align and the column reads cleanly."
- E7 (14) — "You Don’t Need Animations" — https://emilkowal.ski/ui/you-dont-need-animations — first archived 2025-09-04 — "Morphing of the feedback component below helps make the experience more unique and memorable."
- E8 (16) — "7 Practical Animation Tips" — "A way to make your popovers feel better is to make them origin-aware. They should scale in from the trigger."
- E9 (17a) — "Building a Drawer Component" — https://emilkowal.ski/ui/building-a-drawer-component — first archived 2023-11-10 — "the drawer will damp the drag, meaning the more you drag, the less the drawer will move."
- E10 (17b) — "7 Practical Animation Tips" — "a button that simply crossfades between two states, and another one that adds 2px of blur to that animation."

**Adam Argyle**
- AA1 (1) — "Anchor Interpolated Morph (AIM)" — https://nerdy.dev/anchor-interpolated-morphing — 2026-01-23 — "an interruptible contextual transition from where a user invoked it."
- AA2 (10) — same — "don't forget to gate the motion behind a prefers-reduced-motion media query"
- AA3 (12) — "CSS scroll-state()" — https://developer.chrome.com/blog/css-scroll-state-queries — 2025-01-15 — "The scrollable state query is going to be very helpful in showing visual affordances for when a scroll area can actually be scrolled." (His demo fades top and bottom shadows in only while scrolling in that direction is possible.)
- AA4 (14) — AIM — "All together they can create an anchor interpolated morph: an interruptible contextual transition from where a user invoked it."
- AA5 (16) — AIM — "start letting them grow, stretch, and evolve directly from the components that triggered them." and "It's more natural when animations start near the trigger point, this CSS technique makes it easy."
- AA6 (17a) — "Overscroll effects on nested scrollers" — https://nerdy.dev/overscroll-effects-on-nested-scrollers-in-all-browsers — 2026-01-21 — "No more bonk UX, get the same soft edge bounce as the main page has always had!"
- AA7 (17b) — "Thinking on ways to solve a Morphing Button" — https://nerdy.dev/thinking-on-ways-to-solve-morphing-buttons — 2023-07-13 — "view transitions can upgrade the experience of changing the innerHTML of a button by animating the change."

**Rauno Freiberg**
- R1 (1) — "Invisible Details of Interaction Design" — https://rauno.me/craft/interaction-design — July 2023 — "Great interactions are modeled after properties from the real world, like interruptability."
- R2 (4) — "Web Interface Guidelines" — https://interfaces.rauno.me — 2023 (repo created 2023-05-24) — "Empty states should prompt to create a new item, with optional templates"
- R3 (7a) — same — "Optimistically update data locally and roll back on server error with feedback"
- R4 (10, the weak-device half) — same — "Detect and adapt to the hardware and network capabilities of the user's device"
- R5 (11b) — same — "tabular figures should be applied with font-variant-numeric: tabular-nums, particularly in tables or when layout shifts are undesirable"
- R6 (13) — same — "use a "prediction cone" to prevent the pointer from accidentally closing the menu when moving across other elements."
- R7 (14) — "Invisible Details…" — "Swiping up morphs the full screen app into its icon" (section "Fluid Morphing")

**Nielsen Norman Group**
- N1 (4) — Kate Kaplan — "Designing Empty States in Complex Applications: 3 Guidelines" — https://www.nngroup.com/articles/empty-state-interface-design/ — 2021-09-19 — "Provide direct pathways for getting started with key tasks" (its example is a Create button for alerts)
- N2 (6) — Aurora Harley — "Touch Targets on Touchscreens" — https://www.nngroup.com/articles/touch-target-size/ — 2019-05-05 — "Interactive elements must be at least 1cm × 1cm (0.4in × 0.4in) to support adequate selection time and prevent fat-finger errors."
- N3 (8) — Samhita Tankala — "Skeleton Screens 101" — https://www.nngroup.com/articles/skeleton-screens/ — 2023-06-04 — "a wireframe-like visual that mimics the layout of the page."
- N4 (10) — Page Laubheimer — "Executing UX Animations: Duration and Motion Characteristics" — https://www.nngroup.com/articles/animation-duration/ — 2020-02-09 — "you should respect those users who have set their browser or device to “reduce motion” by removing animations."
- N5 (13) — Aurora Harley — "Timing Guidelines for Exposing Hidden Content" — https://www.nngroup.com/articles/timing-exposing-content/ — 2015-01-11 — "Ignoring this recommendation leads to the diagonal problem in mega menus" (it credits Ben Kamens' triangle)

**Vercel Geist** (living)
- G1 (2) — Skeleton — https://vercel.com/geist/skeleton — "Set width and height to match the final content so the layout doesn’t shift when data resolves."
- G2 (4) — Empty State — https://vercel.com/geist/empty-state — "Informational empty states will include a call to action."
- G3 (5) — Typography — https://vercel.com/geist/typography — "The classes below pre-set a combination of font-size, line-height, letter-spacing, and font-weight for you". There is a separate Buttons set: "Only to be used within components that render buttons."
- G4 (8) — Skeleton — "Show a Skeleton when async data fills a known layout"
- G5 (10) — Skeleton — "Disable the shimmer with the no animation variant on low-power surfaces and respect prefers-reduced-motion." (covers both halves of example 10)

**Benji Taylor** — "Family Values" — https://benji.org/family-values — 2024-07-08
- B1 (4) — "users are greeted with an animated arrow in the empty state. This guides them towards creating a new tab"
- B2 (14) — "To address this, we visually morph the text." (Continue becomes Confirm; trays morph into full-screen views)
- B3 (15) — "If a component occupies a space and will persist in the next phase of the user's journey, it should remain consistent."
- B4 (16) — "They can manifest either as standalone entities on top of any app content, or emerge from within other components like buttons."
- B5 (17b) — "Let’s take the transformation of a chevron in a multi-step flow; something that would typically be static." (the tray header's back/close icon button)

**Josh W. Comeau**
- C1 (1) — "Springs and Bounces in Native CSS" — https://www.joshwcomeau.com/animation/linear-timing-function/ — 2025-10-28, updated 2026-05-05 — "One of the hardest problems in web animation is dealing with interrupts."
- C2 (10) — "An Interactive Guide to CSS Transitions" — https://www.joshwcomeau.com/animation/css-transitions/ — 2021-02-09, updated 2026-05-05 — "This small tweak means that animations will resolve immediately for users who have gone into their system preferences and toggled a checkbox." Also "Accessible Animations in React…" (https://www.joshwcomeau.com/react/prefers-reduced-motion/, 2020-05-04).
- C3 (13) — "An Interactive Guide to CSS Transitions" — "As we move the mouse diagonally to select a child, our cursor dips out-of-bounds, and the menu closes." He fixes it with a 300 ms close delay rather than a triangle, and credits Ben Kamens.
- C4 (14) — "Squash and Stretch" — https://www.joshwcomeau.com/animation/squash-and-stretch/ — 2026-04-13 — "We can then use CSS transitions to smoothly interpolate between states." (the states are two SVG `path()` shapes of an icon on hover)

**Ahmad Shadeed**
- S1 (2) — "Image Techniques On The Web" — https://ishadeed.com/article/image-techniques/ — 2020-04-09 — "Did you notice how the image on the right has its space reserved even if it’s still not loaded yet?"
- S2 (6) — "Designing better target sizes" — https://ishadeed.com/article/target-size/ — 2024-01-10 — "My recommendation is to have a target with a minimum size of 44 by 44 pixels, at least."
- S3 (12) — "CSS Masking" — https://ishadeed.com/article/css-masking/ — 2023-03-30 — "Using CSS masking for that is perfect, as it can blend with the underneath background, be it an image, or a dark background." (a fade on overflowing lists that works on any background)
- S4 (~5) — "RTL Styling 101" — https://rtlstyling.com/posts/rtl-styling — written 2019-12, updated 2020-01-18 — "It’s important to account for this and to provide a suitable line-height for the Arabic content." (plus a button clipping the kasra diacritic). This is script-level, not per-role, so it is not counted.

**Google Material Design**
- M1 (3) — "Material Symbols guide" — https://developers.google.com/fonts/docs/material_symbols — updated 2024-09-26 — "Optical size offers a way to automatically adjust the stroke weight when you increase or decrease the symbol size."
- M2 (5) — Material Web "Typography" — https://github.com/material-components/material-web/blob/main/docs/theming/typography.md — commit 2026-08-03 — "They are organized into roles that describe their purpose." Tokens in `tokens/versions/latest/sass/_md-sys-typescale.scss` (commit 2026-04-06): body-large 1rem/1.5rem, body-medium 0.875rem/1.25rem, label-large 0.875rem/1.25rem (the button role), title-large 1.375rem/1.75rem, display-large 3.5625rem/4rem.
- M3 (15) — Material Design 1 "Choreography" (archived guideline, undated) — https://material.io/archive/guidelines/motion/choreography.html — "Maintain a clear focal point during transitions by carefully selecting the number and type of elements shared across the transitions."
- The current Material 3 pages (m3.material.io) render only with JavaScript and could not be read, so they are UNVERIFIED and not counted. That includes the 48 dp target and the container-transform pattern.

**Headless libraries** (living docs)
- RA1 (11a) — React Aria Tooltip — https://react-spectrum.adobe.com/react-aria/Tooltip.html — "Once a tooltip is displayed, other tooltips display immediately." Defaults: `delay` 1500 ms, `closeDelay` 500 ms.
- RA2 (13) — Reid Barber — "Creating a pointer-friendly submenu experience" — https://react-spectrum.adobe.com/blog/creating-a-pointer-friendly-submenu-experience.html — 2024-05-01 — "We need a way to know when they're moving their pointer to that submenu, so we can keep it open until they reach the submenu." It adds 15° of angle tolerance, closes only after two consecutive invalid moves, throttles to 16 ms and ignores touch and pen.
- AK1 (11a) — Ariakit TooltipProvider — https://ariakit.org/reference/tooltip-provider — `skipTimeout` default 300: "The amount of time after a tooltip is hidden while all tooltips on the page can be shown immediately, without waiting for the show timeout."
- AK2 (13) — Ariakit Hovercard — https://ariakit.org/reference/hovercard — `disablePointerEventsOnApproach`: "during hover intent, that is, when the mouse is moving toward the popover."
- FU1 (11a) — Floating UI FloatingDelayGroup — https://floating-ui.com/docs/FloatingDelayGroup — "should share a delay which temporarily becomes 1 ms after the first floating element of the group opens."
- FU2 (13) — Floating UI useHover — https://floating-ui.com/docs/useHover — `safePolygon()` "will only close the floating element if the pointer is outside a dynamically computed polygon area." (`buffer` default 0.5 px, `requireIntent` default true)
- RX1 (11a) — Radix Tooltip — https://www.radix-ui.com/primitives/docs/components/tooltip — "Use the Provider to control delayDuration and skipDelayDuration globally." Defaults: 700 ms and 300 ms.
- RX2 (16) — Radix Dropdown Menu — https://www.radix-ui.com/primitives/docs/components/dropdown-menu — "Use it to animate the content from its computed origin based on side, sideOffset, align, alignOffset and any collisions."
- BU1 (11a) — Base UI Tooltip — https://base-ui.com/react/components/tooltip — "The grouping logic ensures that once a tooltip becomes visible, the adjacent tooltips will be shown instantly."
- BU2 (16) — Base UI Menu — https://base-ui.com/react/components/menu — `--transform-origin`: "The coordinates that this element is anchored to. Used for animations and transitions."

**Others**
- RUI1 (3) — Adam Wathan & Steve Schoger — "7 Practical Tips for Cheating at Design" — https://medium.com/refactoring-ui/7-practical-tips-for-cheating-at-design-40c736799886 (live returned 403; read via web.archive.org) — 2018-02-20 — "icons that were drawn at 16–24px are never going to look very professional when you blow them up to 3x or 4x their intended size."
- RUI2 (7b) — same — "Try and stick to two or three colors:" (for text: dark, grey, lighter grey)
- RUI3 (~4, ~5) — https://www.refactoringui.com/ — the book's table of contents lists "Line-height is proportional" and "Don’t overlook empty states". The chapter text is paid and was not read, so neither is counted.
- IBM1 (15) — IBM Carbon "Motion: choreography" — https://carbondesignsystem.com/elements/motion/choreography/ (living) — "Pay attention to shared elements across screens, such as title panels or buttons, to create a graceful transition."
- IBM2 (✗9) — same — "Start with the most stable content, such as static content and header, and end with the most important information"
- F1 (10) — Microsoft "Fluent 2: Motion" — https://fluent2.microsoft.design/motion (living) — "Design for and include a “no motion” setting for your app or website as recommended by the WCAG."
- F2 (~9) — same — "Animation hierarchy allows you to direct people’s attention to UX elements in a preferred order"
- L1 (6) — Jon Yablonski — "Fitts’s Law" — https://lawsofux.com/fittss-law/ (undated) — "Touch targets should be large enough for users to accurately select them."
- L2 (~9) — "Serial Position Effect" — https://lawsofux.com/serial-position-effect/ — "Placing the least important items in the middle of lists can be helpful" (about recall, not entrance order)
- L3 (~7b) — "Von Restorff Effect" — https://lawsofux.com/von-restorff-effect/ — "Use restraint when placing emphasis on visual elements to avoid them competing with one another" (about emphasis, not colour count)
- ST1 (10) — Benjamin De Cock — "Connect: behind the front-end experience" — https://stripe.com/blog/connect-front-end-experience — 2017-06-19 — "all decorative animations on the page will be disabled." (when Reduce Motion is on)
- VT1 (15) — Bramus — "Smooth transitions with the View Transition API" — https://developer.chrome.com/docs/web-platform/view-transitions — updated 2024-04-14. Its first "typical situation" is a thumbnail image turning into the full-size image on the detail page. Not quoted, because the page words it with retail vocabulary.
- K1 (13) — Ben Kamens — "Breaking down Amazon’s mega dropdown" — https://bjk5.com/post/44698559168/breaking-down-amazons-mega-dropdown — 2013-03-06 — "If the cursor moves into the blue triangle the currently displayed submenu will stay open for just a bit longer."
- LV1 (12) — Lea Verou — "Pure CSS scrolling shadows with background-attachment: local" — https://lea.verou.me/blog/2012/04/background-attachment-local/ — 2012-04-26 — "when you scroll, the shadows are no longer obscured and can show through."
- LN1 (7b) — Charlie Aufmann & Maxime Heckel — "A calmer interface for a product in motion" — https://linear.app/now/behind-the-latest-design-refresh — 2026-03-12 — "removes unnecessary visual treatments like colored team icon backgrounds."

## Harvested details

These are 50 details the owner did not list. They are not already covered precisely by the vendored files (the Vercel guidelines copy, emil-design-eng, make-interfaces-feel-better and fixing-accessibility). Where a vendored rule is related, the entry says what it adds. H-1 to H-43 come from the top eight sources (Vercel's guidelines and Geist, Apple, Jakub Krehel, Emil Kowalski, Adam Argyle, Rauno Freiberg, NN/g); other sources only corroborate them. H-44 to H-50 come from the next tier (Benji Taylor, Ahmad Shadeed, React Aria). They are kept because no top-eight source covers them and three are about right-to-left layout. Physical left/right in a source's code must become logical properties here.

### H-1: Tune springs from zero bounce; add overshoot only when a flick with momentum drives the motion
- Topic: motion
- Why: Apple starts every elastic behaviour at 100% damping. Overshoot is a reward for a gesture's momentum, so a tap-opened view never overshoots and a flick-dismissed one may.
- How: tapping a listing opens its detail sheet with Motion `{ type: "spring", bounce: 0 }`. After a fling-to-dismiss, pass the release velocity and use a small bounce: about 0.15 feels brisk and about 0.3 visibly bouncy (Apple WWDC23). Never exceed about 0.4.
- Sources: Apple — "Designing Fluid Interfaces" (WWDC18) — https://developer.apple.com/videos/play/wwdc2018/803/ — June 2018 — "we recommend starting with 100% damping, or no overshoot when you're tuning elastic behaviors." / "if the gesture that's driving the motion itself has momentum, then you should reward that momentum with a little bit of overshoot." Apple — "Animate with springs" (WWDC23) — https://developer.apple.com/videos/play/wwdc2023/10158/ — June 2023 — "you should be cautious about using values higher than around 0.4, since they may feel too exaggerated for a UI element."
- Confidence: high
- Conflicts: `vendor/emil-design-eng.md` shows `{ type: "spring", duration: 0.5, bounce: 0.2 }` as a general-purpose config; Apple would use 0 unless momentum is present. Jakub's vendored icon-swap rule (bounce 0) agrees with Apple.

### H-2: Make "no motion" the default state and, under reduced motion, swap movement for fades while keeping gesture tracking
- Topic: motion
- Why: Apple gives concrete substitutions: tighten springs, replace x, y and z movement with fades, stop animating blur, but keep content following the finger. Josh makes motion opt-in, so browsers without the query and server-rendered HTML get the still version.
- How: installed Tailwind 4.3.3 maps `motion-safe:` to `@media (prefers-reduced-motion: no-preference)` and `motion-reduce:` to `reduce`. Put movement behind `motion-safe:` and give the base state an opacity-only transition. In JavaScript, start with `prefersReducedMotion = true` until the client has read the query (Josh's hook). In the photo gallery the photo still tracks the finger under reduced motion; only the snap after release becomes a cut or a fade.
- Sources: Apple — HIG Accessibility — https://developer.apple.com/design/human-interface-guidelines/accessibility — 2025-06-09 — "Tightening animation springs to reduce bounce effects"; "Tracking animations directly with people’s gestures"; "Replacing transitions in x-, y-, and z-axes with fades to avoid motion"; "Avoiding animating into and out of blurs". Josh W. Comeau — "Accessible Animations in React with "prefers-reduced-motion"" — https://www.joshwcomeau.com/react/prefers-reduced-motion/ — 2020-05-04 (updated 2026-04-29) — "For folks using browsers or operating systems that don't support the feature, we'll default to no animations."
- Confidence: high
- Conflicts: `vendor/emil-design-eng.md` recommends a blur to mask crossfades, which Apple says to drop under reduced motion. The vendored examples write overrides inside `reduce`; defaulting to still is safer.

### H-3: Use a velocity-keeping spring for motion people reverse mid-flight; CSS transitions and `linear()` springs lose velocity when interrupted
- Topic: motion
- Why: a retargeted spring carries its current velocity into the new target (Apple). Josh measured that a CSS `linear()` spring "turns around instantly, as though it hit a wall", because the spec shortens interrupted transitions.
- How: use a spring library for gesture-released or often-reversed motion, such as sheet release, gallery snap, or a save toggle tapped repeatedly. Use CSS transitions for one-way decoration. Test by triggering twice quickly and replaying at 10% speed in DevTools.
- Sources: Apple — "Animate with springs" (WWDC23) — June 2023 — "a spring animation uses the velocity it had when it was retargeted as the initial velocity towards its new destination". Josh W. Comeau — "Springs and Bounces in Native CSS" — https://www.joshwcomeau.com/animation/linear-timing-function/ — 2025-10-28 (updated 2026-05-05) — "There’s a concept in the specification called the reversing shortening factor that proportionally reduces the duration of interrupted transitions."
- Confidence: high
- Conflicts: the vendored "CSS transitions are interruptible" (Jakub, Emil) holds for retargeting position, not velocity. ADR-0003 keeps the stack bare, so this applies once an animation library is adopted.

### H-4: For an in-page morph people may interrupt (a filter chip growing into its panel), prefer an anchor-based CSS transition over a view transition
- Topic: motion
- Why: Adam says view-transition morphs need JavaScript, travel in a straight line and cannot be interrupted gracefully. AIM uses `anchor()`, `anchor-size()`, `@starting-style` and `interpolate-size`, so an ordinary transition morphs from the invoker and can reverse.
- How: give the chip `anchor-name: --chip`. On the panel set `position-anchor: --chip; interpolate-size: allow-keywords;` and put the anchor's edges in `@starting-style`, all inside `motion-safe`. Adam's code uses physical `left/top/right`, which must be mapped to logical sides here. Browser support for anchor positioning and `interpolate-size` was not verified in this pass, so ship a fade fallback.
- Sources: Adam Argyle — "Anchor Interpolated Morph (AIM)" — https://nerdy.dev/anchor-interpolated-morphing — 2026-01-23 — "But… that requires JS, is always a straight line and is not elegantly interruptible."
- Confidence: low (single source, new platform features)
- Conflicts: the shared-element pass (example 15) will likely use view transitions for navigating from a card to the listing page. The two coexist: view transitions between pages, anchor morphs inside a page.

### H-5: Leave and return by the same path, and slide tab content toward the tapped tab's side, mirrored in RTL
- Topic: motion
- Why: Apple: things that go out of view come back along symmetric paths, which reinforces where they live. Benji: a tab tapped on the left moves content left ("we fly instead of teleport").
- How: take the direction from tab index and `dir`, never from physical names. In `dir="rtl"` a later tab sits further left, so moving forward enters from the left. Keep it at 200 ms or less, and use a crossfade under reduced motion. Example tabs: «همه آگهی‌ها» / «ذخیره‌شده‌ها». The sign formula is inference: `(next > prev ? 1 : -1) * (rtl ? -1 : 1)`.
- Sources: Apple — WWDC18 — "if something is going out of view in your interface, and coming back into view, it should do so in symmetric paths." Benji Taylor — "Family Values" — https://benji.org/family-values — 2024-07-08 — "If you tap on a tab on the left, the transition moves left, and vice versa for the right."
- Confidence: medium-high
- Conflicts: the vendored frequency rule. Tabs flipped dozens of times a session get a short offset or none.

### H-6: Open frequently used menus instantly; if they animate at all, only fade them out, and flash the chosen row first
- Topic: motion
- Why: macOS context menus appear with no motion, fade out, and blink the selected item as reassurance (Rauno). Jakub's arithmetic: 200 opens a day × 300 ms is more than 6 hours a year of waiting.
- How: the sort menu «مرتب‌سازی» and a listing card's overflow menu get no enter transition. Exit is `opacity` over 100–150 ms, and the selected row flashes for about 100 ms before closing (values are inference).
- Sources: Rauno Freiberg — "Invisible Details of Interaction Design" — https://rauno.me/craft/interaction-design — July 2023 — "Interestingly enough, the menu subtly fades out. On closer inspection, the selected item briefly blinks the accent color (pink) to provide assurance". Rauno — "Web Interface Guidelines" — https://interfaces.rauno.me — 2023 — "the native macOS right click menu only animates out, not in, due to the frequent usage of it." Jakub Krehel — "Less is more, more or less" — https://jakub.kr/writing/less-is-more — 2026-06-23 — "that’s about a minute per day or more than 6 hours per year spent watching the animation play out."
- Confidence: medium
- Conflicts: origin-aware entrances (example 16) apply to occasional popovers; high-frequency menus drop the entrance altogether.

### H-7: Suspend all transitions while switching between light and dark themes
- Topic: motion
- Why: otherwise every hover and colour transition fires at once, and images and icons cannot transition anyway.
- How: Paco's technique: inject a style with `* { transition: none !important }`, toggle the theme, force a style flush with `getComputedStyle(...)`, then remove the style. Rauno notes that next-themes does this; check its option name in the docs before use.
- Sources: Rauno — "Web Interface Guidelines" — 2023 — "Switching themes should not trigger transitions and animations on elements". Paco Coursey — "Disable transitions on theme toggle" — https://paco.me/writing/disable-theme-transitions — 2020-03-19 — "we can temporarily remove transitions from all elements so that toggling themes feels snappy and consistent."
- Confidence: high
- Conflicts: none found.

### H-8: On hover-lift cards, keep the element that detects hover still and move an inner layer; enter fast, settle back slower
- Topic: motion
- Why: moving the hover target itself flickers at its edge (Josh's "doom flicker"; Emil's rule). Josh uses a quick hover-in and a relaxed hover-out (150 ms and 450 ms in his demo).
- How: desktop listing card: `<a class="group">` wraps an inner `div` with `transition-transform duration-[450ms] group-hover:duration-150 group-hover:-translate-y-1`. Gate hover for real mice (see H-47).
- Sources: Emil Kowalski — "Agents with Taste" — https://emilkowal.ski/ui/agents-with-taste — first archived 2026-04-20 — "| Hover causes flicker | Animate child element, not parent |". Josh W. Comeau — "An Interactive Guide to CSS Transitions" — https://www.joshwcomeau.com/animation/css-transitions/ — 2021-02-09 (updated 2026-05-05) — "The trick is to separate the trigger from the effect."; "For hover animations, I like to make the enter animation quick and snappy, while the exit animation can be a bit more relaxed"
- Confidence: medium-high
- Conflicts: the vendored checklist says "Make exit faster than enter", and NN/g gives 300 ms in and 200–250 ms out for pop-ups. Reconcile: surfaces (sheets, popovers) exit faster; decorative hover lifts settle back slower.

### H-9: Highlight on touch-down, act on release, and cancel if the finger slides off or the list scrolls
- Topic: interaction
- Why: Apple: the highlight must be immediate, the action waits for touch-up, dragging off cancels and dragging back re-arms. React Aria: a touch that turns into a scroll must not activate, and `:active` can stick after dragging off.
- How: never commit on `pointerdown` or `touchstart`. A listing card in the results feed opens on press-up only when no scroll happened in between. Press feedback (the vendored `scale(0.96–0.97)`) starts on down. React Aria's `usePress` implements the cancellation rules; adopting it is an ADR-0003 decision.
- Sources: Apple — WWDC18 — "The first thing to remember is that the button should highlight immediately when I touch down on it."; "But, we shouldn't confirm the tap until my touch goes up." Devon Govett — "Building a Button Part 1: Press Events" — https://react-spectrum.adobe.com/blog/building-a-button-part-1.html — 2020-08-12 — "If you touch a button and then scroll the page, you likely did not intend to activate the button."
- Confidence: high
- Conflicts: Rauno: "To open immediately on press, dropdown menus should trigger on mousedown, not click". Opening a menu is reversible, so it may happen on press; committing an action still waits for release.

### H-10: Space touch targets by how they look: about 12 pt around bordered controls, about 24 pt around bare icons, plus a forgiveness margin
- Topic: interaction
- Why: Apple treats spacing as being as important as size, and says an extra margin around the tap area prevents cancelled taps when the finger drifts. Ahmad: small targets need more spacing; large ones can touch.
- How: on a listing card, the save and share icons get 44 × 44 hit areas (example 6) with about 24 px between the visible glyphs when bare, or about 12 px when they sit on a filled background. Bordered filter chips can be 8 px apart. Treating CSS px as iOS pt is inference.
- Sources: Apple — HIG Accessibility — 2025-06-09 — "add about 12 points of padding around elements that include a bezel."; "For elements without a bezel, about 24 points of padding works well around the element’s visible edges." Apple — WWDC18 — "The next thing to remember is to create an extra margin around the tap area." Ahmad Shadeed — "Designing better target sizes" — https://ishadeed.com/article/target-size/ — 2024-01-10 — "More spacing for small targets" (section heading)
- Confidence: high
- Conflicts: `ui-design/SKILL.md` non-negotiable 7 asks for 8 px between targets. That fits bordered chips but is too tight for bare icons by Apple's numbers.

### H-11: Leave no dead gaps between adjacent targets in lists and chip rows: grow padding, not margins, and put it on the link itself
- Topic: interaction
- Why: a tap or pointer landing between two rows should never hit nothing (Rauno). Padding on a wrapper shrinks the real target (Ahmad). Jakub lists gaps between items as unseen design work.
- How: in the results list, write `<a class="block py-3">` inside the `<li>` rather than padding the `<li>`. In a chip row, let chip padding meet or bridge the gap with a pseudo-element.
- Sources: Rauno — "Web Interface Guidelines" — "Interactive elements in a vertical or horizontal list should have no dead areas between each element, instead, increase their padding". Ahmad Shadeed — "Designing better target sizes" — 2024-01-10 — "Notice how the clickable area is small? That happened because that spacing is added to the outer container, not the link itself." Jakub Krehel — "The invisible side of design engineering" — https://jakub.kr/writing/the-invisible-side-of-design-engineering — 2026-08-14 — "Gaps between items–Move your cursor between items and watch the gaps"
- Confidence: high
- Conflicts: H-10 wants space around isolated small icons. Rows and chips touch; lone icons breathe.

### H-12: Stop a long-press from selecting the text inside chips, tabs and buttons
- Topic: interaction
- Why: on touch, a long press starts text selection, which inside a control reads as a glitch.
- How: add `select-none` to chips, tabs, segmented controls and buttons. Keep content selectable (prices, listing descriptions). React Aria sets `user-select: none` on touch start and removes it after release.
- Sources: Rauno — "Web Interface Guidelines" — "Interactive elements should disable user-select for inner content". Devon Govett — "Building a Button Part 1" — 2020-08-12 — "user-select: none to the page on touch start on a pressable element"
- Confidence: medium-high
- Conflicts: none.

### H-13: Make drags faithful: start after about 10 pt, keep the grab offset, track 1:1, and settle where the release velocity projects
- Topic: interaction
- Why: Apple: a swipe begins only after a hysteresis distance; the element must not jump to centre on the finger; velocity comes from touch history; endpoints come from projecting momentum rather than from the last position.
- How: for the gallery swipe and sheet drag, ignore movement until `Math.hypot(dx, dy) >= 10`, then lock the axis. Store the grab offset and compute velocity from the last ~100 ms of samples. Pick the snap point nearest `pos + v * d / (1 - d)`, where d ≈ 0.998 per ms, the usual scroll deceleration. The window and the formula are inference: the talk names velocity and deceleration rate but gives no formula.
- Sources: Apple — WWDC18 — "This distance is called hysteresis, and is usually 10 points in iOS."; "We should respect the relative position, and never use the center of the image as the dragging point."; "this idea of using projection to find out the endpoint of a position, is incredibly useful for things being dragged or swiped"
- Confidence: high (formula: inference)
- Conflicts: the vendored dismissal threshold (velocity > 0.11 px/ms) is a simpler proxy for the same idea.

### H-14: Fire lightweight actions during a swipe; fire destructive ones only on release
- Topic: interaction
- Why: revealing an overlay mid-gesture feels natural. A destructive action that fires mid-swipe leaves no chance to change one's mind.
- How: swiping a saved-search row reveals «خاموش کردن اعلان» live, while «حذف» commits only on release past the threshold and offers undo.
- Sources: Rauno — "Invisible Details of Interaction Design" — July 2023 — "Lightweight actions, such as displaying overlays, feel more natural to trigger during the swipe after an arbitrary amount of distance."; "To make sure the interface responds to intent, triggering on gesture end, regardless of distance, feels right here."
- Confidence: medium
- Conflicts: none.

### H-15: Respond to a gesture from its first pixel and animate only past the threshold; zoom photos around the pinch midpoint
- Topic: interaction
- Why: a gesture that does nothing until a threshold gives no sign that it works. The zoom must stay anchored under the fingers.
- How: in listing-photo pinch-zoom, set `transform-origin` to the midpoint of the two pointers at gesture start and let scale follow `distance / startDistance` immediately. Pull-to-refresh follows the finger with damping before it triggers.
- Sources: Rauno — "Invisible Details of Interaction Design" — "It feels a lot better by feeling the scale delta applying immediately, and then performing an animation past a given threshold"; "the interface needs to first establish an anchor point from where the zooming originates"
- Confidence: medium-high
- Conflicts: none.

### H-16: Resolve competing gestures early, and avoid double-tap handlers on content people also tap once
- Topic: interaction
- Why: detect every candidate gesture from touch-down and cancel the losers once intent is clear. A double-tap listener makes every single tap wait, by about half a second in Photos.
- How: in the gallery, a tap toggles the chrome and a pinch zooms; use a zoom button instead of double-tap. `touch-action: manipulation` (vendored) only removes the browser's own zoom wait.
- Sources: Apple — WWDC18 — "we should detect all possible gestures from the beginning of the action. And, once we are confident of the intention, cancel all the other gestures."; "tapping to show the app menu is delayed by about half a second."
- Confidence: high
- Conflicts: none.

### H-17: In a scrolling bottom sheet, allow drag-to-close only from the top of its content, and ignore drags for 100 ms after reaching the top
- Topic: interaction
- Why: a fast scroll overshoots into a drag and closes the sheet by accident.
- How: `if (list.scrollTop > 0 || now - reachedTopAt < 100) return;`. This matters for the filter sheet with the long brand list «برند».
- Sources: Emil Kowalski — "Building a Drawer Component" — https://emilkowal.ski/ui/building-a-drawer-component — first archived 2023-11-10 — "I’ve written a shouldDrag function that doesn’t allow you to drag unless you are scrolled to the top of the drawer."; "I added a timeout of 100ms, which prevents you from dragging in that time frame after you’ve reached the top again."
- Confidence: medium
- Conflicts: none.

### H-18: Keep a sheet's inputs above the on-screen keyboard by sizing the sheet from `visualViewport`; use pixel snap points when an input must peek out
- Topic: interaction
- Why: the browser's own scroll-into-view pushes the sheet up and hides content.
- How: on `visualViewport` `resize`, set the sheet's height to `visualViewport.height - offset` and its bottom to `innerHeight - visualViewport.height`. This keeps the price inputs «از» / «تا» visible. Snap points in px make an input stick out by the same amount on every phone.
- Sources: Emil Kowalski — "Building a Drawer Component" — "When the keyboard shows, the visualViewport height will decrease and vice-versa."; "Fixed values are particularly useful when you want to ensure that an input evenly sticks out on all devices, for example."
- Confidence: medium
- Conflicts: Emil notes a short lag, because the event fires after the keyboard has finished appearing.

### H-19: Swipe-to-act rows: no fling momentum, a little elasticity at the ends, a commit threshold, and the second action revealed at twice the distance
- Topic: interaction
- Why: an action row should stop where the finger decides, and revealing actions one at a time matches iOS.
- How: Motion `drag="x" dragElastic={0.05} dragMomentum={false}`. Show the first action at 44 px and the second at 88 px; commit at 58 px (Jakub's values, with snap points at ±116 px). In RTL, flip the sign so the actions sit at the inline end. Use it on the saved searches list, and keep a tap alternative (vendored Vercel rule).
- Sources: Jakub Krehel — "Drag gestures on the web" — https://jakub.kr/work/drag-gesture — 2026-01-27 — "For swipe actions, you want the row to stop where you decide, not where velocity decides."; "The two thresholds I used are 44px and 88px."; "POSITION_THRESHOLD is the commit point. Anything below it closes; anything above it opens."
- Confidence: medium
- Conflicts: vendored momentum-based dismissal (toasts, sheets) serves a different job: dismissal honours flicks, action rows ignore them.

### H-20: Apply toggles immediately, with no confirmation step
- Topic: interaction
- Why: a switch is itself the confirmation.
- How: the «اعلان آگهی‌های جدید» switch on a saved search updates optimistically (example 7) and rolls back with an inline error. Offer undo instead of a dialog.
- Sources: Rauno — "Web Interface Guidelines" — "Toggles should immediately take effect, not require confirmation"
- Confidence: medium
- Conflicts: the vendored "Confirm destructive actions or provide Undo" is satisfied by undo.

### H-21: Confirm at the trigger: turn the share/copy button into a check for a moment instead of raising a toast
- Topic: interaction
- Why: feedback where the eye already is needs no search.
- How: «کپی لینک» cross-fades to a check icon (example 17) for about 1.5–2 s (inference) and announces through `aria-live="polite"`.
- Sources: Rauno — "Web Interface Guidelines" — "Show a temporary inline checkmark on a successful copy, not a notification"
- Confidence: medium
- Conflicts: none.

### H-22: Put icons and units inside a field as absolutely positioned decorations with matching padding, and let a tap on them focus the input
- Topic: interaction
- Why: a separate icon beside the input creates a dead, confusing target.
- How: put the search magnifier at `absolute inset-s-3` with `ps-10` on the input. Put the price unit «تومان» at `inset-e-3` with `pe-14`. The decoration forwards focus to the input or is `pointer-events-none` over it. Installed Tailwind 4.3.3 has `inset-s-*` and `inset-e-*`.
- Sources: Rauno — "Web Interface Guidelines" — "should be absolutely positioned on top of the text input with padding, not next to it, and trigger focus on the input"
- Confidence: medium
- Conflicts: none.

### H-23: Give every decorative overlay `pointer-events: none`
- Topic: interaction
- Why: scroll fades over chip rows and gradients over listing photos otherwise swallow taps meant for what lies underneath.
- How: add `pointer-events-none` to fade pseudo-elements and gradient layers, then test by tapping the last chip under the fade.
- Sources: Rauno — "Web Interface Guidelines" — "Decorative elements (glows, gradients) should disable pointer-events to not hijack events"
- Confidence: high
- Conflicts: none.

### H-24: On desktop, let ↑/↓ move through search suggestions and results, and Enter open the focused item
- Topic: interaction
- Why: a keyboard-first path for power users costs little.
- How: search suggestions as an ARIA combobox with `aria-activedescendant`; result cards focusable in reading order. Keyboard moves get no animation (vendored).
- Sources: Rauno — "Web Interface Guidelines" — "Focusable elements in a sequential list should be navigable with ↑ ↓"
- Confidence: medium
- Conflicts: none.

### H-25: Keep password managers away from the search and filter fields
- Topic: interaction
- Why: autofill pop-ups over a search box are noise, and a reserved field name can trigger them.
- How: use `name="q"` (never "password" or "email") and `autocomplete="off"` on the search input. Use `autocomplete="one-time-code"` only on the OTP field.
- Sources: Vercel — "Web Interface Guidelines" — https://vercel.com/design/guidelines — living — "For inputs like “Search” avoid reserved names (e.g., password), use autocomplete="off""
- Confidence: medium
- Conflicts: none.

### H-26: Make keyboard shortcuts work on the Persian layout by matching the physical key rather than the character
- Topic: interaction
- Why: on a non-QWERTY layout a character-based shortcut silently fails.
- How: `if (e.code === "Slash") focusSearch()`, and show key labels for the user's platform. Using `KeyboardEvent.code` for the physical key is inference from the DOM spec, not from the source.
- Sources: Vercel — "Web Interface Guidelines" — "Locale-aware keyboard shortcuts. Internationalize keyboard shortcuts for non-QWERTY layouts. Show platform-specific symbols."
- Confidence: medium
- Conflicts: none.

### H-27: Don't flash loading states: wait 150–300 ms before showing a skeleton or spinner, then keep it visible for at least 300–500 ms
- Topic: loading
- Why: on a fast response a loader that blinks for 80 ms feels like a glitch.
- How: after a filter change, keep the current results and show the skeleton only if the fetch outlives the show-delay. Vercel states that React `<Suspense>` does this automatically; that claim was not verified here.
- Sources: Vercel — "Web Interface Guidelines" — "If you show a spinner/skeleton, add a short show-delay (~150–300 ms) & a minimum visible time (~300–500 ms) to avoid flicker on fast responses."
- Confidence: medium (single source)
- Conflicts: none; it complements H-28's under-1-second rule.

### H-28: Pick the loading indicator by expected wait, and keep the rest of the screen usable meanwhile
- Topic: loading
- Why: an indicator that does not match the wait misleads. Blocking the whole screen punishes people who want to adjust a filter.
- How: under 1 s, show nothing (with H-27's delay). Up to 10 s, use a skeleton for a page or known layout, or a spinner for a single card or action (about 1–3 s). Over 10 s, use determinate progress. Never use a frame-only skeleton. Filters stay interactive while results load.
- Sources: Samhita Tankala (NN/g) — "Skeleton Screens 101" — https://www.nngroup.com/articles/skeleton-screens/ — 2023-06-04 — "If a page takes less than 1 second to load, skeleton screens or spinners aren’t necessary"; "skeleton screens should be used with a wait time that’s under 10 seconds." Vercel Geist — "Spinner" — https://vercel.com/geist/spinner — living — "Use a Spinner for indeterminate, single-action waits of roughly one to three seconds". Apple — HIG Loading — 2025-06-09 — "Let people do other things in your app or game while they wait for content to load."
- Confidence: high
- Conflicts: none.

### H-29: Build skeletons from the real shapes, keep them inert, and announce the result rather than the placeholder
- Topic: loading
- Why: shape-true placeholders reduce the swap and signal what is coming. Focusable or announced placeholders confuse keyboard and screen-reader users.
- How: in a listing-card skeleton, the photo tile is square with its aspect ratio reserved, the price and deal chips are rounded, and the seller avatar is a pill. Nothing inside is focusable. Put `aria-busy="true"` on the results region and a polite live update on the destination («۲۳۴ آگهی»). Empty states are never skeletons. NN/g: "Do Not Use a Frame-Display Skeleton Screen".
- Sources: Vercel Geist — "Skeleton" — https://vercel.com/geist/skeleton — living — "Pick pill, rounded, or squared to mirror the eventual element’s shape (avatars pill, buttons and chips rounded, image tiles squared)."; "Skeletons are decorative; avoid placing focusable controls inside them while loading."; "Wrap the loading region in aria-busy="true" and announce completion with aria-live="polite" on the destination container, not the skeleton itself."; "Don’t use Skeleton as permanent decoration or as a placeholder for empty states."
- Confidence: medium-high
- Conflicts: none; it adds shape and accessibility detail to the vendored "Skeletons mirror final content".

### H-30: Mount spinners only when the action starts, size them to the adjacent text or icon, and after about a second say what is happening
- Topic: loading
- Why: a pre-rendered spinner shows a half rotation at rest, a container-sized one shouts, and a silent wait of more than a second makes people wonder.
- How: saving a search shows «در حال ذخیره…», with the spinner at `size-[1em]` beside the text. When done, show «ذخیره شد» with no dots. Inside buttons use the button's own loading state (the vendored rule keeps the label).
- Sources: Vercel Geist — "Spinner" — "Mount the Spinner only after the action starts."; "Match the Spinner size to the surrounding type or icon size, not the parent container."; "Pair any wait longer than ~1s with copy that names the work". Geist — "Loading Dots" — https://vercel.com/geist/loading-dots — "Don’t string Loading Dots after a completed verb"
- Confidence: medium
- Conflicts: none.

### H-31: Design empty states by cause, cap them at one primary and one secondary action, and announce the new state after filtering
- Topic: content
- Why: "no results" after filtering, "nothing saved yet" and "failed to load" need different next steps. Three buttons dilute the choice.
- How: for a filtered search, show «هیچ آگهی‌ای با این فیلترها پیدا نشد» with «حذف فیلترها» (primary) and «ذخیره جستجو و خبرم کن» (secondary). For saved searches with nothing saved, name the action that creates the first one. Labels are verb + noun. Put `aria-live="polite"` on the results region.
- Sources: Vercel Geist — "Empty State" — https://vercel.com/geist/empty-state — living — "no-results for a filtered list that returned zero rows"; "Cap at one primary CTA, plus one secondary when the first action could legitimately be one of two paths"; "Three CTAs is a smell."; "After an async filter change, wrap the region in aria-live="polite" so screen readers announce the new state." Kate Kaplan (NN/g) — "Designing Empty States in Complex Applications: 3 Guidelines" — https://www.nngroup.com/articles/empty-state-interface-design/ — 2021-09-19 — "Provide direct pathways for getting started with key tasks"
- Confidence: high
- Conflicts: Geist's Title Case rule is English-only.

### H-32: Tooltips (desktop only) explain why, not what; never wrap a labelled input; never make hover the only way to reach an action
- Topic: content
- Why: a tooltip repeating the label wastes attention, a tooltip on an input becomes a second hidden label, and touch cannot hover.
- How: the reasons behind a deal badge («قیمت عالی») belong inline or in a sheet on phones; on desktop a tooltip may add the why, never the action.
- Sources: Vercel Geist — "Tooltip" — https://vercel.com/geist/tooltip — living — "Use a Tooltip to explain why something exists, not what it is."; "Don’t wrap a labelled Input in a Tooltip." (decorative glyphs sit between two words in the fetched text); "Keep primary actions outside the Tooltip; touch users can’t reach a hover-revealed control."
- Confidence: medium
- Conflicts: none; it sharpens the vendored "tooltips last resort".

### H-33: Keep anything people must read or act on out of timed elements; prefer explicit dismissal
- Topic: content
- Why: auto-dismissal fails slow readers and assistive-technology users.
- How: errors never auto-dismiss. An undo after deleting a saved search persists until dismissed or the next action. Timed toasts are for pure confirmations only.
- Sources: Apple — HIG Accessibility — 2025-06-09 — "Minimize use of time-boxed interface elements."; "Prefer dismissing views with an explicit action."
- Confidence: medium
- Conflicts: Emil Kowalski — "Building a Toast Component" — https://emilkowal.ski/ui/building-a-toast-component — first archived 2023-09-05 — "By default the toast disappears after 4 seconds unless you hover over it."

### H-34: Keep sound and haptics out of routine actions; reserve them for rare, completed moments, as a complement to a visual cue
- Topic: interaction
- Why: haptics that fire often become tiresome, and people in silent mode want non-essential sounds gone. Family plays a sound only on a rare action.
- How: no sound or vibration on search, filter or save. If the product ever gains haptics (an installed app), use a single short one on rare completions, always paired with the visual change.
- Sources: Apple — HIG Playing haptics — https://developer.apple.com/design/human-interface-guidelines/playing-haptics — 2024-05-07 — "Avoid overusing haptics. Sometimes a haptic can feel just right when it happens occasionally, but become tiresome when it plays frequently." Apple — HIG Playing audio — https://developer.apple.com/design/human-interface-guidelines/playing-audio — "they also want to silence nonessential sounds, such as keyboard clicks, sound effects, game soundtracks, and other audible feedback." Benji Taylor — "Family Values" — "Completing the action plays a satisfying sound effect." (trash, a rare action)
- Confidence: medium
- Conflicts: none.

### H-35: Never change font weight between rest, hover and selected states
- Topic: typography
- Why: a weight change widens the text and shifts its neighbours, a layout shift on every tap. Persian glyph widths change noticeably with weight (inference).
- How: show a selected filter chip or tab with colour, background or an indicator. If bold is required, reserve the bold width with a hidden duplicate: `after:block after:h-0 after:invisible after:font-semibold after:content-[attr(data-label)]` (inference).
- Sources: Rauno — "Web Interface Guidelines" — "Font weight should not change on hover or selected state to prevent layout shift"
- Confidence: high
- Conflicts: none.

### H-36: Use two text weights in the interface, regular (400–500) and emphasis (600–700), and nothing below 400
- Topic: typography
- Why: thin weights fail at small sizes; Persian dots and diacritics suffer first (inference). More weights blur the hierarchy.
- How: set weight tokens to 400 and 600, and make hierarchy with size and colour.
- Sources: Rauno — "Web Interface Guidelines" — "Font weights below 400 should not be used". Apple — HIG Typography — 2025-12-16 — "avoid Ultralight, Thin, and Light font weights, which can be difficult to see, especially when text is small." Adam Wathan & Steve Schoger — "7 Practical Tips for Cheating at Design" — 2018-02-20 (via web.archive.org) — "two font weights is usually enough for UI work"
- Confidence: high
- Conflicts: none.

### H-37: Underline only links, and make Persian underlines skip the letters' dots
- Topic: typography
- Why: an underline that means "tappable" must stay reliable. The default underline cuts through Arabic-script dots below the baseline.
- How: `a { text-decoration-skip-ink: auto; text-underline-offset: 4px; }`. Ahmad's example also sets `text-decoration-thickness: 2px`. Emphasise non-link text with weight or colour.
- Sources: Emil Kowalski — "Agents with Taste" — "Reserve underlines for links; emphasize non-link text with weight or color so underline stays a reliable affordance". Ahmad Shadeed — "RTL Styling 101" — https://rtlstyling.com/posts/rtl-styling — 2019-12 (updated 2020-01-18) — "using text-decoration-skip-ink property can solve the issue of dots overlapping with the underline."
- Confidence: medium-high
- Conflicts: in 2020 Ahmad found Safari lacked skip-ink; current support was not rechecked here.

### H-38: Match the fallback font's metrics to the Persian web font so its late arrival does not move text
- Topic: typography
- Why: a fallback with different metrics reflows every line when the web font lands, which is layout shift from fonts (this adds a font case to example 2).
- How: installed Next 16.3.5 docs say `next/font/local` has `adjustFontFallback`, default `'Arial'`, and `next/font/google` defaults it to `true`, both to reduce CLS. Keep them on and preload the critical face (the vendored rule). Whether an Arial-based adjustment suits Persian glyphs rendered by a system fallback is untested (inference).
- Sources: Emil Kowalski — "Agents with Taste" — "Declare a fallback stack whose x-height and weight match the primary face so loading does not cause layout shift." Vercel — "Web Interface Guidelines" — "Preload fonts. For critical text to avoid flash & layout shift." Next.js 16.3.5 — `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md` (local, installed version) — `adjustFontFallback` section.
- Confidence: high
- Conflicts: none.

### H-39: Subset web fonts to the scripts and variable axes you actually use
- Topic: typography
- Why: Persian font files carry Arabic, Latin and many variable axes; shipping them all delays text on slow Iranian mobile networks.
- How: use `unicode-range` for the Arabic-script block (U+0600–06FF), the zero-width non-joiner (U+200C) and basic Latin for brand names, and keep only the `wght` axis. The code points are Unicode facts, not from the sources (inference).
- Sources: Vercel — "Web Interface Guidelines" — "Subset fonts. Ship only the code points/scripts you use via unicode-range (limit variable axes to what you need) to shrink size." Rauno — "Web Interface Guidelines" — "Fonts should be subset based on the content, alphabet or relevant language(s)"
- Confidence: high
- Conflicts: none.

### H-40: Let content lead: dim the navigation chrome, use the lowest elevation that still reads, and recheck separation in dark mode
- Topic: visual
- Why: chrome that stays bright after arrival competes with the listings. Over-elevation is visual noise. Shadows separate surfaces weakly on dark backgrounds.
- How: header and bottom navigation text use the secondary colour; listing cards use base elevation; sheets go one level up; in dark mode, pair shadows with a faint ring (vendored).
- Sources: Charlie Aufmann & Maxime Heckel — "A calmer interface for a product in motion" — https://linear.app/now/behind-the-latest-design-refresh — 2026-03-12 — "While the parts central to the user’s task should stay in focus, ones that support orientation and navigation should recede." Vercel Geist — "Materials" — https://vercel.com/geist/materials — living — "Favor the lowest elevation that still reads as elevated against its background; over-elevating is a common source of visual noise."; "shadow contrast on dark backgrounds is weaker than on light, so confirm separation still reads."
- Confidence: medium
- Conflicts: none.

### H-41: Pause loops that are off-screen, and test motion and loading on iOS Low Power Mode
- Topic: performance
- Why: invisible loops burn CPU, GPU and battery on the weak phones this market uses (this adds precision to example 10's weak-device half).
- How: an IntersectionObserver toggles `animation-play-state: paused` on off-screen shimmer and pulse. Include iOS Low Power Mode and a throttled mid-range Android phone in the test matrix.
- Sources: Rauno — "Web Interface Guidelines" — "Looping animations should pause when not visible on the screen to offload CPU and GPU usage". Vercel — "Web Interface Guidelines" — "Device/browser matrix. Test iOS Low Power Mode & macOS Safari."
- Confidence: medium-high
- Conflicts: none.

### H-42: Use `content-visibility: auto` with an intrinsic size on long result lists that are not virtualised
- Topic: performance
- Why: the browser skips rendering off-screen cards, which is cheaper than a virtualiser and keeps find-in-page.
- How: `[content-visibility:auto] [contain-intrinsic-size:auto_360px]` on each listing card. Installed Tailwind 4.3.3 has no utility for it, hence arbitrary properties; 360px is an example value (inference). Verify scroll restoration afterwards.
- Sources: Vercel — "Web Interface Guidelines" — "Large lists. Virtualize large lists e.g., virtua or content-visibility: auto."
- Confidence: medium
- Conflicts: the vendored rule says "Virtualize large lists (>50 items)"; content-visibility is the lighter first step.

### H-43: Budget responsiveness: visible feedback within 100 ms, results within about 400 ms, and use the first 100 ms for set-up before motion starts
- Topic: performance
- Why: 0.1 s feels instantaneous; about 0.4 s keeps attention. The first 100 ms after a tap goes unnoticed, which makes it the place for FLIP measurements.
- How: a chip's pressed and selected state is pure CSS and immediate. Result updates are optimistic or skeleton-backed (H-27). Measure layout for a shared-element move in the tap handler, then animate.
- Sources: Aurora Harley (NN/g) — "Timing Guidelines for Exposing Hidden Content" — https://www.nngroup.com/articles/timing-exposing-content/ — 2015-01-11 — "must appear within 0.1 seconds to maintain the feeling of instantaneous response". Jon Yablonski — "Doherty Threshold" — https://lawsofux.com/doherty-threshold/ — undated — "Provide system feedback within 400 ms in order to keep users’ attention and increase productivity." Paul Lewis — "FLIP Your Animations" — https://aerotwist.com/blog/flip-your-animations/ — 2015-02-11 — "There is a window of 100ms after someone interacts with your site where you're able to do work without them noticing."
- Confidence: high
- Conflicts: consistent with the vendored "Mutations <500ms".

### H-44: Never show a duplicate of something that persists into the next step; move the original instead
- Topic: motion
- Why: a component that fades out while its copy fades in reads as two objects and breaks continuity.
- How: the listing-card photo becomes the gallery's first photo as one element (a shared element, example 15). The price chip stays put while the rest of the page changes.
- Sources: Benji Taylor — "Family Values" — https://benji.org/family-values — 2024-07-08 — "A pet peeve of mine is when a component already visible on the screen unnecessarily duplicates itself during an animation." (next tier)
- Confidence: medium
- Conflicts: none.

### H-45: When a label changes only in part, keep the shared words still and animate only the changed part
- Topic: motion
- Why: animating the whole sentence hides what actually changed.
- How: when the result count «۲۳۴ آگهی» becomes «۲۴۱ آگهی», only the digits change (tabular-nums, example 11). When «ذخیره جستجو» becomes «جستجو ذخیره شد», the shared word stays still. Animate whole Persian words, never single letters, which would break cursive joining (inference). A per-span `view-transition-name` is one way, as in Adam's demo.
- Sources: Benji Taylor — "Family Values" — "This effect is achieved through a system we created that leverages shared letters — such as the "Con" in both words."; "By keeping most of the text unchanged and constant when only a portion needs updating, we avoid the jarring effect" (next tier). Adam Argyle — "Text Replace Transitions" — https://nerdy.dev/text-replace-transitions — 2023-01-10 — "One letter disappeared, one letter appeared. We get a crossfade!"
- Confidence: medium
- Conflicts: the Persian joining caveat (inference).

### H-46: In a multi-step sheet, make consecutive steps differ in height so each step change is visible
- Topic: motion
- Why: when two steps have identical heights the change can go unnoticed.
- How: in the filter flow «برند ← مدل ← تیپ», if two steps would be the same height, adjust the content (Benji rewrites copy). Animate the height with `interpolate-size` or a measured height.
- Sources: Benji Taylor — "Family Values" — "To prevent any confusion during transitions, each subsequent tray is designed to vary in height." (next tier)
- Confidence: medium-low (single source)
- Conflicts: none.

### H-47: Don't rely on `@media (hover: hover)` alone for hybrid devices; decide hover from the pointer type of the actual event
- Topic: interaction
- Why: on touch laptops and iPads with trackpads the primary input changes at runtime, so the media query answers wrongly and emulated hover sticks after a tap.
- How: React Aria's `useHover` ignores hover emulated after touch (reference only). A plain version applies the hover state only on `pointerenter` with `e.pointerType === "mouse"` (inference).
- Sources: Devon Govett — "Building a Button Part 2: Hover Interactions" — https://react-spectrum.adobe.com/blog/building-a-button-part-2.html — 2020-08-25 — "These hybrid devices are incompatible with the hover media queries because the user can change interaction modes at any time." (next tier)
- Confidence: medium
- Conflicts: `vendor/emil-design-eng.md`, Rauno and Vercel prescribe `@media (hover: hover) and (pointer: fine)`. That is right for phones and imperfect on hybrids.

### H-48: Align an icon with the first line of wrapped text, not with the middle of the block
- Topic: visual
- Why: a vertically centred icon floats beside a two-line label.
- How: use `items-start` and offset the icon by `--offset: calc((1lh - var(--size)) / 2)`. Use it for the listing spec rows (a gearbox or fuel line that wraps) and the deal-reason bullets. `1lh` follows Persian's taller line height automatically.
- Sources: Ahmad Shadeed — "Better Icon and Label Alignment" — https://ishadeed.com/article/aligning-list-icons/ — 2026-09-15 — "When the text is one line, the icon is centered, but when the text has multiple lines, the icon is still centered but looks odd."; code: "--offset: calc((1lh - var(--size)) / 2);" (next tier)
- Confidence: medium (support for the `lh` unit not rechecked)
- Conflicts: none.

### H-49: Reserve the scrollbar's space on containers whose content can grow into scrolling
- Topic: visual
- Why: when a scrollbar appears it steals width and the content jumps sideways.
- How: installed Tailwind 4.3.3 has `scrollbar-gutter-stable` and `scrollbar-gutter-both` (`stable both-edges`, for symmetric padding). Use them on the filter sheet list and on desktop side panels. Phones with overlay scrollbars are unaffected (inference).
- Sources: Ahmad Shadeed — "Custom Scrollbars In CSS" — https://ishadeed.com/article/custom-scrollbars-css/ — 2021-06-22 — "It works in a way that lets us reserve the space in advance." (next tier)
- Confidence: high
- Conflicts: none.

### H-50: In RTL, keep decorations inside the left (inline-end) edge, because browsers clip overflow only at the inline start
- Topic: visual
- Why: a decoration bleeding off the left edge of an RTL page creates a horizontal scrollbar, whereas the same decoration on the right is silently clipped.
- How: keep decorative shapes within bounds, or use `overflow-x-clip` on the section. `clip` does not create a scroll container the way `hidden` does (inference). Check at 412 px.
- Sources: Ahmad Shadeed — "Clipping Scrollable Areas On The inline-start Side" — https://ishadeed.com/article/clip-scrollable-areas-inline-start/ — 2021-02-07 — "the browser user agent will clip the overflow area of the block-start and inline-start areas."; "For a document that starts from right to left (e.g: Arabic website), the inline-start of the document will be on the right side." (next tier)
- Confidence: high (backed by the spec text he quotes)
- Conflicts: in 2021 Ahmad saw Firefox show a scrollbar anyway; this was not rechecked.
