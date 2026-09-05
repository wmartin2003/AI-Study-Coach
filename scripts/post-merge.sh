#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Database schema changes now live as plain SQL files in supabase/migrations/
# and are applied directly against Supabase (see README.md) rather than
# through a local Drizzle "db" package — there is no push step to run here.
