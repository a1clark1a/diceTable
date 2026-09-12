# Changelog

All notable changes to DiceTable are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- The eight row colors are one family now. They were a stock set that never got tuned with the rest of the palette: cooler and more saturated than the warm page they sit on, and uneven enough in strength that the purple row shouted while the teal one receded. Every row now carries the same color strength, so no roll looks more important than another because of the slot it happened to land in, and lightness does the work of telling them apart instead. Neighbouring rows now stay separable for red-green color blindness, which the old set did not manage, and all eight clear the contrast floor against the chart panel in both light and dark, which the old gold did not.
- A pool or check roll no longer repeats itself. The row used to say so three times over: a colored band down its left edge, a Pool or Check badge beside the name, and the chip that was already lit in the Sum / Pool / Check control. Only the chip remains, and it still explains itself on hover. The band down the left edge now means one thing, that this is the roll everything else is being compared against.
- Roll-off and Head-to-head sit in the middle of the page. Both are as wide as their content, so on a wide screen they used to hang off the left edge with the rest of the page empty beside them. They still fill the width when there is not enough room for them.
- Three pieces of chrome were drawn against the wrong part of the palette. The Image button carried an outline that Import and Share beside it did not, so it read as the only boxed control in the top bar. The Roll mode label was a step fainter than the rest of the chrome, and the target ruling menu was outlined in the strong border rather than the quiet one.
- The rolls scroll inside the table instead of taking the page with them. The parameters row, the pin-a-roll line and the Add roll / Examples buttons now stay where they are, and the column headings stay with them, so a long table no longer means scrolling back up to reach a button. The arrow that existed to take you back to the top is gone from desktop, since there is nothing to go back to; on a phone, where the page still scrolls and the chart sits below the rolls, both arrows stay.
- The column headings were painted in the body text color at the wrong weight, so they competed with the rolls instead of labelling them. They are the muted tone the rest of the chrome uses, in both light and dark.
- The chart gets the width the table was not using. The table used to stretch to fill the window, which left a band of empty space on every row between the Sum / Pool / Check chips and the Mod column. It now stops at the width it needs and the chart takes the rest, so on a 1920px screen the chart is about twice as wide as it was. Whatever is still spare goes to the roll names, which now have room for longer titles instead of cutting them off.
- The Sum / Pool / Check chips have a column name. They sit beside the dice notation under a heading that only read Dice, so they looked like a column nobody had labelled. The heading now names both, and hovering Style explains what the chips do.
- New color palette, in both light and dark. The page ground is now a warm off-white (a near-black in dark mode) with panels raised a step above it, so the table, the chart cards and the toolbars read as separate surfaces instead of a stack of near-identical off-whites. Text, borders, the blue and purple accents, and the green / amber / red hit ramp all moved with it, and every color that carries text clears the 4.5:1 contrast floor in both modes. The exported share image follows the same palette, so a saved picture looks like the app it came from.
- Each chart card has an enlarge button. It opens the same chart in a large view, with its legend, its hover and its PMF / CDF / CCDF / TARGET control intact, because it is the same panel rather than a second copy.
- The divider between the table and the chart can be dragged to give the chart more room, or the table. Arrow keys move it too. The width lasts for the session rather than being saved.
- The parameter rows hold their shape when they fill up. Target and Pool target used to overlap the table once enough targets were added, and the guidance sentence that sat between them now rides the input it describes. Adding a target is a small square marked with a plus that sits with the targets themselves and turns into a minus once five are set, and the rows now fold onto more lines on a narrow screen instead of running off the edge. On a wide screen Target, Pool target and Roll mode stay on one line even with five targets set on each.
- Target is labelled in blue to match the Sum chip, Pool target keeps its purple, and the purple rule that used to sit beside Pool target is gone, since the label already says which is which.
- The table and the chart now use the whole window instead of sitting in a fixed centre column, so a wide screen shows more of the table rather than more empty margin.
- The Sum / Pool / Check chips line up down the table. They used to start wherever each roll's dice notation happened to end, which made the same control land in a different place on every row.
- One row of controls instead of three. Target, Pool target and Roll mode now share a single line, the Image button joined Import and Share in the top bar, and the band that used to sit between the tabs and the table is gone. That is about 100px of chrome returned to the rolls.
- Quieter chrome. The bar carrying the DiceTable mark is a fixed 52px with the page links beside it, and the Target and Pool target rows lost their boxes, lining up against a shared label column instead of sitting in separate cards. The roll mode chips are shorter and lost their gray track, so the one that is selected is the only one with a fill.
- The page heading now shows only while the table is empty. Once there are rolls the space goes to the table instead, and the heading stays in the page for screen readers and search engines.
- Table rows are a third shorter, so more rolls fit on screen at once. Each roll sits on one line now: the name, the dice and the Sum / Pool / Check chips share a row, the boxes around the name and modifier fields are replaced by a single underline that washes on hover, and the avg and spread labels that repeated on every row moved up into the column header. The table also lost its card border, so the space under the last roll reads as page rather than as an empty panel.
- On a desktop, Add roll, Examples and Clear moved out of the toolbar and onto the rolls themselves, so they now sit with the table on every view instead of only where the toolbar happened to be. On a phone they stay in the toolbar's overflow menu. Clear is a plain trash button at the end of the group rather than a red one next to the primary action, and it still asks before emptying the table. The view bar above them is now just the four tabs, marked by an underline instead of a filled chip.
- Off-scale cells in the Target hit grid show a dash. A pool roll has no answer for a totals target and vice versa, and a blank cell read as a number that failed to load.
- The All / Sum / Pools filter on Target hit is blue like the other view controls. Purple now means a pool roll and nothing else.
- On a wide screen the comparison chart now sits beside the table instead of below it, so editing a roll and watching the curve move no longer means scrolling between the two. The table and the chart rail each scroll on their own and the page itself does not, so the header and footer stay put. The chart only moves beside the table once the window is wide enough for both, and drops back underneath it below that.
- Totals and Successes are separate cards, each with its own title and its own PMF / CDF / CCDF / TARGET control, and a card only appears when it has rolls to draw. Picking a view still changes both, and TARGET only offers itself on a card whose rolls have a target to measure against.
- On a phone the roll cards are rounded a little more, and the Target and Pool target rows are separated by a hairline instead of by their own boxes. Filling both rows with the maximum five targets each now wraps onto more lines rather than running off the side.
- Baseline comparisons read as two numbers side by side under Avg and Spread, in place of the two stacked bars. Green still means better and red worse. The plain-language summary that used to sit under a roll's name, such as "Averages 1.5 higher, steadier", now appears when you hover those numbers.

