import MeetingSummarizer from '@/components/MeetingSummarizer';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/');
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MeetingSummarizer />
    </div>
  );
}
