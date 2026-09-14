# Changelog

All notable changes to DiceTable are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Keeping some of a roll's dice while those dice can explode no longer freezes the page. Keep and Explode on the same group was reaching the maths through a route that grew with the number of faces a die could show, and an exploding d6 can show 56 of them rather than 6. Six dice keeping five took 25 seconds of a locked-up tab, eight dice keeping seven would have taken about half an hour, and the check meant to catch that was reading the die as though it had never exploded. Both are now under a hundredth of a second, and the check reads the roll the app is actually going to make.
- Rolls that kept dice are no longer turned away for work the app does not do. Keeping the best few of twenty d20s, of thirty d6s, or of a hundred d100s all said "(too complex)" and now simply answer, as does roll-and-keep at the size those systems actually use: twelve exploding d10s keeping six is nine milliseconds.
- A roll that explodes on a low face is no longer refused for being wide. Exploding a d100 on a 1 was measured as though every extra die could land on 100, which made a roll reaching 150 look like one reaching 5,100.
- A critical that rolls more dice than an ordinary hit is now measured on the dice it really rolls. A check whose critical doubles its damage was sized by the smaller roll, so a critical twice too big to draw could still be accepted.
- A roll that keeps more dice than it has stays blank instead of quietly answering. The editor already called it a mistake in red, and the number beside it now agrees.

## [2.1.0] - 2026-09-14

### Added

- Enlarging one chart on a wide screen now draws every roll at once, however many there are. Past about thirty the curves stop being drawn in their own colour and dash and become a field: all of them at once and faint, with the one you point at lit up on top. That is a different question from the paged view and a more useful one at a hundred rolls, because eight colours and eight dashes only ever make eight tellable-apart pens, so past that no cap and no amount of extra canvas helps. Seeing where your roll sits in the spread of the whole table does not need you to tell a hundred lines apart. Pick a name from the legend to light one, pick it again to put it back, and the tooltip pins the lit roll at the top so its number is never the one the list drops. A screen reader hears where the roll ranks instead, since a picture is nothing without sight.
- The field is the default on that canvas, not the only option. A "20 at a time" button beside the view chips switches the enlarged chart back to twenty rolls in their own colours and dashes, with the arrows to page through the rest, and switches back again. Both are real ways to read the same table: the field answers where one roll sits among all of them, and the page answers what each roll looks like. The button only appears where the choice would change something.
- The rail keeps its page of twenty, and so does an enlarged chart on anything that is not really a wide canvas with a pointer: a phone, a touch screen, a narrow window, both charts on screen at once, the target view, or a table of dice wide enough that drawing a hundred curves would stall. Each of those keeps exactly what it drew before, and the ones that page still say which rolls they are showing.

- Advantage and Disadvantage say which way they move the curve. Both entries named the rule, roll twice and take the higher or the lower, and neither said what that does to the shape you are looking at. Each now leads with the consequence: the curve shifts up or down, the best or worst possible result does not change, you just reach it far more often. On 1d20 that end of the chart goes from 5% to 9.75%, the same figure the Critical entry beside them already quotes. Disadvantage also gains the note Advantage already carried, that on a check the mode applies to the check and never to the effect.

### Changed

