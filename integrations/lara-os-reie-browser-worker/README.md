# REIE Browser Worker 1.0.0

This is an optional browser-as-worker adapter above the REIE Local Core. It uses Playwright only at the worker boundary; the REIE core remains dependency-free.

The current implementation is collection-oriented:
- persistent browser profile directory for human-maintained sessions
- HTTP(S)-only navigation
- optional hostname allowlist
- visible-page text capture and basic publisher metadata
- full-page screenshot capture
- no credential injection
- no automatic login
- no form submission
- no outreach or external side effects

The worker uses Playwright 1.63.0. Playwright browser binaries are installed separately, so environments that need Chromium must run the corresponding Playwright browser install step.
