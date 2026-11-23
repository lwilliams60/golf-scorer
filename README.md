# Golf Scorer

Scores, stats and side games for golf groups of 2 to 32. Installable web app (add to home screen on iPhone or Android).

- Formats: Stroke play, Stableford, Match play, Better ball, Skins, Nassau, Texas scramble, Six Point, Wolf, Snake
- WHS handicaps (course handicap from slope and rating, allowances per format)
- One scorer per group or everyone scores themselves; personal stats entered by each player
- Live sync between phones via Supabase; works offline and catches up when signal returns
- Money games with a settle-up screen

## Run locally

    npm install
    npm run dev      # app
    npm test         # scoring engine tests

Without Supabase settings the app runs in test mode (rounds saved on one device only).

## Live sync

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`) in Vercel or `.env.local`.
