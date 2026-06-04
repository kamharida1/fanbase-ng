#!/usr/bin/env bash
# Marks PrivyChat-era migration versions (00001–00037) as reverted so Fanbase
# migrations can be applied with `supabase db push`.
# See docs/supabase-migration-fix.md

set -euo pipefail
cd "$(dirname "$0")/.."

echo "Repairing remote migration history (00001–00037)..."
supabase migration repair --status reverted \
  00001 00002 00003 00004 00005 00006 00007 00008 00009 00010 \
  00011 00012 00013 00014 00015 00016 00017 00018 00019 00020 \
  00021 00022 00023 00024 00025 00026 00027 00028 00029 00030 \
  00031 00032 00033 00034 00035 00036 00037

echo "Pushing Fanbase NG migrations..."
supabase db push

echo "Done. Run backfill if needed: supabase/scripts/backfill-profiles.sql in SQL Editor."
