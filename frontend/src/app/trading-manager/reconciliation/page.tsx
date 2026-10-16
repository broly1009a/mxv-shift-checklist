import { redirect } from 'next/navigation';

export default function ReconRedirectPage() {
  redirect('/trading-manager?tab=RECON_OPS');
}
