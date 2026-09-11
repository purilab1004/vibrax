#!/usr/bin/env python3
"""lib/studio/templates/*.json 을 스캔해 lib/studio/templates.ts 의 import 목록과 TEMPLATES 배열을 다시 쓴다.
기존 9종의 순서를 유지하고, 새 템플릿은 slug 순으로 뒤에 붙인다."""
import glob, json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TDIR = os.path.join(ROOT, 'lib/studio/templates')
TS = os.path.join(ROOT, 'lib/studio/templates.ts')
FIRST = ['tetris', 'breakout', 'snake', 'flappy', 'runner', 'runner-double', 'shooter', 'pong', 'stock']
slugs = sorted(os.path.basename(f)[:-5] for f in glob.glob(os.path.join(TDIR, '*.json')))
ordered = [s for s in FIRST if s in slugs] + [s for s in slugs if s not in FIRST]
ident = lambda s: re.sub(r'-([a-z0-9])', lambda m: m.group(1).upper(), s)
imports = '\n'.join(f"import {ident(s)} from './templates/{s}.json'" for s in ordered)
arr = ', '.join(ident(s) for s in ordered)
src = open(TS).read()
src = re.sub(r"(import tetris from './templates/tetris\.json'\n)(?:import \w+ from './templates/[\w-]+\.json'\n)*", imports + '\n', src, count=1)
src = re.sub(r"export const TEMPLATES: GameTemplate\[\] = \[[^\]]*\] as GameTemplate\[\]", f"export const TEMPLATES: GameTemplate[] = [{arr}] as GameTemplate[]", src, count=1)
open(TS, 'w').write(src)
# 간단 검증: 각 json 필수 필드
for s in ordered:
    d = json.load(open(os.path.join(TDIR, s + '.json')))
    assert all(k in d for k in ('slug', 'name', 'keywords', 'prompt', 'description', 'html')), s
print(f'registered {len(ordered)} templates: {", ".join(ordered)}')
