import LegalPage from '@/components/LegalPage'
import { loadLegal } from '@/lib/legal/load'

export const metadata = { title: 'Privacy Policy' }

export const revalidate = 300

export default async function PrivacyPage() {
  const d = await loadLegal('privacy')
  return <LegalPage ko={d.ko} en={d.en} />
}