### Fixed

- Dice editor warnings, such as the one that appears when a keep rule asks for more dice than the roll has, were too dark to read against the dark background. They now use the palette's text red instead of its button red.
- Chart gridlines went missing in dark mode. They were being drawn in a tone meant for a darker surface than the chart card now uses.
- Expanding a check row dropped its orange band until you collapsed it again.

## [2.0.0] - 2026-09-07

### Added

- Check mode: a third setting beside Sum and Pool for rolls that decide whether something happens. A check row rolls against a number you set, then applies an effect scaled by how it went, which covers attack-then-damage, save-for-half, and any if-then mechanic without typing a formula. The expanded row asks for three things: the Check (die, modifier, and the number to clear, with a live success percentage), the Effect (its own dice and modifier), and the Outcomes (all of it, half rounded down, or none, on a success and on a failure). A check of exactly one die can also carry a Critical: chosen faces that always succeed and either roll double the dice, roll one extra die, or add the highest the dice can show. The row's average counts the misses, so it reads as the result per attempt.
- Check rows are ordinary rows everywhere else: notation reads `1d20 + 7 ≥15 → 1d8 + 4 · crit 20 ×dice`, and the Table, Target hit, Roll-off, Head-to-head, baseline deltas, sparklines, share links, and import all treat them like any other roll on the totals scale. Rows carry a Check badge, an orange band, and a "succeeds NN%" chip.
- Keep across parts: a rule on the whole roll rather than one part, so `1d8 + 1d6 · keep highest 1` (the trait-and-wild-die roll) is finally expressible. It works across dice of different sizes, and turning it on switches off the per-part Keep chips, which explain why.
- Share as image: an Image button in the toolbar on every view renders a picture of whichever view you are on to a PNG, with an optional title. The picture follows the controls you set, not just the view you picked. Target hit draws whichever of Grid, Curves or Bars is selected. Grid and Bars honour the All / Sum / Pools filter and the grid's column sort, and Curves always plots the sum rolls. Roll-off draws in the order its sort chip is set to. The Table view draws its comparison chart, with pool rolls in their own Successes panel stacked under the Totals one and grouped hit-rate bars when the chart is on the target view. Head-to-head draws the pairwise matrix, capped at twelve rolls and saying so. Every card states on itself whatever it left out. The button explains itself when it cannot draw, so the compare views say they need two rolls rather than handing over a picture of that sentence. Copying puts the picture and the share link on the clipboard together, so pasting into a chat gives the image and pasting into a text field gives the link. Save PNG and, on phones, the system share sheet are there too, and Copy image / Save PNG are mirrored into the Share menu. The picture is drawn from the computed numbers, not screenshotted.
- Docs for all three: glossary entries (Keep across parts, Check, Succeeds when, Effect scale, Critical), two new "The Math" sections (the level identity behind keeping across differently-sided dice, and the weighted mix behind checks), a new Quickstart step 6 introducing Check mode (Compare rolls onward renumbered to 7-11), and an updated `public/llms.txt`.

