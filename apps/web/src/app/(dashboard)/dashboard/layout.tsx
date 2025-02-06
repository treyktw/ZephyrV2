// app/(dashboard)/layout.tsx
import { auth } from '@/auth';
import { DashboardSidebar } from '@/components/dsahboard/sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div>
      <DashboardSidebar user={session?.user ?? {}} />
      <main>{children}</main>
    </div>
  );
}
