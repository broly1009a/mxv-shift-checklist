import { redirect } from 'next/navigation';

export default function CcpCeRedirectPage() {
  redirect('/trading-manager?tab=CCP_CLEARING');
}