- Target hit's Curves can draw twenty rolls at a time. It draws every roll by default and still does, since reading one roll against all the others is the point of that view, but a hundred lines on one canvas is a wall rather than a comparison. A "20 at a time" button above the chart pages through them the way the comparison chart does. The scale stays on the whole table whichever page you are on, so the lines on one page can be read against the ones on the next, and a page names every roll it draws in the legend instead of stopping the list at twelve.
- Head-to-head shows twenty-four rolls, up from twelve. Twelve was never what the arithmetic could afford: a hundred rolls of ordinary dice work out their one-on-one odds in about five milliseconds, and twenty-four take under half of one. What cost was the grid building a separate tooltip for every cell, which is row-count squared of them. There is one shared tooltip now, so the view appears in about a third of the time it used to take at twenty-four rolls, and every cell carries its sentence as its own label, which means a screen reader reads it whether or not anything is hovered. The picture of the grid still stops at sixteen: it is a fixed width divided by the row count, so every extra roll narrows every column, and past sixteen the figures start touching. Each says what it left out, so neither can claim to have drawn more than it did.
- A picture of the comparison chart works at any table size. It used to refuse outright past twenty rolls; now it draws the first twenty and says so in the footer, the way the other three pictures already did. It was also the only one with no limit of its own, which on a phone meant a picture big enough that some browsers would not save it at all.
- Clicking a name in the chart legend now singles out that roll and keeps it singled out. Before, only hovering worked, which meant it did nothing on a phone and nothing from the keyboard even though it announced itself as a button. Press it again, press Escape, or tap the chart to go back. Long legends stop after twelve names with a button to show the rest.
- A big table gets a comparison chart again, and you can page through it. Past twenty rolls the chart used to go blank and say it was disabled, which is easy to land on in one paste of a shared link. It draws twenty at a time now and says which twenty ("Showing 21 to 40 of 75 rolls") under the legend, with a previous and a next beside it, so every roll can be reached. That matters because there is no way to reorder the table, which made the roll you could never see the newest one you had added. Totals and Successes page separately, since they hold different numbers of rolls and moving one has no business moving the other. Nothing changes for a table of twenty or fewer: it drew everything before and still does.
- Target and Pool target are each a single control now, on every screen size. The old row laid out a label in a fixed column, then the comparison menu, then one chip per value, then a box to add another. A short label left a gap before the first control, a unit like "successes" had nowhere to sit except between the values and the add box, and the bar grew a line every time the chips ran out of room. Each group is now one button that reads out what it is set to ("Target ≥ 10 14 18") and opens its editor when you press it: a small panel on a wide screen, a sheet from the bottom on a phone. The bar holds one line whatever you set, and the chips inside the editor show just the number, since the menu above them already names the comparison.
- Target and Pool target are one line each on a phone. Five of each wrapped to four rows of chips and pushed the first roll 553px down the screen, and that cost grew with every target added. Each group now shows what it is set to on a single line that never changes height, with Edit opening a sheet from the bottom where the chips have room to breathe. The first roll starts 184px higher.
- Controls are finger-sized on a phone. Removing a target was a 24px cross, adding one a 28px box, and the roll button, the Sum / Pool / Check chips and the modifier field were all around 32px, which is below what a fingertip reliably hits. Everything you tap is at least 40px there now, and goes back to its compact size once the table takes over on a wider screen. Terms with an explanation on them, and numbers you tap to inspect, are left at their text size: they sit inside sentences and cannot grow without breaking the line.
- Chart gridlines are plain hairlines again. They were dashed, and the rolls themselves are told apart by their dash pattern, so a flat roll sitting near a gridline was hard to pick out from one.
- The enlarge button can show both charts at once. A table mixing totals and successes draws two charts, and enlarging one used to mean closing it to look at the other. The enlarged view now opens on the one you pressed and offers Totals, Successes or Both, each keeping its own legend and its own PMF / CDF / CCDF setting.
- A tidier bar on a phone. The PMF / CDF / CCDF control moved up into the bar that stays with you as you scroll, so it is reachable without hunting for the charts far below the rolls, and the roll mode row is gone from the parameters area because the same setting already sits in the three-dots menu beside it. That is a row of screen back for the rolls.
- A shared picture draws each chart the way you left it. The two charts used to share one setting, so the image could only ever show both the same way. Totals as a running total beside Successes against your target now exports exactly like that. The other views already pictured what you were looking at, including a target grid narrowed to pools.
- The PMF / CDF / CCDF / TARGET control is back on the row of buttons above the rolls, where it sets what the shape column draws. It had moved inside the chart cards, which left no way to change the column at all, and no way to change anything on a phone, where the cards sit far below the rolls. It is on every screen size now.
- The Totals and Successes charts each remember their own view. Picking CDF on one used to move the other, and the table's shape column with it, because all three shared a single setting. A table mixing totals and successes can now show one as a curve and the other against your target at the same time. A saved table opens with the view it was left on, applied to all three.
- The line above the table names the pinned roll with its own colour swatch, the same square the table marks that row with, so you can see which roll you are comparing against without reading it. It no longer says "Green means better, red worse", which was ambiguous: the table shows two unrelated greens, one for how a roll compares to the baseline and one for how likely a roll is on its own. The name now carries a tooltip that says which is which, and the Hit % heading explains its own colours too.
- Pinning a roll to compare against no longer moves the table, in either direction. A roll on a different scale from the pinned one used to grow its row by a line, pushing every roll below it down, and the averages column quietly widened as well. The words "different scale" are now a small mark on the same line, with the sentence they stood for on hover, and the averages column holds one width whether it is showing averages or differences. Pinning and unpinning now changes nothing about the layout. It used to widen it by about 125px, grow the header by a line, raise a sideways scrollbar that was not there before, and push the chart down the page, and the amount it moved depended on how long the pinned roll's name was. The three things that caused most of that were decoration the row did not need: a bar behind each Hit % gap, a Baseline tag next to the name, and the pinned roll's name repeated in the column header. They are gone, the gap column is pinned to a width that holds both states, and the pinned row now reads more clearly than it did with the tag: a stronger tint that also works in dark mode, its name in bold, the blue edge and the filled pin. Nothing about the table moves when you pin or unpin now.
- The Add roll row stays put while you scroll. Between 768px and 1536px the chart sits under the table and the whole page moves, so Add roll, Examples, Clear and the pinned-roll caption used to travel off the top and you had to scroll back for them. Below 768px the sticky toolbar already held them, and at 1536px the rolls scroll inside their own box, so nothing changes at either end.
- Pool target lines up with Target on a narrow screen. The two rows sit side by side on a wide one, where the pool group is padded away from the target chips beside it. That padding stayed when the bar folded onto separate lines, indenting the whole pool row, label included, by 12px against the row above it.
- The table appears at the width it can actually be read at. It used to arrive at 768px while needing about 1009px, so from there up it scrolled sideways with the row buttons, delete included, off the right edge and nothing to suggest they were there. The cards cover those widths now, and from 992px the table returns without Range and the shape sparkline, the two columns the chart underneath already draws; both come back at 1280px.
- The buttons at the end of each roll stay on screen. The table still gets wider as you add targets, so on a narrower window that column could sit past the right edge. It is pinned to the edge now and the rest of the table slides under it.
- Rolls sit two to a row on a tablet. Between a phone and the width the table needs, one roll used to stretch across the whole window, so a card built for a 360px phone was drawn at 965px and only two fitted on screen. Four fit now, each at a width it was designed for.
- The scroll and jump buttons appear once instead of twice. Below 768px the sticky toolbar and the row above the rolls each drew their own pair, so a screen reader announced each of them twice and a band of a phone screen went to buttons that were already on it.
- The eight row colors are one family now. They were a stock set that never got tuned with the rest of the palette: cooler and more saturated than the warm page they sit on, and uneven enough in strength that the purple row shouted while the teal one receded. Every row now carries the same color strength, so no roll looks more important than another because of the slot it happened to land in, and lightness does the work of telling them apart instead. Neighbouring rows now stay separable for red-green color blindness, which the old set did not manage. There is a set for light mode and a set for dark, because one set cannot clear the contrast floor against the palest light surface and the darkest dark one at the same time. A roll keeps its slot across a theme switch, so its color still identifies it, and every slot now clears the floor on every surface it is drawn on: a table row, a hovered row, a pinned row, a card, the chart and the shared picture. The chart's hover tooltip moved onto the same panel background the rest of the app uses, since a near-black box in light mode and a near-white one in dark left the row colors nowhere to go.
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
- Baseline comparisons read as two numbers side by side under Avg and Spread, in place of the two stacked bars. Green still means better and red worse. The plain-language summary that used to sit under a roll's name, such as "Averages 1.5 higher, steadier", is now behind those numbers: press them and a panel opens with the sentence and the figures it came from, this roll's average, spread and hit chance beside the pinned roll's, and the difference between them. A roll on a different scale from the pinned one opens the same panel from the mark beside its average, so it gets a summary too instead of only an explanation of why its average cannot be compared. The numbers are underlined to show they open something, and pressing them changes nothing about the layout.

