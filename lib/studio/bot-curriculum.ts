// 봇 기본기 커리큘럼 — 템플릿(게임 종류)이 미리 보유한 "정석 플레이 지식".
// 각 회원의 AJ 는 판을 거듭하며 이 단계를 하나씩 학습(힌트를 그 게임의 state 키에 맞는 규칙으로 컴파일)한다.
// 커리큘럼을 다 배우면 그 이상은 자기 반성 + 사용자의 프롬프트 코칭으로만 성장 — 그 부분은 해당 유저만 보유(aj_play_policies 는 user_id 별, RLS own).
export interface BotSkill { name: string; hint: string }

const TEMPLATE_CURRICULUM: Record<string, BotSkill[]> = {
  tetris: [
    { name: '바닥부터 평평하게', hint: '블록을 한쪽(왼쪽)부터 차곡차곡 쌓아 바닥을 평평하게 유지해. 높이 차이가 2 이상 나는 곳을 먼저 메워.' },
    { name: '구멍 만들지 않기', hint: '블록 아래에 빈 칸(구멍)이 생기는 위치에는 절대 놓지 마. 구멍이 생길 자리면 다른 열을 골라.' },
    { name: '회전으로 모양 맞추기', hint: '떨어지는 블록을 회전시켜 지형에 딱 맞는 방향을 찾은 뒤에 이동해. 맞는 방향이 없으면 가장 평평해지는 방향.' },
    { name: '한 줄씩 꾸준히 지우기', hint: '욕심내지 말고 완성 가능한 줄부터 지워. 줄을 지울 수 있는 위치가 보이면 최우선으로 채워.' },
    { name: '우물 파고 테트리스 노리기', hint: '한쪽 끝 열 하나만 비워두고(우물) 나머지를 평평하게 쌓다가 I 블록이 오면 우물에 넣어 여러 줄을 한 번에 지워.' },
    { name: '높이 위험 관리', hint: '쌓인 높이가 화면의 60%를 넘으면 테트리스 욕심을 버리고 무조건 줄 지우기에 집중해 높이를 낮춰.' },
  ],
  breakout: [
    { name: '공 따라가기', hint: '공의 x 좌표를 따라 패들을 움직여 공 밑에 항상 패들이 있게 해.' },
    { name: '낙하점 예측', hint: '공이 내려올 때 속도 방향을 보고 떨어질 지점을 예측해 미리 이동해. 벽 반사도 계산해.' },
    { name: '패들 가장자리 활용', hint: '패들의 가운데가 아니라 가장자리로 맞혀 공 각도를 조절해 — 안 깨진 벽돌 쪽으로 공을 보내.' },
    { name: '옆 통로 뚫기', hint: '한쪽 끝 벽돌을 먼저 뚫어 공을 벽돌 위 공간으로 올려보내면 알아서 여러 개를 깨준다.' },
  ],
  runner: [
    { name: '장애물 앞 점프', hint: '장애물이 가까워지면(거리 기준) 점프해. 너무 일찍 뛰지 말고 부딪히기 직전에.' },
    { name: '연속 장애물 대응', hint: '장애물이 연달아 오면 착지하자마자 바로 다음 점프를 준비해. 공중에서는 조작이 안 되는 걸 기억해.' },
    { name: '아이템·코인 동선', hint: '안전할 때만 코인/아이템 쪽으로 이동하고, 장애물 회피가 항상 우선이야.' },
  ],
  flappy: [
    { name: '일정한 리듬 유지', hint: '한 번에 여러 번 누르지 말고 일정한 간격으로 눌러 고도를 유지해.' },
    { name: '틈 중앙 조준', hint: '다음 파이프 틈의 중앙 높이에 맞춰 미리 고도를 조절해 — 틈보다 높으면 안 누르고, 낮으면 눌러.' },
    { name: '급강하 금지', hint: '오래 안 누르면 급강하해서 회복이 어려워. 목표보다 조금 아래에서 자주 미세 조정해.' },
  ],
  snake: [
    { name: '벽·몸통 회피', hint: '진행 방향 바로 앞이 벽이나 내 몸이면 즉시 안전한 방향으로 꺾어.' },
    { name: '먹이 최단 경로', hint: '안전하다면 먹이까지 가로/세로 축을 하나씩 맞춰 접근해.' },
    { name: '외곽 순환 패턴', hint: '몸이 길어지면 화면 가장자리를 따라 크게 도는 패턴으로 움직여 자기 몸에 갇히지 않게 해.' },
    { name: '꼬리 공간 계산', hint: '먹이를 먹으러 들어가기 전에 나올 길이 있는지 확인해 — 없으면 꼬리가 지나갈 때까지 돌아.' },
  ],
  pong: [
    { name: '공 y 좌표 추적', hint: '공의 y 좌표를 따라 패들을 움직여.' },
    { name: '반사 각도 예측', hint: '공이 내 쪽으로 올 때 벽 반사를 계산해 도착 지점에 미리 가 있어.' },
    { name: '가장자리 타격', hint: '패들 가장자리로 맞혀 각도를 크게 만들어 상대가 받기 어렵게 해.' },
  ],
  shooter: [
    { name: '적 조준 사격', hint: '가장 가까운 적의 x 좌표에 맞춰 이동하며 계속 사격해.' },
    { name: '탄막 회피 우선', hint: '적 탄환이 내 근처로 오면 사격보다 회피를 우선해 — 탄이 없는 쪽으로 이동.' },
    { name: '가장 위험한 적부터', hint: '나와 가까운(아래쪽) 적, 그리고 내 열에 있는 적을 먼저 처치해.' },
  ],
}
// 장르 폴백 — 템플릿을 모를 때
const GENRE_CURRICULUM: Record<string, BotSkill[]> = {
  action: TEMPLATE_CURRICULUM.breakout,
  sports: TEMPLATE_CURRICULUM.pong,
  adventure: TEMPLATE_CURRICULUM.runner,
  strategy: TEMPLATE_CURRICULUM.tetris,
}
// 관리자 추가 커리큘럼(DB) — 내장 뒤에 이어붙는다. 60초 캐시.
let dbCache: { at: number; v: Record<string, BotSkill[]> } | null = null
export function invalidateCurriculum() { dbCache = null }
async function loadDbCurriculum(): Promise<Record<string, BotSkill[]>> {
  if (dbCache && Date.now() - dbCache.at < 60_000) return dbCache.v
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { data } = await createAdminClient().from('aj_bot_curriculum').select('template_key,step_order,name,hint,enabled').eq('enabled', true).order('step_order').limit(500)
    const v: Record<string, BotSkill[]> = {}
    for (const r of (data ?? []) as { template_key: string; name: string; hint: string }[]) (v[r.template_key] ??= []).push({ name: r.name, hint: r.hint })
    dbCache = { at: Date.now(), v }; return v
  } catch { return {} }
}
/** 내장 + 관리자 추가분 합쳐서 반환 (관리자 단계는 내장 뒤에 이어짐 = 심화 과정) */
export async function curriculumForAsync(templateSlug: string | null | undefined, genre: string | null | undefined, gameId?: string | null): Promise<{ key: string; skills: BotSkill[] } | null> {
  const db = await loadDbCurriculum()
  const base = curriculumFor(templateSlug, genre)
  const key = base?.key ?? (templateSlug && db[templateSlug] ? templateSlug : genre && db[`genre:${genre}`] ? `genre:${genre}` : null)
  const creator = gameId ? db[`game:${gameId}`] ?? [] : []   // 제작자가 등록한 이 게임 전용 가이드 — 다른 유저의 AJ 도 이 단계를 배운다
  const skills = [...(key ? base?.skills ?? [] : []), ...(key ? db[key] ?? [] : []), ...creator]
  if (!skills.length) return null
  return { key: key ?? `game:${gameId}`, skills }
}
export const BUILTIN_CURRICULUM = TEMPLATE_CURRICULUM
export function curriculumFor(templateSlug: string | null | undefined, genre: string | null | undefined): { key: string; skills: BotSkill[] } | null {
  if (templateSlug) { const k = Object.keys(TEMPLATE_CURRICULUM).find(k2 => templateSlug.includes(k2)); if (k) return { key: k, skills: TEMPLATE_CURRICULUM[k] } }
  if (genre && GENRE_CURRICULUM[genre]) return { key: `genre:${genre}`, skills: GENRE_CURRICULUM[genre] }
  return null
}
