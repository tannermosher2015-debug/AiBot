# real-estate-lead-bot - repo rules

**Retrofitted by `/init-client --retrofit` on 2026-08-21 from what was on disk.** Every line below
is either DETECTED or explicitly UNKNOWN. Nothing here was inferred and then stated as fact. Correct
it the first time you work in this repo.

## Stack
Node project. See `package.json`.

## Deploy target
**Netlify** (`netlify.toml` present on disk).

## Does a push publish?
**NO.** This repo has no deploy webhook and no deploying GitHub Action, so nothing is
listening for a push. Deploys are manual (Hostinger MCP upload, or a Netlify CLI/drop).

Settled 2026-08-21 by `gh api repos/<owner>/<repo>/hooks` across all 48 retrofitted repos,
plus a check for a deploying GitHub Action. Control: `publicsafetyfactshawaii`, which is
documented as auto-deploying, returned the Netlify hook, so the test detects git-linkage
rather than silently returning empty.

## Remote
`git@github.com:tannermosher2015-debug/AiBot.git`, branch `main`.

## Verify path
Build first, then `shot.ps1` desktop + mobile against the deployed URL, both reviewed.

## Landmines
<Empty. Add each one the day it bites, with the date.>
