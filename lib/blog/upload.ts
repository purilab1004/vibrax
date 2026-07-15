import type { SupabaseClient } from '@supabase/supabase-js'

// blog-images 공개 버킷에 업로드하고 public URL 반환. 실패 시 null.
export async function uploadBlogImage(supabase: SupabaseClient, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('blog-images').upload(path, file, { upsert: false })
  if (error) {
    console.error('[blog]', error)
    return null
  }
  return supabase.storage.from('blog-images').getPublicUrl(path).data.publicUrl
}
