#!/usr/bin/env bash
# 관리자 서버(별도 Vercel 프로젝트 vibrax-admin) 배포 — 같은 코드베이스, NEXT_PUBLIC_APP_MODE=admin
# 사용: scripts/deploy-admin.sh   (회원 서버는 기존처럼 vercel --prod --yes)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WT="/tmp/vibrax-admin-deploy"
if [ ! -d "$WT/.git" ] && [ ! -f "$WT/.git" ]; then git -C "$ROOT" worktree add "$WT" master >/dev/null 2>&1 || git -C "$ROOT" worktree add -f "$WT" master; fi
git -C "$WT" checkout -q master && git -C "$WT" pull -q --ff-only origin master 2>/dev/null || git -C "$WT" reset -q --hard origin/master
mkdir -p "$WT/.vercel"
cat > "$WT/.vercel/project.json" <<JSON
{"projectId":"${ADMIN_PROJECT_ID:?set ADMIN_PROJECT_ID}","orgId":"team_287tajKRlpcuho4MweU5Q7Gw","projectName":"vibrax-admin"}
JSON
cd "$WT" && vercel --prod --yes
