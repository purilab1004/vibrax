import { redirect } from 'next/navigation'
// 이전 주소 — /gallery 로 이동
export default function LibraryRedirect() { redirect('/gallery') }
