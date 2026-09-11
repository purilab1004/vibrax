// 장르별 정적 템플릿 일괄 생성기 — Sonnet 1회 생성 → 계약 검사 → 헤드리스 실행 검증 → lib/studio/templates/<slug>.json 저장
// 실행: node --disable-warning=ExperimentalWarning --import ./scripts/ts-resolve.mjs scripts/gen-genre-templates.ts [slug ...]  (FORCE=1 덮어쓰기, USE_MAX=1 이면 API 크레딧 대신 `claude -p`(Max 구독)로 생성)
import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { SYSTEM_PROMPT, buildMessages } from '../lib/studio/prompt'
import { parseGeneration, extractTitle } from '../lib/studio/parse'
import { hardenHtml } from '../lib/studio/harden'
import { chromium } from 'file:///Users/sungjunahn/gstack/node_modules/playwright/index.mjs'

const ROOT = '/Users/sungjunahn/Documents/vibrax'
const OUT = path.join(ROOT, 'lib/studio/templates')
const S = '/private/tmp/claude-501/-Users-sungjunahn-Documents-vibrax/bab984fc-b638-45e0-acc0-b10b188fdccf/scratchpad'
const UAS = new Set(['left', 'right', 'up', 'down', 'jump', 'fire', 'guard', 'aimX', 'aimY', 'useItem', 'item1', 'item2', 'item3', 'item4', 'action', 'crouch', 'action2'])
const SPEC = `\n\n[템플릿 기본 사양] 꾸밈 요소 없이 핵심 규칙만 — 시작 화면, 조작(키보드+터치), 점수, 게임오버·재시작, 명확한 클리어 조건. 단색 배경, 단순 도형·이모지 위주, 특정 브랜드/상표 이름·로고·실존 게임명 금지(제목은 일반 명사로). 나중에 회원이 수정 요청으로 살을 붙일 수 있게 깔끔하고 짧게. 반드시 window.vibrexBot(start/stop/setSkill) 을 구현해 오토파일럿이 스스로 플레이해 점수를 내게 하고, state() 에는 표준 관찰 슬롯을 최대한 채운다. 한 판은 1~3분 안에 끝나야 한다. window.AJ 는 플랫폼이 주입하므로 절대 재정의하지 말고 if(window.AJ) 가드로만 호출한다(AJ.start() 게임 시작 시, AJ.score(n) 점수 변할 때, AJ.over(n)/AJ.clear(n)). VIBREX_GAME.start() 는 타이틀 화면에서 실제로 게임을 시작시켜야 하고 vibrexBot.start() 만으로도 플레이가 진행되어야 한다. **분량 제한: 전체 HTML 은 18KB(약 5,500 토큰) 이내.** 주석·빈 줄·긴 변수명 없이 압축해서 쓰고, 그래픽은 사각형·원·이모지로만, 기능은 위에 적힌 핵심만 구현한다. 설명문은 2문장.`

