'use client'

import { useState } from 'react'
import { useLang } from '@/lib/i18n/context'
import type { StudioVersionMeta } from '@/lib/supabase/types'

export default function GamePreview({
  html, versions, currentVersionId, onSelectVersion, onPublish, busy,
}: {
  html: string | null
  versions: StudioVersionMeta[]
  currentVersionId: string | null
  onSelectVersion: (id: string) => void
  onPublish: () => void
  busy: boolean
}) {
  const [frameKey, setFrameKey] = useState(0)
  const { T } = useLang()
  const s = T.studio

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-2 flex-wrap">
        <button
          onClick={() => setFrameKey(k => k + 1)}
          disabled={!html}
          className="font-pixel text-[11px] text-gray-400 hover:text-[#00ff41] transition-colors disabled:opacity-40 tracking-widest"
        >
          {s.refresh}
        </button>
        {versions.length > 0 && (
          <select
            value={currentVersionId ?? ''}
            onChange={e => onSelectVersion(e.target.value)}
            className="bg-[#111] border border-gray-800 text-gray-300 text-[11px] px-2 py-1 outline-none"
            aria-label={s.versions}
          >
            {versions.map(v => (
              <option key={v.id} value={v.id}>
                {s.versionLabel(v.version)} — {new Date(v.created_at).toLocaleString()}
              </option>
            ))}
          </select>
        )}
        <div className="flex-1" />
        <button
          onClick={onPublish}
          disabled={!html || busy}
          className="bg-[#00ff41] text-black font-pixel text-[11px] px-4 py-1.5 hover:bg-[#00cc33] transition-colors disabled:opacity-40 tracking-widest"
        >
          {s.publish}
        </button>
      </div>
      <div className="flex-1 bg-black">
        {html ? (
          <iframe
            key={frameKey}
            sandbox="allow-scripts allow-pointer-lock"
            srcDoc={html}
            className="w-full h-full border-0"
            title="game preview"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="font-pixel text-[11px] text-gray-700 tracking-widest">{s.emptyPreview}</p>
          </div>
        )}
      </div>
    </div>
  )
}
