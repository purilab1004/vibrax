import LegalPage from '@/components/LegalPage'
import { loadLegal } from '@/lib/legal/load'
export const metadata = { title: 'Marketing Consent' }
export const revalidate = 300
export default async function MarketingConsentPage() { const d = await loadLegal('marketing'); return <LegalPage ko={d.ko} en={d.en} /> }
