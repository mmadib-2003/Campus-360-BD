#!/usr/bin/env bash
set -euo pipefail

echo "=================================================================="
echo " Campus360 BD — Multi-University Super-App Quickstart"
echo "=================================================================="

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Installing pnpm via corepack..."
  corepack enable && corepack prepare pnpm@9.12.0 --activate
fi

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example"
fi

if [ ! -f apps/web/.env.local ]; then
  cp .env.example apps/web/.env.local
  echo "Created apps/web/.env.local"
fi

if [ ! -f apps/mobile/.env ]; then
  cp .env.example apps/mobile/.env
  echo "Created apps/mobile/.env"
fi

echo "Installing monorepo dependencies..."
pnpm install

if command -v supabase >/dev/null 2>&1; then
  echo "Starting local Supabase stack and applying migrations + 50+ BD university seeds..."
  supabase start
  supabase db reset
else
  echo "Note: Supabase CLI not detected locally. Install via https://supabase.com/docs/guides/cli to run local Postgres + RLS."
fi

echo "Running unit tests..."
pnpm test

echo "Starting Campus360 BD Web & Mobile dev servers..."
pnpm dev:web
