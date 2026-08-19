import LegalPage from '@/components/LegalPage'
import { loadLegal } from '@/lib/legal/load'

export const metadata = { title: 'Refund Policy' }

export const revalidate = 300

export default async function RefundPage() {
  const d = await loadLegal('refund')
  return <LegalPage ko={d.ko} en={d.en} />
}
