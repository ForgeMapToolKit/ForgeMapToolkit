# ForgeMapToolkit — Documentation

Seven documents. Each one owns a question; nothing is documented in two places without one
of the two being declared the winner.

**If you write documentation and it doesn't fit any of these seven, that is a signal.**
Either it belongs inside one of them, or it is a plan — and plans do not live here (see
*What does not belong in `docs/`* below).

The repo root also carries `CLAUDE.md` — a short orientation file for agents that points
back here. It holds no rules of its own; if the two disagree, these documents win.

---

## Which document answers which question

| I want to… | Read |
|---|---|
| build a new tab, or migrate one | **[TAB_CONTRACT.md](TAB_CONTRACT.md)** → then **[TAB_UI_CONTRACT.md](TAB_UI_CONTRACT.md)** |
| know which layout shell a section should use, or what `TabLayout` accepts | **[LAYOUTS.md](LAYOUTS.md)** |
| know whether a visual decision is allowed | **[TAB_UI_CONTRACT.md](TAB_UI_CONTRACT.md)** |
| decide something the rules don't cover yet | **[UI_PHILOSOPHY.md](UI_PHILOSOPHY.md)** |
| add or change an IPC channel | **[IPC.md](IPC.md)** + `TAB_CONTRACT.md §8` |
| find where a file lives, or what is dead code | **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** |
| understand why the stack is Electron + React + Vite | **[TECH_DECISIONS.md](TECH_DECISIONS.md)** |

---

## The six documents

### [TAB_CONTRACT.md](TAB_CONTRACT.md) *(German)*
**The non-visual half of building a tab.** File and folder structure, the parent
skeleton, state and persistence (`usePersistentState`, per-tab key prefix), section
components and props bundles, the shared building blocks in `Shared/MapLogic` and
`Shared/Ui`, file generation and IPC, the help system, the IPC security contract, and a
definition of done.

### [TAB_UI_CONTRACT.md](TAB_UI_CONTRACT.md)
**The visual half — the binding rules.** Loudness levels, the staircase, blocks, the line
law, the trace principle, progressive disclosure, the three color roles, responsive
space, the siderail, and the graph-canvas carve-out. Enforced mechanically by
`npm run lint:design`; the document carries the current per-tab compliance numbers.

> These two are a **pair**. Together they are the complete contract for a tab. Formerly
> `TAB_DESIGN_LAW.md`, renamed 2026-07-26 so the pairing is visible in the filename.

### [UI_PHILOSOPHY.md](UI_PHILOSOPHY.md)
**Why the rules are what they are.** The constitution above the two contracts. Consult it
when you hit a case the contract doesn't cover — a niche, an edge case, a new surface —
and you still need the result to look like the rest of the app. New rules are derived
here first, then written into TAB_UI_CONTRACT.

> **Where philosophy and TAB_UI_CONTRACT disagree, TAB_UI_CONTRACT wins.** Philosophy
> explains; the contract binds.

### [LAYOUTS.md](LAYOUTS.md)
**The four layout shells (X / Y / Z / W)** every tab section uses, with ASCII diagrams,
real column widths, the complete `TabLayout` prop list with actual defaults, and a table
of which tab runs on what today.

### [IPC.md](IPC.md)
**The renderer↔main boundary.** The three gates a call must pass (preload allowlist,
handler registration, path guard), every channel grouped by owning module, the push-event
channels, and a measured defect list — including two live channels the preload silently
blocks. `TAB_CONTRACT.md §8` states the rules for a *new* channel; this document describes
what exists.

### [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
**Where everything lives.** A tree generated from `git ls-files`, which tabs are actually
routed, which code is dead, and the known directory-case inconsistency. A snapshot — when
it disagrees with the repo, the repo is right and this file needs updating.

### [TECH_DECISIONS.md](TECH_DECISIONS.md)
**Why Electron + React + Vite**, what the app actually does per tab, the full IPC surface
by area, the alternatives that were considered and rejected, and the dependency-by-
dependency rationale.

---

## How they relate

```
                    UI_PHILOSOPHY.md
                    why the rules exist
                            │
                            ▼
        TAB_CONTRACT.md ◄──────► TAB_UI_CONTRACT.md
        how a tab is built       how a tab may look
        (structure, state,       (loudness, lines, color,
         IPC, DoD)                space, disclosure)
                            │
                            ▼
                       LAYOUTS.md
                  which shell a section uses

   PROJECT_STRUCTURE.md      IPC.md            TECH_DECISIONS.md
   where things are          the main-process  why the stack is
                             boundary          the stack
```

Everything visual ultimately resolves to one token source:
`src/components/shared/DesignSystem/tokens.css`.

---

## What does not belong in `docs/`

**No plans, no roadmaps, no migration trackers.** Those were deleted 2026-07-26 because
they rot fastest and are the reason this folder needed cleaning. Status belongs in git,
in issues, or in the code — not in a Markdown file that quietly goes stale.

The test: *will this still be true in six months, or does it describe a state we are
trying to leave?* Only the first kind belongs here.

⚠️ One caveat from that deletion: some of those plan documents also contained
**derivations** — why the terraintype logic is correct, how the node-graph document model
works. Around 15 source files still cite `NODE_EDITOR_PLAN.md` and `TERRAINTYPE_PLAN.md`
in code comments. That reasoning is worth recovering from git history into a permanent
document; the dangling citations are not yet resolved.

---

## Conventions

- Filenames are `SCREAMING_SNAKE_CASE.md`. Only this index is `README.md`.
- Every document states at the top when it was last verified against the code, and
  against what.
- Documents that carry rules (TAB_CONTRACT, TAB_UI_CONTRACT, UI_PHILOSOPHY) keep a
  changelog at the bottom. A rule change without a changelog entry is a bug.
- Concrete claims — paths, prop defaults, counts — must be readable back out of the repo.
  If you can't verify it, don't write it as fact.