### Changed

- The Target hit and Roll-off views now remember their own controls. The sub-view (Grid, Curves, Bars), the All / Sum / Pools filter, the grid's column sort, and the roll-off sort order are saved with the table instead of resetting whenever you leave the view, and the share image reads them so the picture matches what you set.
- The PMF chart no longer lets one row's misses flatten every other curve: when a check row piles mass on "nothing happened", that bar is capped and marked with its exact chance, which is still readable on hover and in the chart's description. Row sparklines do the same at their own scale. Tables with no check rows are unaffected.
- All probabilities stay exact. Checks are a weighted mix of the outcome distributions and keep-across-parts is an exact level walk; neither samples or approximates.
- The exported image is now scaled, stepped, and dashed exactly like the chart it is a picture of: round axis percentages, one flat tread per result on the PMF view, and the same dash patterns that keep rows apart for color-blind readers. Narrow result ranges (a pool counting 0 to 5 successes, say) now reserve half a tread at each end of the plot, so the first and last steps sit inside the axis instead of running off the card.
- The effect outcome controls read as one pick-one segmented control instead of three separate rule chips, so orange now means "this is a check row" and blue means "this control is on", nowhere both.

### Fixed

- The Curves sub-view no longer demands a target it does not use. Curves plot the hit chance for every possible target, so they now draw as soon as a summed roll exists, and the Grid / Curves / Bars chips stay on screen with no target set instead of vanishing and stranding you on whichever sub-view you last picked.
- The Roll-off headline no longer names a favourite when no roll can win outright. A table whose rolls always tie now reads "These rolls almost always tie." instead of calling it a coin flip between two rolls that each win 0% of the time.
- A check row that rolls more than one die no longer reports "(too complex)" when it carries a leftover critical rule. A critical is read off a single die's face, so the cost guard no longer charges for a roll that can never happen.

## [1.9.0] - 2026-08-24

### Added

- First visits start with an empty table and a "Start with an example" panel: eight ready-made rolls (weapon attack, two-hander, mixed dice, ability score, save DC check, check with advantage, a d10 success pool, and keep-the-best-die), each card showing its real engine-computed average and range. "Use this roll" adds one, "Load every example" adds all eight, and "Start from a blank roll" works like Add roll. Deleting or clearing every roll returns to the panel, and the roll-mode chips, target toolbar, table, and charts stay hidden until the table has rows again.
- Clear all: a red button next to Add roll that empties the table after a confirmation dialog ("Clear the table?" with Cancel and a Clear N rolls button). Clearing also unpins the baseline. On phones the button reads "Clear".
- Examples button: once the table has rows, the same eight example rolls stay available in a dialog. Adding one appends it to the table (re-adding an example renames the copy, like "Weapon attack (2)"), and "Load every example" appends all eight and closes the dialog.
- Quickstart step 1 now mentions the example panel and the Examples button.

### Changed

- Every Add roll button now disables at the 100-roll cap with an explanatory tooltip, including the one in the toolbar.

## [1.8.0] - 2026-08-22

### Changed

- New app icon: a twenty-sided die sitting under a wooden table. The favicon, PWA icons, apple touch icon, and the social share card are all regenerated from it.
- Docs sections now live at their own addresses: /docs/quickstart, /docs/glossary, and /docs/math. The section strip is real navigation (each section can be opened, bookmarked, and shared directly), each section gets its own page title and description, and old links keep working: /docs and /docs?tab= links redirect to the matching section.
- The glossary page now carries machine-readable definitions for every term (schema.org DefinedTermSet), and the sitemap and `public/llms.txt` point at the new section addresses. `llms.txt` also now covers the baseline comparison and share features, and describes the notation as displayed rather than typed.

## [1.7.0] - 2026-08-16

