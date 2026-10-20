# Shared leaderboard setup

The app uses Supabase Auth for email magic links, a public read-only leaderboard, and a server-side game function that checks answers and records scores. This prevents the browser from directly submitting arbitrary score values, but a public quiz cannot be made completely cheat-proof. Old browser-only accounts and scores are not migrated.

## 1. Create the Supabase project

The Supabase project `jyeukrrfhesgjqilymwm` is connected in `supabase-config.js`. Its project URL and publishable key are browser-safe. Never put the `service_role` key in a website file or share it publicly.

## 2. Create the database tables and policies

The contents of `supabase-setup.sql` have been applied in the project SQL Editor. The public leaderboard query (including the player-name join) was verified against the live project. The policies allow public reads of leaderboard names and scores, but only the game function can write scores. Each user can update only their own public display name.

## 3. Deploy the game function

The `riddle-game` Edge Function has been deployed from the Supabase dashboard. For future code updates, install the Supabase CLI, log in, link the project, then deploy from the project folder:

```text
supabase login
supabase link --project-ref jyeukrrfhesgjqilymwm
supabase functions deploy riddle-game
```

The repository includes `supabase/config.toml`. JWT verification at the Edge gateway is disabled because the function validates each bearer token itself using Supabase Auth; keep the handler's authentication check in place.

The function uses Supabase's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server-side secrets. Do not add the service-role key to `supabase-config.js`.

## 4. Configure email sign-in and site URLs

Email sign-in and new-user registration are enabled. Email confirmation is on. **Authentication → URL Configuration** uses `https://teddyedwin.github.io/just-ask-riddle-game/` as the Site URL and allows both that Pages path (`https://teddyedwin.github.io/just-ask-riddle-game/**`) and `http://localhost:3000/**` for local testing. Public signups require a custom SMTP provider for reliable email delivery; configure one under **Project Settings → Auth → SMTP Settings** before inviting general users.

## 5. Publish and test

The site is published at [https://teddyedwin.github.io/just-ask-riddle-game/](https://teddyedwin.github.io/just-ask-riddle-game/). The database's public score read endpoint was verified, and the deployed game function correctly rejects requests without a signed-in user. Configure custom SMTP before inviting general users. Then test opening a magic link, completing a game, changing a display name, and viewing the leaderboard in a separate browser. Only scores inserted by the deployed game function are visible; old local scores remain in the browser and are not shared.
