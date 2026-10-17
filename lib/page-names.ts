// 홈·스튜디오·게임을 뺀 페이지 — 헤더의 로고 옆에 'vibrexcup' 대신 페이지 이름을 보여 준다
export const PAGE_NAMES: Record<string, string> = { '/gallery': 'GALLERY', '/story': 'STORY', '/partner': 'PARTNER', '/dev': 'DEV', '/about': 'ABOUT', '/tournament': 'EVENT' }
export const pageNameOf = (pathname: string) => { const k = Object.keys(PAGE_NAMES).find((p) => pathname === p || pathname.startsWith(p + '/')); return k ? PAGE_NAMES[k] : null }
