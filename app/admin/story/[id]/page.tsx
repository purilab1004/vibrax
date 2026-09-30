import StoryEpisodeForm from '@/components/admin/StoryEpisodeForm'

export default async function EditStoryEpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <StoryEpisodeForm postId={id} />
}