### Fixed

- The Quickstart, the glossary and The Math described a table that had moved on. Step 2 said to tap any token to edit it inline, which stopped being true when the notation became the way to open the distribution behind a roll and the dice moved into the opened row. The Head-to-head glossary entry said a big table draws its first twelve rolls while the view above it printed “Showing the first 24”, so the tooltip and the screen gave different numbers for the same cut. The P entry counted three chart views when there are four, leaving TARGET unnamed. The Modifier entry covered totals and successes but not checks. The Inspect entry described the mean panel as a breakdown per die when the column is per result. The Quickstart intro put the chart at the bottom, contradicting its own step 3. The roll button was described as a Sum-only affordance when every roll that is not a pool carries it. The Mode entry described a cell you could click through to see tied results, which went when the Mode column did; the most likely results are highlighted in a roll’s distribution panel now, and the entry says so. And The Math said every multiple of the exploding face is a gap, which holds everywhere except the top, where the depth cap stops the chain and the last face is kept.
- A share link is about a quarter of the size. Every roll carried a hidden identifier that the app threw away the moment the link was opened, and they were the largest part of the link: a hundred rolls went from about 9,800 characters to 2,700. Older links and saved files still open.
- Opening a link made by a newer version says so and tells you to reload, instead of claiming the link is corrupted and suggesting you export it again, which produced another one of the same.
- The shape sparkline stays quick on a roll with a huge range. It drew one invisible hover strip per possible result, so a roll spanning two thousand results drew two thousand of them per row, each about a twentieth of a pixel wide. It now groups them into bands you can actually hit, and the tooltip names the band.
- A roll that would freeze the page is refused instead of attempted. Adding up many large dice was never counted as expensive, so a roll like a hundred hundred-sided dice was accepted and then took most of a second, and a hundred thousand-sided dice took minutes. Those now show the same "too complex" note the app already used for other heavy rolls. The dice count field also has an upper limit now; it was the only number in the editor without one.
- Hovering the comparison chart is smooth again. Every roll was given a point at every result on the shared axis, whether it could reach that result or not, and the curve views drew a dot on each one. One wide roll, say twenty hundred-sided dice, multiplied that cost by the number of rolls: twenty rolls beside it drew about forty thousand dots, and hovering ran at roughly a tenth of normal speed. Each roll now draws only the results it can actually make, plus two points a side to hold its line flat past them. That is 40,196 elements down to 196, and hover frames from 80 to 95ms down to about 7ms. A small table looks exactly as it did, dots included.
- A roll keeps the same line style everywhere. Its colour came from its position in the table but its dash pattern came from its position within the chart panel, and those stop being the same number as soon as one roll counts successes or one roll has nothing to draw. A roll could end up with one roll's colour and another's dashes, and a shared picture could disagree with the screen it came from. Both now come from the same place.
- The chart tooltip fits on screen. It listed every roll, so a full table produced a box taller than the chart it was explaining, and it follows the pointer so there was no way to scroll it. It shows the eight rolls nearest your pointer now, says how many more there are, and always keeps a roll whose bar was cut short, since that is where its real number is written.
- Roll mode is reachable again on Roll-off and Head-to-head. On a wide screen neither view had a control for it, while it still changed every number both of them show.
- The button that takes you back to the top of a long list is back on Target hit, Roll-off and Head-to-head. Only the table had kept one.
- Target and Pool target say what they are set to when read aloud. They announced themselves as "Edit targets", which left out the word actually on screen and never mentioned the values, so the setting could not be heard without opening it and voice control could not address it by the name in front of you.
- Target and Pool target open the way the rest of the app does between 768 and 991px. They opened a pointer-style panel there while every control around them was already sized for a fingertip.
- The page no longer ends in a tall empty band above the footer. Wherever the chart sits under the table, the height left over between the content and the bottom of the window was being shared out evenly between the rolls and the chart, so half of it landed under the chart card, in the gap between that card's bottom edge and the footer's top rule. A full width empty block between two lines reads as an enormously tall footer, which is what it looked like. The leftover height now goes to the rolls, so the chart card sits on the footer and the table gets the room instead. Nothing changes at the widths where the chart sits beside the table, or on a phone.
- The Quickstart and the glossary described controls that had moved. Step 3 called the chart "the bottom panel" and pointed at a single view toggle "above the chart", both written before the chart moved beside the table and each chart got its own view buttons. Step 8 said to type targets into the toolbar, written before Target became a control you open. Step 11 put the Image button in the toolbar while the sentence beside it put Share in the top bar, and they are in the same place. The Target glossary entry still put the comparison dropdown to the left of the chips. Each of these also feeds the structured data that search engines and answer engines read, so every one of them was wrong in two places at once.
- The app summary that answer engines read described the old baseline row. It said each row showed a colored delta and a plain language verdict together, from before the verdict moved behind the deltas into a panel. The homepage description they read was older still, predating pool rolls, checks, the target, roll-off and head-to-head views, and sharing as an image.
- Hit percentages are readable on every surface they appear on. The three colors were measured against the palest panel in the app, so on a pinned roll, which carries a stronger tint, the green and the amber fell below the contrast that size of text needs in light mode. They were slightly under it on a shared picture too. All three are a step darker in light mode now and clear the bar on every background. Dark mode is unchanged.
- The enlarge button reopens on the chart you pressed. After switching an enlarged view to the other chart and closing it, that button kept reopening on the other one, and deleting the last pool roll while it was set that way left the enlarged view empty with no way back.
- Escape in a Target or Pool target box discards what you typed instead of adding it. Pressing Escape cleared the box and then added the number anyway.
- The divider between the table and the chart follows the pointer. Below about 1645px wide the chart's minimum width meant the table could not actually reach the width the divider claimed, so dragging did nothing until the pointer had travelled back past the gap, and the control reported a width the page was not using. It now measures the space it really has, and the arrow keys work from the same measurement.
- Dragging the divider no longer redraws the charts on every pointer movement.
- A drag of the divider that gets interrupted, by a phone gesture or the system taking over the pointer, no longer leaves it armed, where simply moving the mouse across it would resize the table.
- The buttons at the end of each roll no longer paint over the column headings when the rolls scroll under them.
- The page heading no longer shifts when the app loads on a desktop screen. The pre-load frame was drawn with the old page margins and the wrong text sizes, so the heading and the line under it jumped as the app took over.
- A pinned roll keeps its blue edge on a phone or tablet. A pool or check card painted its own band over the top, so pinning one showed no sign of being pinned, and the same band meant something different on a card than it did in the table.
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

[Unreleased]: https://github.com/a1clark1a/diceTable/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/a1clark1a/diceTable/releases/tag/v2.1.0
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