type Spec = { slug: string; name: string; keywords: string[]; prompt: string; genreGroup?: string }
const SPECS: Spec[] = [
  // 1. RPG
  { slug: 'rpg-action', name: '미니 액션 RPG', keywords: ['RPG', '알피지', '롤플레잉', '역할수행', 'ARPG', '액션 RPG', '액션알피지', '핵앤슬래시', 'MMORPG', '엠엠오', '던전 사냥', '몬스터 사냥', '레벨업 게임', '디아블로', '엘든링', '로스트아크', '메이플', '메이플스토리', 'K-RPG'],
    prompt: '탑다운 미니 액션 RPG. 사각 던전 방 3개를 차례로 돌며 몬스터를 잡아 경험치·레벨업·체력 회복 포션을 얻고, 3번째 방의 보스를 쓰러뜨리면 클리어. 조작: left/right/up/down 이동, fire 근접 공격(앞 방향 부채꼴), useItem 포션. 레벨업마다 공격력·최대체력 증가. state(): selfX, selfY, targetDX/DY/Dist(가장 가까운 몬스터), dangerDX/DY/Dist, health(0~1), lives, score, progress, itemCount. vibrexBot: 가장 가까운 몬스터에게 접근해 공격, 체력 30% 이하면 포션.' },
  { slug: 'rpg-turn', name: '턴제 RPG 전투', keywords: ['턴제 RPG', '턴제', 'JRPG', '제이알피지', '커맨드 배틀', '턴제 전투', '페르소나', '스타레일', '붕괴', '드래곤퀘스트', '파이널판타지', '턴 기반', '순서대로 전투'],
    prompt: '턴제 RPG 전투 게임. 아군 1명(HP/MP)과 적 5마리를 순서대로 상대하고 마지막은 보스. 매 턴 커맨드를 고른다: fire=공격, guard=방어(다음 피해 절반+MP 회복), useItem=마법(MP 소모, 큰 피해), jump=회복 포션(3개). 적은 자기 턴에 공격/강공격 패턴을 예고(아이콘)한다. 적을 모두 쓰러뜨리면 클리어, HP 0이면 게임오버. 점수=남은 HP·턴 효율. state(): health(0~1), mp(0~1), enemyHp(0~1), enemyIntent(0 공격/1 강공격/2 대기), itemCount, progress, score, turn. vibrexBot: 강공격 예고면 guard, MP 충분하면 마법, HP 낮으면 포션, 아니면 공격.' },
  { slug: 'rpg-idle', name: '방치형 RPG', keywords: ['방치형', '방치형 RPG', 'AFK', '방치', '자동 사냥', '자동사냥', '키우기', '클리커', '클릭커', '탭 게임', '방치형 게임', '오프라인 성장', '노가다'],
    prompt: '방치형 RPG. 화면 중앙에서 영웅이 자동으로 몬스터를 공격해 골드를 모으고, 골드로 공격력·공격속도·자동 골드 업그레이드를 산다(useItem/item1~item3 로 각각 구매, fire 로 수동 탭 공격). 스테이지 10 보스를 잡으면 클리어. state(): gold, dps, stage, progress, enemyHp(0~1), score, upgradeCostRatio(현재 골드/다음 업그레이드 비용, 0~2). vibrexBot: 살 수 있으면 가장 효율 좋은 업그레이드 구매, 아니면 탭 공격.' },
  // 2. 슈팅
  { slug: 'shooter-fps', name: '1인칭 미로 슈팅', keywords: ['FPS', '1인칭', '1인칭 슈팅', '일인칭', '에프피에스', '발로란트', '오버워치', '카스', '카운터 스트라이크', '서든어택', '둠', '레이캐스팅', '3D 슈팅'],
    prompt: '1인칭 레이캐스팅 미로 슈팅. 격자 미로(캔버스 레이캐스팅, 벽은 단색 음영)에서 스프라이트 적 8마리를 찾아 쏘고 출구에 도달하면 클리어. 조작: up/down 전진·후진, left/right 회전, fire 발사, guard 달리기. 적은 플레이어를 향해 다가오며 접촉 시 피해. 미니맵 표시. state(): selfX, selfY, facing(각도 -1~1 정규화), targetDX/DY/Dist(가장 가까운 적), dangerDist, health, score, progress(처치 수/8), fireReady. vibrexBot: 가장 가까운 적을 향해 회전 후 사격, 없으면 출구 방향 전진.' },
  { slug: 'shooter-topdown', name: '탑다운 슈터', keywords: ['TPS', '3인칭 슈팅', '탑다운 슈팅', '탑다운 슈터', '트윈스틱', '트윈 스틱', '히어로 슈터', '하이퍼 슈터', '헬다이버즈', '좀비 슈팅', '총 게임', '건 슈팅', '위에서 보는 슈팅'],
    prompt: '탑다운 아레나 슈터. 사방에서 몰려오는 적 웨이브 5개를 버티고 5웨이브 보스를 잡으면 클리어. 조작: left/right/up/down 이동, aimX/aimY 조준(없으면 이동 방향), fire 사격(자동 연사), useItem 특수 스킬(주변 폭발, 쿨다운). 적 처치 시 점수, 체력 아이템 드롭. state(): selfX, selfY, targetDX/DY/Dist, dangerDX/DY/Dist, dangerCount, health, score, progress(웨이브/5), fireReady, itemCount. vibrexBot: 가장 가까운 적 조준 사격, 적이 3마리 이상 근접하면 스킬, 적 반대 방향으로 이동.' },
  { slug: 'battle-royale', name: '배틀로얄 서바이벌', keywords: ['배틀로얄', '배틀 로얄', '배그', '배틀그라운드', '에이펙스', '포트나이트', '자기장', '최후의 1인', '최후의 생존자', '서바이벌 슈팅', '100명 중 1명'],
    prompt: '탑다운 배틀로얄. 넓은 맵에 AI 플레이어 15명과 나, 시간이 지나면 안전지대 원이 줄어들고 밖에 있으면 피해. 바닥의 무기·방어구를 주워 강해지고, 마지막 1명이 되면 클리어(1위). 조작: 이동 4방향, fire 사격(가장 가까운 적 자동 조준), useItem 회복. AI 들도 서로 싸운다. state(): selfX, selfY, zoneDX/DY(안전지대 중심 방향), zoneDist(0~1, 밖이면 1), targetDX/DY/Dist, alive(남은 인원), health, score, progress(1-alive/16), itemCount. vibrexBot: 안전지대 밖이면 중심으로, 아니면 가까운 아이템 줍고 적이 가까우면 사격·후퇴.' },
  { slug: 'shooter-loot', name: '루트 슈터', keywords: ['루트슈터', '루트 슈터', '파밍 슈팅', '아이템 파밍', '퍼스트 디센던트', '디비전', '데스티니', '장비 등급', '레어 아이템', '보더랜드'],
    prompt: '사이드뷰 웨이브 루트 슈터. 적을 잡으면 등급(일반/희귀/영웅/전설) 무기·방어구가 드롭되고, 더 좋은 장비를 주우면(useItem) 자동 교체되어 공격력·방어력이 오른다. 8웨이브 보스 처치 시 클리어. 조작: left/right 이동, jump 점프, fire 사격, useItem 줍기. 화면에 현재 장비 등급 표시. state(): selfX, selfY, targetDX/DY/Dist, dangerDist, health, score, progress(웨이브/8), gearScore(0~1), itemCount(주울 수 있는 드롭 수), fireReady. vibrexBot: 드롭이 가까우면 줍기, 적이 있으면 거리 유지하며 사격.' },
  // 3. 전략
  { slug: 'moba-lane', name: '한 줄 라인전', keywords: ['MOBA', '모바', 'AOS', '롤', '리그오브레전드', '리그 오브 레전드', '라인전', '미니언', '타워 밀기', '도타', '와일드 리프트', '넥서스', '5대5 대신 1대1 라인'],
    prompt: '가로 한 줄 라인 MOBA. 좌우 끝에 내 타워/적 타워(넥서스), 30초마다 양쪽에서 미니언 3마리가 나와 전진하며 싸운다. 내 영웅은 좌우 이동, fire 평타, useItem 스킬(쿨다운, 범위 피해), guard 회복(타워 근처에서만). 미니언·적 영웅 처치로 골드→자동 성장. 적 타워를 부수면 클리어, 내 타워가 부서지면 게임오버. state(): selfX, laneProgress(0~1, 적 타워까지), targetDX/Dist(가장 가까운 적), dangerDist(적 타워 사거리 안이면 작음), allyMinions, enemyMinions, health, score, progress(적 타워 HP 감소율), fireReady. vibrexBot: 미니언 뒤에서 평타, 적 영웅 체력 낮으면 스킬, 자기 체력 낮으면 타워로 후퇴.' },
  { slug: 'rts-mini', name: '미니 RTS', keywords: ['RTS', '실시간 전략', '알티에스', '스타크래프트', '스타', '워크래프트', '유닛 생산', '자원 채집', '기지 건설', '에이지 오브 엠파이어', '커맨드 앤 컨커', '전략 시뮬레이션'],
    prompt: '초소형 실시간 전략. 왼쪽 내 기지, 오른쪽 적 기지. 일꾼이 자동으로 광물을 캐고, 자원으로 병사(item1)·궁수(item2)·일꾼(item3)을 생산한다. fire=전군 공격 명령(적 기지로 진격), guard=전군 귀환. 적 AI 도 생산·공격한다. 적 기지 파괴 시 클리어. state(): minerals, workers, soldiers, archers, enemyArmy, enemyBaseHp(0~1), myBaseHp(0~1), score, progress(1-enemyBaseHp), armyPower(0~1). vibrexBot: 일꾼 5명까지 우선, 이후 병사·궁수 번갈아 생산, 아군 병력 8 이상이면 공격, 기지 피격 시 귀환.' },
  { slug: 'strategy-turn', name: '턴제 영토 전략', keywords: ['4X', '턴제 전략', '문명', '시빌라이제이션', '영토 확장', '헥스', '헥스 맵', '턴 기반 전략', '제국 건설', '토탈워', '삼국지', '땅따먹기'],
    prompt: '턴제 육각형 영토 전략. 6x6 헥스 맵, 내 도시 1개 vs 적 도시 1개. 매 턴 행동력 3: 인접 타일 점령(up/down/left/right 로 커서 이동 + fire 확정), 병력 생산(item1), 도시 건설(item2, 점령 타일 위). 타일마다 자원(식량/금)이 있어 턴마다 수입. 적 AI 도 확장한다. 맵의 60% 점령 또는 적 도시 점령 시 클리어, 20턴 안에 못 하면 게임오버. state(): turn, myTiles, enemyTiles, gold, army, enemyArmy, progress(내 점령률), score, cursorX, cursorY, actionsLeft. vibrexBot: 자원 높은 인접 타일부터 점령, 골드 충분하면 병력, 병력 우세면 적 도시 방향으로 점령.' },
  { slug: 'auto-battler', name: '오토배틀러', keywords: ['오토배틀러', '오토 배틀러', '자동 전투', '롤토체스', '전략적 팀 전투', 'TFT', '체스류', '오토체스', '유닛 배치', '시너지', '기물 배치'],
    prompt: '오토배틀러. 라운드마다 골드로 상점의 유닛 3종 중 골라 사고(item1~item3), 5x2 아군 진영에 배치(left/right 로 칸 선택 + fire 배치, up/down 줄 선택), guard 로 라운드 시작 → 자동 전투(아군 vs 적 진영, 유닛끼리 자동 공격). 같은 유닛 3개 모이면 합쳐져 강해진다. 8라운드 승리 시 클리어, 체력(패배마다 감소) 0이면 게임오버. state(): round, gold, health, myPower(0~1), enemyPower(0~1), benchCount, progress(round/8), score, shopBest(상점 최고 유닛 등급). vibrexBot: 골드 있으면 가장 등급 높은 유닛 구매·앞줄 배치, 배치 끝나면 라운드 시작.' },
  { slug: 'tower-defense', name: '타워 디펜스', keywords: ['타워 디펜스', '타워디펜스', '디펜스', '디펜스 게임', 'TD', '방어 게임', '포탑', '적 막기', '웨이브 방어', '킹덤러시', '블룬스', '성 지키기'],
    prompt: '타워 디펜스. 구불구불한 길을 따라 적이 10웨이브 몰려오고 끝에 도달하면 생명 감소. 골드로 길 옆 빈 칸에 타워 설치: 커서 이동(left/right/up/down) + fire 설치, item1=단일 화살탑, item2=범위 폭발탑, item3=감속탑 선택, useItem=선택한 타워 업그레이드. 10웨이브 방어 성공 시 클리어. state(): wave, gold, lives, enemiesAlive, towers, progress(wave/10), score, cursorX, cursorY, dangerDist(가장 앞선 적의 남은 거리 0~1). vibrexBot: 길에 가까운 빈 칸부터 화살탑, 골드 모이면 범위탑·업그레이드.' },
  // 4. 어드벤처
  { slug: 'action-adventure', name: '탑다운 액션 어드벤처', keywords: ['액션 어드벤처', '어드벤처', '젤다', '젤다의 전설', '탐험', '던전 탐험', '열쇠와 문', '퍼즐 던전', '기믹', '모험 게임', '탑다운 어드벤처'],
    prompt: '탑다운 액션 어드벤처. 방 6개가 격자로 이어진 던전. 각 방에 기믹 하나: 스위치 밟기, 상자 밀기, 열쇠로 문 열기, 몬스터 처치. 최종 방의 보물을 얻으면 클리어. 조작: 이동 4방향, fire 검 휘두르기, jump 상호작용(스위치/상자/문), useItem 폭탄(벽 부수기, 2개). state(): selfX, selfY, roomIndex, targetDX/DY/Dist(현재 방의 목표: 열쇠/스위치/문), dangerDX/DY/Dist, health, lives, keys, itemCount, progress(roomIndex/6), score. vibrexBot: 현재 방 목표로 이동해 상호작용, 몬스터 근접 시 공격.' },
  { slug: 'metroidvania', name: '메트로배니아', keywords: ['메트로배니아', '메트로이드', '할로우 나이트', '캐슬바니아', '능력 획득', '지도 탐색', '탐색형 플랫포머', '오리', '데드셀', '숨겨진 길', '벽 점프'],
    prompt: '사이드뷰 탐색형 플랫포머(메트로배니아). 좌우로 이어진 5개 구역, 처음엔 갈 수 없는 길(높은 벽, 좁은 틈, 잠긴 문)이 있고 능력을 얻으면 열린다: 이단 점프(2구역), 대시(3구역), 미사일(4구역). 조작: left/right, jump(능력 후 공중 1회 더), guard 대시, fire 공격/미사일. 최종 구역의 코어를 파괴하면 클리어. 미니맵에 방문 구역 표시. state(): selfX, selfY, selfVX, selfVY, onGround, groundDist, targetDX/DY/Dist(다음 목표), dangerDX/DY/Dist, abilities(0~3), health, progress(abilities+구역/8), score, facing. vibrexBot: 다음 목표 방향으로 이동·점프, 벽 앞에서 능력 사용, 적은 공격.' },
  { slug: 'soulslike', name: '소울라이크 보스전', keywords: ['소울라이크', '소울 라이크', '다크소울', '다크 소울', '엘든 링 보스', '피의 거짓', '세키로', '패링', '회피', '구르기', '보스전', '스태미나', '고난도 액션', '블러드본'],
    prompt: '사이드뷰 소울라이크 보스전. 보스 1마리(3페이즈)와 1대1. 보스는 공격 전 예비 동작(빨간 깜빡임 0.5초 / 파란 깜빡임 = 패링 가능)을 보이고 광역·돌진·내려찍기 패턴을 쓴다. 조작: left/right 이동, guard 구르기(무적 0.3초, 스태미나 소모), jump 패링(파란 예비동작 타이밍 맞추면 보스 경직+큰 피해), fire 공격(스태미나 소모), useItem 회복 물약(3개). 스태미나 자동 회복. 보스 처치 시 클리어, 5회 죽으면 게임오버(죽으면 보스 HP 유지 옵션 없음, 처음부터). state(): selfX, targetDX/Dist, bossHp(0~1), bossPhase, bossIntent(0 없음/1 공격 예고/2 패링 가능 예고), dangerETA(0~1), health, stamina(0~1), itemCount, lives, score, progress(1-bossHp). vibrexBot: 예고 1이면 구르기, 예고 2면 패링, 스태미나 있으면 근접 공격, 체력 40% 이하면 물약.' },
  { slug: 'roguelike', name: '로그라이크 던전', keywords: ['로그라이크', '로그라이트', '로그 라이크', '하데스', '뱀서라이크', '뱀파이어 서바이버', '무작위 던전', '랜덤 던전', '영구 사망', '절차 생성', '아이작', '엔터 더 건전'],
    prompt: '탑다운 로그라이크. 매 판 무작위로 생성되는 방 8개(랜덤 배치·적·보물), 방을 클리어하면 3개 중 하나의 강화(공격력/이동속도/체력)를 고른다(item1~item3). 죽으면 처음부터(영구 사망), 8번째 방 보스 처치 시 클리어. 조작: 이동 4방향, fire 자동 조준 원거리 공격, guard 대시. state(): selfX, selfY, roomIndex, targetDX/DY/Dist, dangerDX/DY/Dist, dangerCount, health, score, progress(roomIndex/8), upgrades, fireReady. vibrexBot: 적과 거리 유지하며 사격, 다수 근접 시 대시, 강화 선택은 체력 낮으면 체력·아니면 공격력.' },
  { slug: 'fighting', name: '대전 격투', keywords: ['격투', '대전 격투', '격투 게임', '철권', '스트리트 파이터', '스파', '킹오파', '더킹오브파이터즈', '1대1 대전', '콤보', '필살기', '모탈컴뱃', '스매시'],
    prompt: '사이드뷰 1대1 대전 격투. 3판 2선승, 라운드 60초. 조작: left/right 이동, jump 점프, guard 막기(뒤로 이동 겸), fire 약공격, useItem 강공격(느리지만 큰 피해), 약→약→강 콤보. 기 게이지가 차면 item1 필살기. AI 상대는 거리별 행동. 2라운드 먼저 이기면 클리어. state(): selfX, targetDX/Dist, health, enemyHp(0~1), meter(0~1), enemyIntent(0 대기/1 공격/2 점프), dangerETA, round, score, progress(내 승수/2), facing, onGround. vibrexBot: 거리 멀면 접근, 상대 공격 예고면 막기, 근접 시 콤보, 기 차면 필살기.' },
  // 5. 시뮬레이션
  { slug: 'survival', name: '생존 크래프팅', keywords: ['서바이벌', '생존', '생존 게임', '팰월드', '러스트', '아크', '돈스타브', '자원 수집', '크래프팅', '밤에 몬스터', '허기', '장작', '생존 크래프트'],
    prompt: '탑다운 생존 크래프팅. 낮에는 나무·돌·열매를 모으고(fire 로 채집), 허기 게이지가 줄어 열매(useItem)로 채운다. 밤(90초 주기)이 되면 몬스터가 오므로 낮에 모은 자원으로 벽(item1)과 횃불(item2)을 설치하고 창(item3)을 만든다. 3일 밤을 살아남으면 클리어, 허기 0 또는 체력 0이면 게임오버. state(): selfX, selfY, wood, stone, food, hunger(0~1), health, isNight, dayIndex, dangerDX/DY/Dist, targetDX/DY/Dist(가장 가까운 자원), progress(dayIndex/3), score, itemCount. vibrexBot: 낮엔 가장 가까운 자원 채집·허기 낮으면 먹기, 저녁엔 벽·횃불 설치, 밤엔 횃불 옆에서 창으로 방어.' },
  { slug: 'sandbox', name: '블록 샌드박스', keywords: ['샌드박스', '마인크래프트', '마크', '테라리아', '블록 캐기', '블록 쌓기 세계', '건축', '자유 건축', '픽셀 채굴', '2D 마인크래프트', '크리에이티브'],
    prompt: '2D 사이드뷰 블록 샌드박스. 블록을 캘 때마다 +1점, 광석은 +10점, 블록을 쌓아 높이가 오를 때마다 +5점으로 점수가 즉시 오르고 AJ.score 를 호출한다(봇이 시작 5초 안에 점수를 내야 함). 절차 생성 지형(흙·돌·나무·광석), 조작: left/right 이동, jump 점프, fire 블록 캐기(바라보는 방향), useItem 블록 설치, item1~item4 인벤토리 슬롯 선택(흙/돌/나무/광석). 목표: 광석 10개를 캐고 높이 12칸의 탑을 쌓으면 클리어(진행률 표시). 낮밤 전환, 밤엔 슬라임이 나온다. state(): selfX, selfY, onGround, facing, ore, height(내가 쌓은 최고 높이), inventoryTotal, activeItem, slot0Ready~slot3Ready, dangerDX/DY/Dist, health, progress, score. vibrexBot: 광석 방향으로 파고, 광석 10개 후엔 제자리에서 블록 쌓으며 위로 점프.' },
  { slug: 'tycoon', name: '경영 타이쿤', keywords: ['타이쿤', '경영', '경영 시뮬레이션', '심시티', '시티 빌더', '건설 시뮬', '매장 운영', '가게 운영', '카페 운영', '롤러코스터 타이쿤', '회사 경영', '돈 벌기 게임', '음식점 경영'],
    prompt: '탑다운 매장 경영 타이쿤. 손님이 줄지어 들어와 카운터에서 주문하고 기다린다. 돈으로 시설을 산다: item1 카운터 추가, item2 좌석 추가, item3 직원 고용(자동 서빙), useItem 광고(손님 증가). fire 로 내가 직접 서빙(커서 이동 4방향으로 손님 선택). 손님이 너무 오래 기다리면 나가며 평판 감소. 5분 안에 매출 목표(₩50,000) 달성 시 클리어, 평판 0이면 게임오버. state(): money, reputation(0~1), customersWaiting, staff, counters, seats, progress(매출/목표), score, targetDX/DY/Dist(가장 오래 기다린 손님), timeLeft. vibrexBot: 대기 손님 있으면 서빙, 돈 모이면 직원→카운터→광고 순 구매.' },
  { slug: 'farming', name: '힐링 농장', keywords: ['농장', '농장 게임', '농경', '스타듀밸리', '스타듀 밸리', '동물의 숲', '힐링 게임', '힐링', '채집', '농사', '작물 키우기', '목장', '하베스트 문', '일상 시뮬'],
    prompt: '탑다운 힐링 농장. 4x4 밭에 씨앗을 심고(useItem), 물을 주고(fire), 시간이 지나면 자라 수확(jump)해 판다. 돈으로 씨앗 3종(item1 당근/item2 토마토/item3 호박, 가격·성장시간·수익 다름) 구매. 닭 1마리가 돌아다니며 달걀을 낳는다(줍기 jump). 계절 게이지가 다 차기 전(3분) 목표 금액 1,000골드를 모으면 클리어. 게임오버 없음(시간 초과 시 점수 정산). state(): selfX, selfY, gold, seeds, growingPlots, readyPlots, targetDX/DY/Dist(가장 가까운 수확 가능/물 필요 밭), progress(gold/1000), score, timeLeft, itemCount. vibrexBot: 수확 가능 밭 우선, 물 필요 밭, 빈 밭엔 가장 수익 좋은 씨앗.' },
  { slug: 'racing', name: '탑다운 레이싱', keywords: ['레이싱', '레이싱 게임', '자동차 게임', '카트라이더', '카트', '드라이빙', '드리프트', '서킷', '랩 타임', '스피드 레이스', '마리오카트', '자동차 경주', '속도 경주', '포르자'],
    prompt: '탑다운 서킷 레이싱. 곡선 트랙 1개, AI 차 5대와 3랩 경주. 조작: up 가속, down/guard 브레이크·후진, left/right 조향, useItem 부스트(3회). 트랙 밖은 감속. 3랩 완주 시 순위로 클리어(1~3위 클리어, 아니면 재도전). 랩 타임·순위 표시. state(): selfX, selfY, speed(0~1), heading(-1~1), trackDX/DY(다음 웨이포인트 방향), trackDist, offTrack(0/1), rank, lap, progress(lap/3+구간), score, itemCount. vibrexBot: 다음 웨이포인트 방향으로 조향, 직선에서 부스트, 급커브 전 브레이크.' },
  { slug: 'flight', name: '비행 시뮬', keywords: ['비행', '비행 시뮬', '비행기', '비행기 조종', '플라이트', '플라이트 시뮬레이터', '전투기', '조종 게임', '착륙', '에이스 컴뱃', '드론 조종', '헬기'],
    prompt: '사이드뷰 비행 시뮬. 비행기의 속도·고도·연료를 관리하며 산과 구름을 피해 5개 체크포인트 링을 통과하고 활주로에 착륙(속도·각도 조건)하면 클리어. 조작: up 기수 올리기, down 내리기, left/right 스로틀 감소/증가, useItem 착륙 기어. 실속(속도 부족)·지면 충돌·연료 0이면 게임오버. state(): altitude(0~1), speed(0~1), pitch(-1~1), fuel(0~1), targetDX/DY/Dist(다음 링), dangerDist(지형까지), progress(링 통과/5+착륙), score, gearDown. vibrexBot: 다음 링 높이에 맞춰 피치 조절, 속도 유지, 마지막엔 기어 내리고 강하.' },
  // 6. 캐주얼
  { slug: 'gacha', name: '수집형 캐릭터 육성', keywords: ['수집형', '서브컬처', '가챠', '뽑기', '캐릭터 수집', '원신', '블루 아카이브', '블루아카', '명일방주', '니케', '캐릭터 육성', '덱 구성', '소환'],
    prompt: '수집형 캐릭터 육성 게임. 스테이지 전투(자동 진행, 5인 파티 vs 적)로 보석을 얻고, 보석으로 뽑기(fire, 등급 R/SR/SSR 확률 표시). 뽑은 캐릭터를 파티에 편성(left/right 슬롯 선택, item1~item3 보유 캐릭터 선택, jump 편성), 중복은 자동 강화. 스테이지 10 클리어 시 클리어. 모든 확률·수치 표시, 실제 결제 없음. state(): gems, stage, partyPower(0~1), enemyPower(0~1), rosterCount, ssrCount, progress(stage/10), score, canPull(0/1). vibrexBot: 보석 있으면 뽑기, 파티 전력보다 강한 캐릭터 편성, 전투 시작.' },
  { slug: 'rhythm', name: '리듬 게임', keywords: ['리듬', '리듬 게임', '리듬게임', '디제이맥스', '음악 게임', '노트', '비트', '박자', '오스', 'osu', '태고', '탭소닉', '피아노 타일', '노트 떨어지는'],
    prompt: '4레인 리듬 게임. 노트가 위에서 떨어지고 판정선에 맞춰 누른다: left/up/down/right = 4레인(터치는 4분할). 노래는 WebAudio 오실레이터로 만든 간단한 비트(120BPM, 60초)이며 노트 패턴은 비트에 맞춰 생성. 판정 Perfect/Good/Miss, 콤보, 체력(Miss 시 감소, 0이면 게임오버). 곡을 끝까지 하면 클리어, 정확도 점수. state(): nextLane(0~3), nextETA(0~1), combo, accuracy(0~1), health, progress(경과/60초), score, lane0ETA~lane3ETA. vibrexBot: 각 레인 ETA 가 판정선 도달 시점에 정확히 누른다(실력 낮으면 타이밍 오차).' },
  { slug: 'match3', name: '3매치 퍼즐', keywords: ['3매치', '매치3', '매치 3', '쓰리매치', '퍼즐', '퍼즐 게임', '캔디크러시', '캔디 크러쉬', '애니팡', '보석 퍼즐', '같은 색 맞추기', '블록 퍼즐', '비주얼드'],
    prompt: '8x8 3매치 퍼즐. 인접한 두 타일을 교환해 같은 색 3개 이상을 맞추면 사라지고 위에서 채워진다. 조작: 커서 이동 4방향, fire 선택/교환(첫 선택 후 방향키로 교환 방향), 4매치는 줄 폭탄, 5매치는 색 폭탄. 30수 안에 목표 점수 5,000점이면 클리어. state(): movesLeft, score, progress(score/5000), bestMoveGain(현재 판에서 가능한 최고 수의 예상 점수, 0~1), cursorX, cursorY, combo. vibrexBot 은 가능한 모든 교환을 시뮬레이션해 가장 많이 지우는 수를 두며(후보 평가형 → setWeights/candidates 노출), 실력 낮으면 차선책.' },
  { slug: 'visual-novel', name: '비주얼 노벨', keywords: ['비주얼 노벨', '비주얼노벨', '텍스트 어드벤처', '스토리 게임', '선택지', '연애 시뮬', '미연시', '인터랙티브 스토리', '노벨 게임', '대화형 소설', '멀티 엔딩', '탐정 추리 게임'],
    prompt: '비주얼 노벨. 배경(단색)과 캐릭터(도형+이모지 표정) 위에 대사 창, 클릭/fire 로 다음 대사, 선택지 2~3개는 up/down 으로 고르고 fire 확정. 짧은 미스터리 스토리(폐교의 밤): 12장면, 선택에 따라 호감도·단서 수치가 바뀌고 3개 엔딩(진엔딩=클리어, 나머지는 재시도 가능). 대사 자동 타이핑 효과, 로그 보기(guard). state(): scene, clues, affinity, progress(scene/12), score, choiceCount, choiceIndex. vibrexBot: 대사를 넘기고 선택지는 단서가 많아지는 쪽(각 선택지의 단서 효과를 후보 평가)을 고른다.' },
  { slug: 'party', name: '파티 미니게임', keywords: ['파티', '파티 게임', '미니게임', '미니게임 모음', '멀티플레이', '2인용', '둘이서', '폴가이즈', '어몽어스', '마리오 파티', '술자리 게임', '친구랑', '같은 키보드'],
    prompt: '한 키보드 2인용 파티 미니게임 모음(AI 상대도 가능). 3가지 미니게임을 연속으로: (1) 버튼 연타 줄다리기 (2) 떨어지는 장애물 피하기 (3) 신호 뜨면 빨리 누르기. 1P: left/right/jump, 2P: A/D/W(터치는 화면 좌우 분할). 2P 미접속(5초 무입력)이면 AI 가 대신. 3판 중 2승이면 클리어. state(): game(0~2), myScore, otherScore, progress(game/3), score, signal(0/1), dangerDX/DY/Dist(장애물), selfX, targetDX(줄다리기 방향). vibrexBot: 1P 를 조작 — 연타, 장애물 회피, 신호 반응.' },
  { slug: 'sports', name: '미니 축구', keywords: ['축구', '축구 게임', '스포츠', '스포츠 게임', 'FC 온라인', '피파', '야구', '골 넣기', '슛', '페널티킥', '축구 경기', '풋볼', '핀볼 축구'],
    prompt: '탑다운 미니 축구 3대3(내 팀 1명 조작, 나머지 AI). 90초 전후반, 조작: 이동 4방향, fire 슛/태클, jump 패스(가장 가까운 아군), guard 스프린트. 공을 가진 선수가 없으면 가까운 선수로 자동 전환. 경기 종료 시 이기면 클리어, 지면 재도전, 비기면 승부차기(fire 타이밍). state(): selfX, selfY, ballDX/DY/Dist, goalDX/goalDist(상대 골대), hasBall(0/1), myGoals, theirGoals, timeLeft, progress(경과율), score, dangerDist(가장 가까운 상대). vibrexBot: 공 없으면 공으로, 공 있으면 골대 방향 드리블·거리 가까우면 슛, 상대 근접 시 패스.' },
  // ── 추가 26종 (캐주얼·퍼즐·교육·아케이드) ──
  { slug: 'puzzle-2048', name: '2048 숫자 합치기', keywords: ['2048', '숫자 합치기', '숫자 퍼즐', '타일 합치기', '같은 숫자 합치기', '2048 게임'],
    prompt: '4x4 격자 2048. left/right/up/down 으로 전체 타일을 밀어 같은 숫자를 합친다. 2048 타일을 만들면 클리어, 움직일 수 없으면 게임오버. 점수=합친 값 누적. state(): score, maxTile, emptyCells, progress(maxTile/2048), movesLeftPossible(0~4 방향 중 가능한 수), bestMoveGain(0~1). vibrexBot: 4방향 시뮬레이션 후 빈칸 수·단조성이 가장 좋은 방향(후보 평가형 → setWeights/candidates 노출).' },
  { slug: 'minesweeper', name: '지뢰찾기', keywords: ['지뢰찾기', '지뢰 찾기', '마인스위퍼', 'minesweeper', '지뢰 게임', '깃발 꽂기'],
    prompt: '9x9 지뢰 10개 지뢰찾기. 커서 이동 4방향, fire 열기, useItem 깃발 토글. 첫 클릭은 안전. 지뢰 아닌 칸을 모두 열면 클리어, 지뢰를 열면 게임오버. 점수=연 칸 수, 남은 시간 보너스. state(): opened, flags, minesLeft, progress(opened/71), score, cursorX, cursorY, safeMoves(논리적으로 안전한 칸 수), timeSec. vibrexBot: 숫자 규칙으로 확실히 안전한 칸 열기, 확실한 지뢰엔 깃발, 없으면 확률 낮은 칸.' },
  { slug: 'sudoku', name: '스도쿠', keywords: ['스도쿠', 'sudoku', '숫자 채우기', '9x9 퍼즐', '스도쿠 게임'],
    prompt: '9x9 스도쿠(쉬움 난이도, 매 판 무작위 생성·유일해). 커서 이동 4방향, item1~item4 로 숫자 1~4, item 다시 누르면 5~9 순환(터치는 숫자 패드 표시), fire 확정, guard 지우기. 틀린 입력은 빨간 표시(실수 3회면 게임오버). 전부 채우면 클리어. state(): filled, empty, mistakes, progress(filled/81), score(시간 보너스), cursorX, cursorY, candidatesAtCursor. vibrexBot: 단일 후보 칸부터 채우기.' },
  { slug: 'sliding-puzzle', name: '슬라이딩 15퍼즐', keywords: ['15퍼즐', '슬라이딩 퍼즐', '슬라이드 퍼즐', '숫자 맞추기 퍼즐', '타일 밀기', '퍼즐 맞추기'],
    prompt: '4x4 슬라이딩 15퍼즐. 방향키로 빈칸 쪽 타일을 민다. 순서대로 맞추면 클리어, 이동 수·시간으로 점수. 무작위 섞기는 풀 수 있는 배치만. state(): moves, correctTiles, progress(correct/15), manhattan(총 맨해튼 거리 정규화 0~1), score, timeSec, blankX, blankY. vibrexBot: 맨해튼 거리를 줄이는 방향 우선(간단 탐욕+무작위).' },
  { slug: 'gomoku', name: '오목', keywords: ['오목', '틱택토', '삼목', '5목', '렌주', '바둑알 게임', '다섯 개 연속', '틱택토 게임'],
    prompt: '15x15 오목(AI 상대). 커서 이동 4방향 + fire 착수, 흑이 선공(플레이어). 5개 연속이면 승리=클리어, 상대가 먼저 만들면 게임오버. AI 는 공격/방어 점수 평가. state(): turn, myStones, enemyStones, threatLevel(0~1, 상대 4목 위협), myBest(0~1, 내 최고 연속), progress(myBest), score, cursorX, cursorY. vibrexBot: 후보 칸 평가(연속·차단)로 착수(후보 평가형 → setWeights/candidates 노출).' },
  { slug: 'memory-match', name: '짝맞추기 카드', keywords: ['짝맞추기', '짝 맞추기', '메모리 게임', '카드 뒤집기', '같은 그림 찾기', '기억력 게임', '카드 짝'],
    prompt: '4x4 이모지 카드 짝맞추기(8쌍). 커서 이동 4방향 + fire 뒤집기, 두 장이 같으면 유지. 모두 맞추면 클리어, 시도 횟수·시간으로 점수, 20회 초과 실패 시 게임오버 없음(60초 제한). state(): matched, attempts, progress(matched/8), knownPairs(뒤집어 봐서 아는 쌍 수), score, timeLeft, cursorX, cursorY. vibrexBot: 본 카드를 기억해 아는 쌍부터 맞추기.' },
  { slug: 'wordle', name: '단어 맞추기', keywords: ['워들', 'wordle', '단어 맞추기', '단어 게임', '영단어 맞추기', '5글자 단어', '단어 퍼즐'],
    prompt: '5글자 영단어 맞추기(워들). 내장 단어 200개 중 정답 1개, 6번 시도. 조작: left/right 로 알파벳 선택(화면 키보드 하이라이트), up/down 으로 행 이동, fire 글자 입력, guard 지우기, jump 제출. 초록/노랑/회색 판정. 맞히면 클리어, 6회 실패면 게임오버. state(): attempt, greens, yellows, progress(greens/5), score, candidatesLeft(가능 정답 수), cursorLetter. vibrexBot: 남은 후보 단어 중 정보량 높은 단어 제출.' },
  { slug: 'typing', name: '타자 연습', keywords: ['타자 연습', '타자 게임', '타이핑', 'typing', '키보드 연습', '떨어지는 단어', '산성비', '한컴타자'],
    prompt: '떨어지는 단어 타자 게임(영단어 150개). 단어가 위에서 내려오고, 키보드로 입력해 Enter 로 없앤다(터치는 화면 키보드). 바닥에 닿으면 생명 -1(3개), 60초 동안 점수 최대. 60초 완주면 클리어. 조작은 실제 키보드 입력 + fire=Enter. state(): score, lives, wpm, accuracy(0~1), wordsOnScreen, lowestWordY(0~1), progress(경과/60), typedLen. vibrexBot: 가장 낮은 단어를 글자 단위로 입력(실력 낮으면 오타).' },
  { slug: 'quiz', name: '상식 퀴즈', keywords: ['퀴즈', '상식 퀴즈', 'OX 퀴즈', '4지선다', '객관식 퀴즈', '퀴즈 게임', '문제 풀기', '골든벨'],
    prompt: '상식 퀴즈 20문제(내장 문제은행 60개, 한국어, 4지선다 + OX 섞음). up/down 또는 item1~item4 로 보기 선택, fire 확정, 문제당 10초 타이머. 정답 +100 + 남은 시간 보너스, 3회 틀리면 게임오버, 20문제 완주 시 클리어. state(): questionIndex, correct, wrong, timeLeft, progress(index/20), score, streak, selected. vibrexBot: 정답 인덱스를 알고 있지만 실력(skill)에 따라 확률적으로 맞힘.' },
  { slug: 'edu-quiz', name: '학습 퀴즈', keywords: ['구구단', '영단어', '영단어 퀴즈', '학습 게임', '교육 게임', '수학 게임', '덧셈 게임', '단어 암기', '어린이 학습'],
    prompt: '교육용 학습 퀴즈: 시작 화면에서 모드 선택(item1 구구단, item2 덧셈·뺄셈, item3 영단어 뜻 맞추기). 문제가 나오고 4지선다(up/down 또는 item1~item4 선택, fire 확정), 15초 제한. 30문제 중 25개 이상 맞히면 클리어. 연속 정답 콤보 보너스. state(): mode, questionIndex, correct, streak, timeLeft, progress(index/30), score, selected. vibrexBot: 실력에 따라 정답률이 달라짐.' },
  { slug: 'whack-a-mole', name: '두더지 잡기', keywords: ['두더지 잡기', '두더지', '두더지 게임', 'whack a mole', '튀어나오는', '망치 게임'],
    prompt: '3x3 구멍 두더지 잡기. 두더지가 무작위로 튀어나오고 커서를 옮겨(4방향) fire 로 때린다(터치는 구멍 탭). 폭탄 두더지는 때리면 감점. 60초 안에 목표 30마리면 클리어. state(): score, hits, misses, activeMoles, targetDX/DY/Dist(가장 오래된 두더지), timeLeft, progress(hits/30), cursorX, cursorY, bombActive. vibrexBot: 가장 오래된 두더지로 이동해 타격, 폭탄은 피함.' },
  { slug: 'reaction', name: '반응속도 테스트', keywords: ['반응속도', '반응 속도', '반응속도 테스트', '리액션', '순발력', '순발력 게임', '초록불 누르기'],
    prompt: '반응속도 테스트 5라운드. 화면이 빨강→(무작위 1~4초)→초록으로 바뀌면 최대한 빨리 fire(또는 탭). 초록 전에 누르면 실격 라운드. 5라운드 평균 ms 표시, 평균 300ms 이하면 클리어(등급 표시). state(): round, lastMs, avgMs, signal(0/1), progress(round/5), score(낮은 ms = 높은 점수), falseStarts. vibrexBot: 신호 뜨면 실력에 따른 지연(120~400ms)으로 반응.' },
  { slug: 'stack', name: '스택 쌓기', keywords: ['스택', '블록 쌓기 타이밍', '스택 게임', 'stack', '타이밍 쌓기', '탑 쌓기', '높이 쌓기'],
    prompt: '좌우로 움직이는 블록을 타이밍 맞춰(fire) 떨어뜨려 아래 블록 위에 쌓는 스택 게임. 어긋난 부분은 잘려 블록이 좁아지고, 완전히 놓치면 게임오버. 30층 쌓으면 클리어, 정확히 맞추면 콤보 보너스. state(): height, width(0~1), offset(-1~1, 현재 블록과 아래 블록의 어긋남), speed, combo, progress(height/30), score, movingX. vibrexBot: offset 이 0 에 가까울 때 fire(실력 낮으면 오차).' },
  { slug: 'helix-jump', name: '헬릭스 점프', keywords: ['헬릭스 점프', '헬릭스', '나선 탑', '공 떨어뜨리기', '탑 내려가기', '회전 탑'],
    prompt: '헬릭스 점프: 공이 나선 탑을 따라 떨어지고, left/right 로 탑을 회전시켜 틈으로 통과시킨다. 빨간 구간에 닿으면 게임오버. 연속으로 여러 층을 통과하면 무적·보너스. 50층 도달 시 클리어. state(): floor, gapDX(-1~1, 가장 가까운 틈 방향), gapDist, dangerDist, combo, progress(floor/50), score, ballY. vibrexBot: 틈 방향으로 회전.' },
  { slug: 'crossy-road', name: '길 건너기', keywords: ['길 건너기', '크로시 로드', '크로시로드', '프로거', '도로 건너기', '차 피하기', '닭 길 건너기', '강 건너기'],
    prompt: '길 건너기(크로시 로드). 위로 한 칸씩 전진(up), 좌우 이동, 도로(자동차)와 강(통나무 타기)을 건넌다. 차에 치이거나 물에 빠지면 게임오버, 뒤로 너무 처지면 게임오버. 50칸 전진하면 클리어, 전진 칸 수=점수. state(): selfX, row, dangerDX/Dist(가장 가까운 차), dangerETA, laneType(0 잔디/1 도로/2 강), logDX, progress(row/50), score, safeAhead(0/1). vibrexBot: 앞 줄이 안전하면 전진, 아니면 대기·좌우 회피.' },
  { slug: 'rhythm-jump', name: '리듬 점프', keywords: ['지오메트리 대시', '지오메트리대시', '리듬 점프', '큐브 점프', '한 버튼 점프', '가시 피하기', '원버튼 러너', '비트 러너'],
    prompt: '지오메트리 대시 스타일 원버튼 리듬 러너. 큐브가 자동으로 달리고 jump 로 점프해 가시·틈을 넘고, 비트에 맞춘 장애물 배치(120BPM). 부딪히면 처음부터(시도 횟수 표시), 레벨 끝(60초 분량)에 도달하면 클리어. 진행률 바 표시. state(): selfX, onGround, dangerDX/Dist(다음 장애물), dangerETA, obstacleType(0 가시/1 틈/2 블록), progress, attempts, score. vibrexBot: dangerETA 가 임계 이하일 때 점프.' },
  { slug: 'doodle-jump', name: '두들 점프', keywords: ['두들 점프', '두들점프', '위로 점프', '발판 점프', '무한 점프', '수직 점프', '발판 밟기'],
    prompt: '두들 점프: 캐릭터가 자동으로 튀고 left/right 로 발판을 밟아 위로 올라간다(화면 좌우 워프). 깨지는 발판·움직이는 발판·스프링. 화면 아래로 떨어지면 게임오버, 높이 5000 도달 시 클리어. state(): selfX, selfVY, targetDX/DY/Dist(밟을 다음 발판), platformType, height, progress(height/5000), score, springNear(0/1). vibrexBot: 다음 발판 x 로 이동.' },
  { slug: 'pacman', name: '미로 먹기', keywords: ['팩맨', '팩맨 게임', '미로 먹기', '점 먹기', '유령 피하기', '미로 게임', '도트 먹기'],
    prompt: '팩맨 스타일 미로 먹기. 19x15 미로의 점을 모두 먹으면 클리어, 유령 4마리(추격/매복/무작위)에 잡히면 생명 -1(3개). 파워 알약을 먹으면 10초간 유령을 먹을 수 있음. 조작 4방향(방향 예약 입력). state(): selfX, selfY, dotsLeft, dangerDX/DY/Dist(가장 가까운 유령), dangerCount, powered(0/1), poweredLeft, targetDX/DY/Dist(가장 가까운 점), lives, progress(1-dotsLeft/total), score. vibrexBot: BFS 로 가장 가까운 점, 유령이 근접하면 반대로.' },
  { slug: 'asteroids', name: '소행성 격파', keywords: ['아스테로이드', '소행성', '소행성 격파', '우주선 회전 슈팅', '운석 파괴', '아스테로이드 게임', '관성 우주선'],
    prompt: '아스테로이드: 우주선을 left/right 로 회전, up 추진(관성), fire 발사. 큰 소행성은 맞으면 둘로 쪼개진다. 화면 가장자리 워프. 소행성을 모두 없애면 다음 웨이브, 5웨이브 클리어 시 클리어, 충돌 시 생명 -1(3개). state(): selfX, selfY, selfVX, selfVY, facing(-1~1), targetDX/DY/Dist(가장 가까운 소행성), dangerETA, asteroidsLeft, wave, lives, progress(wave/5), score, fireReady. vibrexBot: 가장 가까운 소행성 조준·사격, 근접 시 추진 회피.' },
  { slug: 'bomberman', name: '폭탄 미로', keywords: ['봄버맨', '폭탄 게임', '폭탄 미로', '폭탄 설치', '봄버맨 게임', '벽 부수기 폭탄'],
    prompt: '봄버맨 스타일. 격자 미로에서 4방향 이동, fire 로 폭탄 설치(2초 후 십자 폭발), 부서지는 벽 뒤에 아이템(폭탄 수·화력 증가). 적 6마리를 모두 없애고 출구에 도달하면 클리어, 폭발·적 접촉 시 생명 -1(3개). state(): selfX, selfY, bombs, power, enemiesLeft, dangerDX/DY/Dist(가장 가까운 적 또는 폭발 예정 칸), dangerETA, targetDX/DY/Dist, lives, progress(1-enemiesLeft/6), score. vibrexBot: 벽·적 옆에 폭탄 설치 후 안전 칸으로 대피.' },
  { slug: 'maze', name: '미로 탈출', keywords: ['미로', '미로 탈출', '미로 게임', '미로 찾기', '탈출 게임', '방 탈출 미로', '라비린스'],
    prompt: '절차 생성 미로 탈출(21x21). 4방향 이동, 시야 제한(주변만 밝음), 열쇠 3개를 모아 출구 문을 열면 클리어, 90초 제한 초과 시 게임오버. 미니맵은 방문한 곳만. state(): selfX, selfY, keys, targetDX/DY/Dist(다음 열쇠 또는 출구, BFS 거리), timeLeft, progress(keys/3 + 출구 근접), score, deadEndAhead(0/1). vibrexBot: BFS 로 다음 목표까지 최단 경로.' },
  { slug: 'slingshot', name: '새총 물리 발사', keywords: ['앵그리버드', '새총', '물리 발사', '발사 게임', '구조물 무너뜨리기', '포물선 게임', '투석기'],
    prompt: '앵그리버드 스타일 새총 물리 게임(자체 간단 물리: 중력·충돌·블록 넘어짐). 각도(up/down)와 파워(left/right, 또는 드래그)를 정해 fire 로 발사, 새 5마리로 목표 돼지 6마리를 모두 없애면 클리어, 못 없애면 재도전. 남은 새 보너스. state(): birdsLeft, targetsLeft, aimAngle(0~1), aimPower(0~1), targetDX/DY/Dist(가장 가까운 목표), progress(1-targetsLeft/6), score, lastHit(0/1). vibrexBot: 각 목표에 대한 발사 각·파워를 시뮬레이션해 최적값(후보 평가형).' },
  { slug: 'tank-duel', name: '탱크 포격 대전', keywords: ['탱크 게임', '탱크 대전', '포격 게임', '포탄 각도', '웜즈', '포트리스', '대포 게임', '각도 맞추기'],
    prompt: '포트리스/웜즈 스타일 턴제 탱크 포격 대전(1대1 AI). 언덕 지형(파괴됨), 바람. 내 턴에 left/right 이동(연료 제한), up/down 각도, guard 파워 조절, fire 발사. 상대 HP 0 이면 클리어(3판 중 2승), 내 HP 0 이면 게임오버. state(): selfX, targetDX/Dist, angle(0~1), power(0~1), wind(-1~1), health, enemyHp(0~1), turn, progress(내 승수/2), score, lastShotError(-1~1, 짧음/넘김). vibrexBot: 이전 착탄 오차로 각·파워를 보정해 발사.' },
  { slug: 'io-eat', name: '먹고 커지기', keywords: ['아가리오', 'agar.io', 'io 게임', '먹고 커지기', '세포 게임', '먹이 먹기 성장', '슬리더', '커지는 게임'],
    prompt: '아가리오 스타일 탑다운 성장 게임. 내 세포를 4방향(또는 aimX/aimY)으로 움직여 먹이를 먹고 커지며, 나보다 작은 AI 세포를 먹고 큰 세포는 피한다. guard 로 분열 대시(작아짐). 크기 1위가 되거나 목표 크기 도달 시 클리어, 먹히면 게임오버. state(): selfX, selfY, size(0~1), targetDX/DY/Dist(가장 가까운 먹이 또는 작은 세포), dangerDX/DY/Dist(큰 세포), rank, progress(size), score, aliveCells. vibrexBot: 위험 세포 반대 방향, 아니면 가장 가까운 먹이.' },
  { slug: 'deckbuilder', name: '덱빌딩 카드 배틀', keywords: ['덱빌딩', '덱 빌딩', '카드 배틀', '카드 게임', '슬레이 더 스파이어', '카드 전투', '로그라이크 카드', '턴제 카드'],
    prompt: '덱빌딩 카드 배틀. 시작 덱 10장(공격/방어/특수), 매 턴 5장 뽑고 에너지 3 안에서 카드 사용(left/right 카드 선택, fire 사용, guard 턴 종료). 적 3마리를 차례로 이기고 전투 후 카드 3장 중 1장 추가(item1~item3). 마지막 보스를 이기면 클리어, HP 0 이면 게임오버. 적은 다음 행동을 예고. state(): health, block, energy, handSize, enemyHp(0~1), enemyIntent(0 공격/1 방어/2 강공격), deckSize, encounter, progress(encounter/4), score, bestCardValue. vibrexBot: 예고가 공격이면 방어 우선, 아니면 최대 피해 조합.' },
  { slug: 'sports-shot', name: '농구 슛 · 골프 퍼팅', keywords: ['농구', '농구 게임', '농구 슛', '3점슛', '골프', '골프 게임', '퍼팅', '슛 게임', '미니 골프'],
    prompt: '두 모드 미니 스포츠(시작 화면에서 item1 농구 슛 / item2 골프 퍼팅 선택). 농구: 파워 게이지 타이밍(fire)과 각도(up/down)로 60초 안에 최대 득점, 거리 랜덤, 20점이면 클리어. 골프: 9홀 미니 골프, 각도(left/right)·파워(길게 누른 fire)로 퍼팅, 장애물·경사, 총 타수 par 이하면 클리어. state(): mode, angle(0~1), power(0~1), targetDX/DY/Dist, windOrSlope(-1~1), attempts, score, progress, timeLeft. vibrexBot: 거리별 최적 각·파워(실력 낮으면 오차).' },
]

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const only = new Set(process.argv.slice(2))
const targets = SPECS.filter(s => !only.size || only.has(s.slug))
let totalIn = 0, totalOut = 0
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--headless=new', '--autoplay-policy=no-user-gesture-required'] })

