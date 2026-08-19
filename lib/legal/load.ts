// 게시된 약관 로드 (DB 우선, 없으면 정적 폴백)
import { createAdminClient } from '@/lib/supabase/admin'
import type { LegalDoc } from '@/components/LegalPage'
import { LEGAL_STATIC } from '@/lib/legal/static'
export async function loadLegal(key: keyof typeof LEGAL_STATIC): Promise<{ ko: LegalDoc; en: LegalDoc; version: number | null }> {
  const st = LEGAL_STATIC[key]
  try {
    const { data } = await createAdminClient().from('legal_docs').select('lang,title,updated,sections,version').eq('key', key).eq('published', true).order('version', { ascending: false }).limit(10)
    const rows = (data ?? []) as { lang: string; title: string; updated: string; sections: LegalDoc['sections']; version: number }[]
    const ko = rows.find(r => r.lang === 'ko'); const en = rows.find(r => r.lang === 'en')
    return { ko: ko ? { title: ko.title, updated: ko.updated, sections: ko.sections } : st.ko, en: en ? { title: en.title, updated: en.updated, sections: en.sections } : st.en, version: ko?.version ?? null }
  } catch { return { ko: st.ko, en: st.en, version: null } }
}
