// lib/llm/usage.ts — llm_usage 기록 (service role). 실패해도 본 흐름을 막지 않는다.
import { createAdminClient } from '@/lib/supabase/admin'
import { costUsd } from './pricing'

export type UsageKind = 'create' | 'edit' | 'template' | 'template_edit' | 'explain' | 'from_image' | 'bj_chat'

export async function logUsage(row: {
  userId?: string | null
  projectId?: string | null
  versionId?: string | null
  kind: UsageKind
  model: string
  inputTokens?: number
  outputTokens?: number
  credits?: number
  templateSlug?: string | null
  meta?: Record<string, unknown>
}): Promise<void> {
  try {
    const input = row.inputTokens ?? 0, output = row.outputTokens ?? 0
    await createAdminClient().from('llm_usage').insert([{
      user_id: row.userId ?? null,
      project_id: row.projectId ?? null,
      version_id: row.versionId ?? null,
      kind: row.kind,
      model: row.model,
      input_tokens: input,
      output_tokens: output,
      cost_usd: costUsd(row.model, input, output),
      credits: row.credits ?? 0,
      template_slug: row.templateSlug ?? null,
      meta: row.meta ?? null,
    }] as never)
  } catch (e) {
    console.error('[llm_usage] insert failed', e)
  }
}
