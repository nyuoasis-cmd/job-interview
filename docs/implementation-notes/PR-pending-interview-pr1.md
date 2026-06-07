# PR-pending-interview-pr1

## Decisions

- Tailwind v4 is configured through the Vite plugin and CSS-first `@import "tailwindcss"` only. No `tailwind.config.ts` is created because the handoff marks that as an absolute rule.
- The server exposes only the Supabase project ref through `/api/config`; keys remain server/client environment variables only.
- Anonymous student ownership uses a 64-character hex `joinToken` stored in localStorage under `interview_join_token_{participantId}`.

## Changes

- Added workspace package scripts for client and server builds.
- Added Supabase PR1 migration for `interview_sessions` and `interview_participants`, including RLS enablement and required indexes.
- Added Express 5 server routes for config, industries, sessions, participants, and boot guards.
- Added React 19 client routes for landing, join, industry selection, teacher session creation, demo stub, development login, and auth callback.

## Tradeoffs

- Runtime interview taxonomy and guard source data are loaded from `AI_INTERVIEW_DATA_DIR`, defaulting to the shared dataset path used by the blueprint. This keeps PR1 aligned with the approved data source without introducing PR2 interview-attempt storage.
- The industry confirmation route performs the contract checks in the required order, then protects the final update with participant id, join token, and unconfirmed filters.

## Notes

- Gemini, real STT, interview attempts, evaluation reports, and teacher dashboard class status remain out of scope for PR1.
- `VITE_FEATURE_STT` is present on the client side only and defaults to disabled behavior.
