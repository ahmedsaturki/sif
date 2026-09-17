# Repository Governance

## Canonical branch

The verified cumulative SIF line is:

`feat/sif-core-1.0.0-knowledge-semantic`

`main` is intentionally preserved at the Genesis baseline and is not the publication or promotion branch.

## Required merge controls

GitHub repository settings SHOULD enforce these controls on the canonical branch:

- pull request required before merge
- required status check: `SIF Core CI / verify-core`
- branch must be up to date before merge
- at least one approving review
- conversation resolution before merge
- force-push disabled
- branch deletion disabled
- bypass disabled unless an explicitly documented emergency procedure exists

These controls are repository-level settings; files in this repository cannot activate them.

## Local guardrails in this tree

- `CODEOWNERS` records ownership for review routing.
- SIF Core CI runs for pull requests targeting the canonical branch.
- SIF Core CI has explicit read-only workflow permissions.
- CI runs on the pinned `ubuntu-24.04` label and has a finite 15-minute job timeout.
- Build tooling is pinned through `package.json`, `package-lock.json`, and the CI Node/npm toolchain.
- The CI verifies exact candidate checkout identity before testing.

## Enforcement status

The connected GitHub administration surface currently reports no active GitHub Rulesets; the branch-protection endpoint is not readable through the connected integration, so protected-branch status is not asserted here. This document therefore describes the intended enforcement contract and does not claim that GitHub has already activated those settings.
