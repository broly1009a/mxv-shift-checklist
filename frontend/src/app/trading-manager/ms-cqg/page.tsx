import { redirect } from 'next/navigation';

export default function MsCqgRedirectPage() {
  redirect('/trading-manager?tab=RECON_OPS');
}
