// apps/web/app/legal/page.tsx — /legal lands on the first policy.
import { redirect } from 'next/navigation';

export default function LegalIndexPage() {
  redirect('/legal/terms');
}
