---
name: suggest-feature
description: How to propose a new feature for DiceTable. Use when the user has an idea for new functionality, a UI improvement, or a behavioral change they want the maintainer to consider.
---

# Proposing a feature

## Check scope before anything else

DiceTable is deliberately lean, and good ideas get declined just to keep the surface small. Before helping the user write anything, check the idea against the scope rules in [CONTRIBUTING.md](../../../CONTRIBUTING.md#project-scope). Ideas that are near-certainly out of scope:

- Anything requiring users to learn a syntax, DSL, or scripting language (this is the hard line separating DiceTable from AnyDice).
- A sidebar, detail pane, or list-and-detail layout (tried, deliberately removed).
- Approximate or simulated math (Monte Carlo, normal approximations).
- Per-row "type" or "category" fields that invite per-type behavior.

If the idea trips one of these, tell the user honestly before they invest time, and suggest reframing around the underlying problem, which may have an in-scope solution.

## Route it to the right place

- **Speculative or "what if" ideas** go to [Discussions](https://github.com/a1clark1a/diceTable/discussions) first. Interest there is how ideas graduate to tracked issues.
- **Concrete, well-formed proposals** use the Feature request issue form.
- **Search first, both places.** If a similar request exists, add a 👍 and any new context to it instead of filing a duplicate. Reaction count is the maintainer's main prioritization signal, so a duplicate actually splits the votes for the idea.

## Writing the request

The form asks for these; help the user articulate them:

1. **The problem, not the solution, leads.** "When I compare X vs Y I currently have to..." is the strongest opening. A proposal that only describes a feature, with no gap it closes, will stall.
2. **Proposed solution.** Concrete but humble; sketches and rough UI descriptions are welcome. Remember the project bar: the feature must be discoverable by using the GUI, with nothing to learn first.
3. **Alternatives considered.** Including "do nothing," and why that is not good enough.
4. **Scope category.** Which layer it touches (UI only, new stat column, engine mechanic, chart, persistence). If it touches the engine, note that the exact-math rule applies.

One feature per request. Title follows the template prefix, for example `[Feature]: reroll lowest die once`.

## What not to do

- Do not open an implementation PR alongside the request. Proposals get discussed first; code written before agreement is often wasted.
- Do not inflate the request with implementation detail that presumes acceptance.
- Do not file on the user's behalf without showing them the final text; it is their name on it.