async function smoke(html: string): Promise<string | null> {
  const f = path.join(S, `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.html`)
  fs.writeFileSync(f, html)
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } })
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(() => { (window as unknown as { __ev: unknown[] }).__ev = []; window.addEventListener('message', e => { const d = e.data; if (d && d.type === 'aj:event') (window as unknown as { __ev: unknown[] }).__ev.push(d.name) }) })
  try {
    await page.goto('file://' + f, { waitUntil: 'load', timeout: 20000 })
    await page.waitForTimeout(1200)
    let c1: { has: boolean; phase: string | null; inputs: string[]; state: string[]; bot: boolean }
    try { c1 = await page.evaluate(() => { const G = (window as unknown as { VIBREX_GAME?: Record<string, unknown> }).VIBREX_GAME; return { has: !!G, phase: typeof G?.phase === 'function' ? (G.phase as () => string)() : null, inputs: G?.inputs ? Object.keys(G.inputs as object) : [], state: typeof G?.state === 'function' ? Object.keys(((G.state as () => object)() || {})) : [], bot: !!(window as unknown as { vibrexBot?: unknown }).vibrexBot } }) }
    catch (e) { return `로드 직후(게임 시작 전) VIBREX_GAME.state()/phase() 호출이 예외를 던짐: ${(e as Error).message.replace('page.evaluate: ', '').slice(0, 120)} — 모든 배열·객체(격자, 플레이어, 적 목록)를 스크립트 로드 시점에 초기화하고, state() 는 시작 전에도 항상 숫자 슬롯을 반환해야 함(옵셔널 체이닝·기본값 사용)` }
    if (!c1.has) return 'VIBREX_GAME 없음'
    if (!c1.bot) return 'vibrexBot 없음'
    const bad = c1.inputs.filter(k => !UAS.has(k)); if (bad.length) return `UAS 외 입력: ${bad.join(',')}`
    if (c1.state.length < 3) return `state() 슬롯 부족: ${c1.state.join(',')}`
    await page.evaluate(() => { const G = (window as unknown as { VIBREX_GAME: { start?: () => void } }).VIBREX_GAME; try { G.start?.() } catch { /* */ } })
    await page.waitForTimeout(500)
    await page.evaluate(() => { try { (window as unknown as { vibrexBot: { start: () => void } }).vibrexBot.start() } catch (e) { throw new Error('bot start: ' + (e as Error).message) } })
    await page.waitForTimeout(9000)
    let c2: { phase: string; ev: string[]; score: unknown }
    try { c2 = await page.evaluate(() => { const G = (window as unknown as { VIBREX_GAME: { phase: () => string; state: () => Record<string, unknown> } }).VIBREX_GAME; return { phase: G.phase(), ev: (window as unknown as { __ev: string[] }).__ev, score: G.state().score } }) }
    catch (e) { return `봇 플레이 9초 후 state()/phase() 호출이 예외를 던짐: ${(e as Error).message.replace('page.evaluate: ', '').slice(0, 120)} — 게임오버·클리어·씬 전환 후에도 state() 가 undefined 객체를 참조하지 않도록 방어할 것` }
    const diag = `phase=${c2.phase} score=${String(c2.score)} ev=${JSON.stringify(c2.ev.slice(0, 6))} errors=${JSON.stringify(errors.slice(0, 2))}`
    if (errors.length) return `런타임 오류: ${errors[0].slice(0, 160)} [${diag}]`
    if (!['playing', 'over', 'cleared', 'paused'].includes(c2.phase)) return `봇 시작 후 phase=${c2.phase} (start()/vibrexBot.start() 가 실제로 게임을 시작시켜야 함) [${diag}]`
    const scored = typeof c2.score === 'number' && c2.score > 0
    if (!c2.ev.some(n => n !== 'load') && !scored) return `AJ 이벤트가 없고 점수도 0 — (1) VIBREX_GAME.start() 가 호출되면 시작 화면·모드 선택을 건너뛰고 즉시 플레이 상태로 들어가며 그 시점에 if(window.AJ) AJ.start() 를 호출할 것, (2) window.AJ 를 절대 재정의하지 말 것, (3) vibrexBot.start() 후 봇이 1초 안에 실제 행동을 시작해 9초 안에 점수(state().score>0)를 내야 함(턴제면 봇이 자동으로 턴을 진행·확정) [${diag}]`
    return null
  } catch (e) { return 'smoke 예외: ' + (e as Error).message.slice(0, 160) }
  finally { await ctx.close(); fs.rmSync(f, { force: true }) }
}

