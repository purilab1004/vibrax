import LegalPage from '@/components/LegalPage'
import { loadLegal } from '@/lib/legal/load'

export const metadata = { title: 'Terms of Service' }

export const revalidate = 300

export default async function TermsPage() {
  const d = await loadLegal('terms')
  return <LegalPage ko={d.ko} en={d.en} />
}