### Added

- Roll-off view: the third workshop view. If every roll rolled once, it shows each roll's exact chance of producing the single highest result, as win bars scaled against the favorite with a headline sentence ("Sneak attack is most likely to come out on top." or "It's nearly a coin flip between…"), per-roll "ties X%" notes, and a Win chance / Table order sort toggle. Ties are counted separately because nobody wins them outright.
- Head-to-head view: the fourth workshop view. A matrix of one-on-one odds where each cell is how often the row roll strictly beats the column roll, ignoring every other row, colored by the hit-chance scale and bold at 50% or better. Hover or tap a cell for the full sentence including the tie chance. On mobile the matrix scrolls sideways inside its own container.
- Both views compute exactly from the distributions already on hand (a new pure `compare` engine module, no simulation), require at least two rolls with valid dice, and include Pool rolls on their success-count scale with a caption explaining why cross-scale match-ups are usually lopsided.
- Comparison docs: glossary entries (Roll-off, Head-to-head, Tie), a new "The Math" section on exact win and tie chances, an updated `public/llms.txt`, and a new Quickstart step introducing the four workshop views (the Roll and Share steps renumbered to 9 and 10).

## [1.6.0] - 2026-08-11

### Added

- Baseline comparisons: pin any roll as the baseline with the pin button on its row. The pinned roll keeps its own numbers, wears a Baseline badge, and gets a tinted row with an accent band. Every other roll then shows how it differs instead of its own totals: labeled avg and spread delta lines with small direction bars, signed Hit % differences in percentage points, and a plain-language verdict under the name ("Averages 3.5 higher · swingier · hits 46% more often"). Green means better, red worse, and spread changes stay neutral because more or less swing is not automatically better. Rolls on a different scale (Pool vs Sum) keep their own totals and compare by Hit % only. Pinning another roll moves the baseline, tapping the pin again clears it, and the choice survives reload. A caption above the table explains the state either way, and a new "Baseline" glossary entry covers the concept on the docs page.
- Community dice vocabulary: the glossary's "Target ruling" entry now ends with a small map from each ruling to its community name (≥ is "roll over" or "meet or beat" as in D&D and Pathfinder, ≤ is "roll under" as in Call of Cthulhu and GURPS, and the strict `>` `<` `=` readings are marked as having no common name).

### Changed

- The ≥ and ≤ ruling tooltips (on target chips, the Hit % header, and the target hit view) gained a second sentence naming the same community terms.

### Fixed

- TARGET view bar labels no longer overlap. Labels drop a redundant trailing ".0" (100.0% reads 100%), hide as a group when the bars are too narrow to fit them (hover or tap a bar for the exact value), and the chart claims a little more width per bar so labels fit at desktop sizes.

## [1.5.0] - 2026-08-02

### Added

- Target hit view: the second workshop view, registered beside "Table & chart" in the view switcher. It answers "how reliably does each roll meet the targets?" three ways. Grid shows a rolls × targets matrix of hit chances, color-coded from reliable (green) to long shot (red) and sortable by any target column (click to sort, click again to flip, once more to clear). Curves plots each Sum roll's hit chance for every possible target value at once, with dashed markers at the current targets. Bars shows one panel per target with rolls ranked by hit chance. The target toolbar is shared with the Table & chart view, which is unchanged visually.
- Pool rolls in the Target hit view: Grid and Bars show them against the shared pool target (marked with `*` and a footnote), and an All / Sum / Pools filter appears whenever both kinds of roll exist. Curves compares Sum rolls only.
- `public/llms.txt` now describes the Target hit view.

### Fixed

- Vercel API build: `api/tsconfig.json` now includes the Node type definitions, so the serverless error-report endpoint type-checks correctly on Vercel.

## [1.4.0] - 2026-07-31

### Added

- Dice pools (counting successes): every roll now has a Sum / Pool toggle in its Dice cell. A Pool roll counts how many dice meet a success threshold (direction and number editable inline, e.g. `count ≥8` on d10s) instead of adding faces into a total. Per-die odds stay exact, including rerolls. Keep and explode are stripped when a roll switches to Pool, so notation and math always agree; advantage/disadvantage is kept on the roll but has no effect while pooled.
- Auto-successes: on a Pool roll the flat modifier adds or removes successes directly (shown as `+2 auto`), and a result never drops below zero successes.
- Pool target: a shared "at least n successes" control in the target toolbar. Pool rolls' Hit % reads against it, while Sum rolls keep using the numeric targets.
- Successes chart: Pool rolls compare on their own panel with a success-count axis, beside the totals chart on desktop and stacked on mobile. Row colors still match the table swatches.
- Pool docs: glossary entries (dice pool, success, success threshold, auto-successes), a new "The Math" section on counting successes, a quickstart note on the Sum / Pool toggle, and an updated `public/llms.txt`.
- Share/export format v2 carries the new pool fields; v1 links and files still import, with their rolls defaulting to Sum.