/** USE_MAX=1: API 크레딧 대신 Claude Code 헤드리스(`claude -p`, Max 구독 인증)로 생성. 사용량 토큰은 알 수 없어 0 처리 */
function genViaMax(prompt: string): { text: string; stop_reason: string; usage: { input_tokens: number; output_tokens: number } } {
  const env = { ...process.env }; delete env.CLAUDECODE; delete env.CLAUDE_CODE_ENTRYPOINT; delete env.ANTHROPIC_API_KEY
  const r = spawnSync('claude', ['-p', '--tools', '', '--model', 'sonnet', '--output-format', 'text', '--no-session-persistence', '--effort', 'medium', '--system-prompt', SYSTEM_PROMPT], { input: `요청: ${prompt}`, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900_000 })
  if (r.status !== 0) throw new Error(`claude -p 실패(${r.status}): ${(r.stderr || r.stdout || '').slice(0, 300)}`)
  return { text: r.stdout, stop_reason: 'end_turn', usage: { input_tokens: 0, output_tokens: Math.round(r.stdout.length / 3) } }
}

async function gen(spec: Spec): Promise<void> {
  const out = path.join(OUT, `${spec.slug}.json`)
  if (fs.existsSync(out) && !process.env.FORCE) { console.log(`skip ${spec.slug} (exists)`); return }
  let feedback = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t0 = Date.now()
    const prompt = spec.prompt + SPEC + (feedback ? `\n\n[이전 시도의 문제 — 반드시 고칠 것] ${feedback}` : '')
    const msg = process.env.USE_MAX
      ? genViaMax(prompt)
      : await client.messages.stream({ model: 'claude-sonnet-5', max_tokens: 32000, thinking: { type: 'adaptive' }, output_config: { effort: 'medium' }, system: SYSTEM_PROMPT, messages: buildMessages({ prompt, currentHtml: null, history: [], images: [] }) as never }).finalMessage().then(m => ({ text: m.content.map(c => (c.type === 'text' ? c.text : '')).join(''), stop_reason: String(m.stop_reason), usage: { input_tokens: m.usage.input_tokens, output_tokens: m.usage.output_tokens, output_tokens_details: (m.usage as { output_tokens_details?: { thinking_tokens?: number } }).output_tokens_details } }))
    totalIn += msg.usage.input_tokens; totalOut += msg.usage.output_tokens
    const text = msg.text
    const parsed = parseGeneration(text)
    if (!parsed.html) { const trunc = msg.stop_reason === 'max_tokens'; feedback = trunc ? `출력이 너무 길어 ${msg.usage.output_tokens} 토큰에서 잘렸음. 기능을 절반으로 줄이고 코드를 압축해 12KB 이내로 완성하라` : '게임 HTML 이 <game>…</game> 태그 안에 완결되어 있지 않았음'; console.log(`✗ ${spec.slug} #${attempt}: no html (stop=${msg.stop_reason}, out ${msg.usage.output_tokens}, thinking ${(msg.usage as { output_tokens_details?: { thinking_tokens?: number } }).output_tokens_details?.thinking_tokens ?? '?'}) tail=${JSON.stringify(text.slice(-120))}`); continue }
    const html = hardenHtml(parsed.html)
    const err = await smoke(html)
    if (err) { feedback = err; fs.writeFileSync(path.join(S, `fail-${spec.slug}-${attempt}.html`), html); console.log(`✗ ${spec.slug} #${attempt}: ${err} (${Math.round((Date.now() - t0) / 1000)}s, out ${msg.usage.output_tokens} tok)`); continue }
    const rec = { slug: spec.slug, name: spec.name, keywords: spec.keywords, prompt: spec.prompt, description: parsed.description.slice(0, 500), html, ...(spec.genreGroup ? { genreGroup: spec.genreGroup } : {}) }
    fs.writeFileSync(out, JSON.stringify(rec, null, 2))
    console.log(`✓ ${spec.slug} (${extractTitle(html)}) ${Math.round(html.length / 1024)}KB · ${Math.round((Date.now() - t0) / 1000)}s · out ${msg.usage.output_tokens} tok (thinking ${(msg.usage as { output_tokens_details?: { thinking_tokens?: number } }).output_tokens_details?.thinking_tokens ?? '?'})`)
    return
  }
  console.log(`!! ${spec.slug} 실패 (3회) — 수동 확인 필요`)
}

// 동시 4개
const queue = [...targets]
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) { const s = queue.shift()!; try { await gen(s) } catch (e) { console.log(`!! ${s.slug} 예외: ${(e as Error).message.slice(0, 200)}`) } } }))
await browser.close()
const cost = (totalIn * 3 + totalOut * 15) / 1e6
console.log(`\n총 토큰 in ${totalIn} / out ${totalOut} · 원가 ≈ $${cost.toFixed(2)} (≈ ₩${Math.round(cost * 1380).toLocaleString()})`)
