'use client'
// iOS(사파리·앱 웹뷰)는 앱이 백그라운드로 갔다 오면 메모리 확보를 위해 이미지 디코딩 결과를 버린다.
// 돌아왔을 때 그림이 하얗게 비는 카드가 생기는 이유 → 화면이 다시 보이는 순간 깨진 이미지를 찾아 다시 받아온다.
import { useEffect, type RefObject } from 'react'

export function useImageRevive(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const revive = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
      const root = ref.current
      if (!root) return
      root.querySelectorAll('img').forEach((im) => {
        const src = im.currentSrc || im.src
        if (!src) return
        const reload = () => { im.removeAttribute('srcset'); im.src = `${src}${src.includes('?') ? '&' : '?'}_r=${Date.now()}` }
        if (im.naturalWidth === 0) { reload(); return }     // 아예 날아간 경우
        // 크기는 남아 있는데 그림만 비는 경우도 있다 — 다시 디코딩해 보고 실패하면 새로 받는다
        im.decode?.().catch(reload)
      })
    }
    // 복귀 직후엔 아직 디코딩 상태가 갱신되지 않을 수 있어 조금 뒤에도 한 번 더
    const onWake = () => { revive(); setTimeout(revive, 250); setTimeout(revive, 1200) }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('pageshow', onWake)
    window.addEventListener('focus', onWake)
    return () => {
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('pageshow', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [ref])
}