### Fixed

- Removed the leftover commit sign-off checkbox from the PR template and the create-pr playbook. The DCO requirement itself was dropped in 1.2.0; these two references had survived that cleanup.

## [1.3.0] - 2026-07-27

### Added

- Workshop view switcher: a chip group above the table for switching between workshop views. This release registers only the existing "Table & chart" view; additional views (target hit, roll-off, head-to-head) register their chips as they land.
- Global roll mode: a Normal / Advantage / Disadvantage control in the header that applies one roll mode to every roll at once, with a "mixed" state shown when rows currently differ.
- "Add roll" button in the header, alongside the existing add row at the bottom of the table.

## [1.2.0] - 2026-07-17

### Added

- Open source project scaffolding: `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1).
- GitHub community templates: issue templates (bug report, feature request, documentation), pull request template with verification checklist.
- `.github/dependabot.yml`: monthly grouped npm and GitHub Actions updates, targeting the `develop` branch, with `@types/node` major bumps ignored until `engines.node` is upgraded.
- `.editorconfig`: shared editor defaults (UTF-8, LF, final newline, 2-space indent; Markdown exempt from trailing-whitespace trimming).
- `npm run verify` script: runs lint, tests, and the type-check (build) in one command, matching CI.
- Architecture docs for the probability engine and security headers (`docs/architecture/`), linked from the README and CONTRIBUTING.
- Crawlable, indexable homepage: a static `<h1>` and lead sentence shown above the roll table and baked into `index.html`, plus `WebApplication` structured data (JSON-LD), so search engines and non-JavaScript crawlers can read the homepage.
- Per-route SEO metadata via a `RouteHead` component: each route sets its own `<title>`, description, canonical URL, robots directive, and Open Graph / Twitter tags (the not-found page is `noindex`).
- `HowTo` structured data (JSON-LD) on the Docs quickstart, describing the getting-started steps for search engines and language models.
- `public/llms.txt`: a plain-language summary of what DiceTable is and computes (exact distributions via full convolution, dice notation, roll modes, stats, targets and hit rates) for large language model crawlers.

### Changed

- Pull request template now includes a "Dependencies" type-of-change option for Dependabot and manual dependency bumps.
- Slimmed the pull request template to a single checklist, dropping the local lint/test/build attestations in favor of the CI gate.
- Reworked the feature-request flow to a welcoming, demand-led stance and added a "Feature requests" section to CONTRIBUTING; the README and CONTRIBUTING now note `nvm use` for onboarding and the `verify` script for the pre-PR check.

### Fixed

- Feature request template's intro now correctly references the "Project scope" section of CONTRIBUTING.md (previously called out a "What it is / What it isn't" section that no longer exists).
- README Privacy and SECURITY.md now accurately describe the anonymous crash-report endpoint (`api/errors.ts`); both previously stated there was no server-side component or application telemetry.

### Removed

- Developer Certificate of Origin (DCO) sign-off requirement. Contributions remain MIT-licensed by the inbound=outbound rule, so an explicit `Signed-off-by:` trailer is no longer required. CONTRIBUTING.md, PR template, and README updated accordingly.

## [1.1.0] - 2026-06-03

Initial public release. Prior development history is preserved in the git commit log.

### Highlights

- Single flat table of named dice expressions with stats (mean, min, max, mode, σ, Hit %).
- Overlay chart for PMF / CDF / CCDF across all rows.
- Pure-function probability engine in `src/engine/` (full convolution, no approximations).
- Mobile-first card layout for screens under 720 px.
- Light and dark color modes.
- Versioned `localStorage` persistence with schema validation.
- PWA with offline support.

[Unreleased]: https://github.com/a1clark1a/diceTable/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/a1clark1a/diceTable/releases/tag/v2.0.0
[1.9.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.9.0
[1.8.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.8.0
[1.7.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.7.0
[1.6.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.6.0
[1.5.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.5.0
[1.4.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.4.0
[1.3.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.3.0
[1.2.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.2.0
[1.1.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.1.0
