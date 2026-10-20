# Shared guest leaderboard setup

The app lets anyone play with a guest display name. Supabase stores game sessions and scores, and the Edge Function checks answers and writes completed scores. The browser cannot submit score values directly, but without accounts, names are unverified and people can replay, impersonate names, or abuse the public game service. Do not use this leaderboard for prizes or other high-stakes decisions.

## Supabase project

The Supabase project `jyeukrrfhesgjqilymwm` is configured in `supabase-config.js`. The project URL and publishable key are safe to include in the public site. Never put the `service_role` key in a website file or share it publicly.

## Apply the database setup

Run the current `supabase-setup.sql` in the Supabase SQL Editor. It migrates the existing authenticated schema, preserves old scores by copying their display names, and allows new scores and sessions to use guest names. It can be run again safely.

The `scores` table is publicly readable but only the server-side game function can insert scores. Game session rows are not directly accessible to website visitors.

## Deploy the game function

Deploy the updated `supabase/functions/riddle-game/index.ts` as the `riddle-game` Edge Function. The function uses the Supabase `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server-side secrets. Do not place the service-role key in the site.

JWT verification at the Edge gateway must remain disabled for this function (`verify_jwt = false` in `supabase/config.toml`), because guest players do not sign in. The function still validates each request, validates display names, stores answers server-side, and records a score only after all answers are correct. Keep the one-second answer pacing and two-hour session expiry.

For command-line deployment, install the Supabase CLI, log in, link the project, then deploy from the project folder:

```text
supabase login
supabase link --project-ref jyeukrrfhesgjqilymwm
supabase functions deploy riddle-game
```

## Publish and test

The site is published at [https://teddyedwin.github.io/just-ask-riddle-game/](https://teddyedwin.github.io/just-ask-riddle-game/). Publish the updated site files and function, then test starting a guest game, completing all answers, and checking that the score appears on the shared [leaderboard](https://teddyedwin.github.io/just-ask-riddle-game/leaderboard.html). Previous authenticated scores remain visible with their existing profile names.
