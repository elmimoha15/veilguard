import { Metadata } from 'next';
import ProClient from '@/components/ui/ProClient';

export const metadata: Metadata = {
  title: 'Pro — See Everything. Fix Everything',
  description: 'Full security scanning. All findings, fixes, Supabase RLS audit, Firebase audit, security grade. $19/mo.',
};

export default function ProPage() {
  return (
    <div className="py-[140px] px-6 md:px-12 lg:px-16 max-w-[1200px] mx-auto min-h-screen">
      <ProClient />
    </div>
  );
}
