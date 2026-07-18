---
name: create-pr
description: How to open a pull request for DiceTable. Use when the change is finished and verified and the user wants it submitted for review. This is also where AI adds the most value for beginners: turning a finished change into a clear, well-summarized PR.
---

# Opening a pull request

## Preconditions

- The change followed the `safe-change` playbook: it is one logical change, `npm run verify` passes, tests and CHANGELOG are handled.
- The human contributor understands the diff well enough to explain every line. If they cannot, walk them through it before opening anything; they will be the one answering review comments.
- Non-trivial changes have a linked issue. No issue and not trivial: stop, that is the `create-issue` or `suggest-feature` playbook.

## Branch and target

- The branch is off `develop`, and the PR base is `develop` (the default, so usually pre-selected). Never target `main`; releases are the maintainer's job (see [branching.md](../../../docs/architecture/branching.md)).
- Push the branch, then open with `gh pr create --base develop` or the web UI.

## Writing the PR

The repository has a PR template; fill it honestly.

- **Summary:** one or two sentences on what changes and why, in plain language. Link the issue with `Closes #123`. This is the place to spend effort: a reviewer who understands the change in ten seconds reviews it the same day. Summarize what the diff does, not the journey of writing it.
- **Checklist:** tick items only if they are actually true. Ticking "added tests" without tests wastes a review round trip.
- Commits are signed off (`git commit -s`).
- Keep the title imperative and concrete, for example `fix: clamp explode depth in reroll parser`, not `Various fixes`.

If the diff turned out larger than one logical change, do not open it as-is. Split it into stacked or sequential PRs; smaller PRs merge faster here.

## During review

- Summarizing long review threads and drafting responses is a great use of AI; rewriting the branch wholesale in response to one comment is not. Prefer small follow-up commits so the reviewer can see what changed since their last pass.
- Answer every review comment, even if just "done."
- Do not force-push over a reviewed branch unless the maintainer asks; it destroys the review context.

## After merge

The PR merges into `develop`, and staging redeploys automatically. Releases to `main` and version bumps are the maintainer's; nothing more to do.
