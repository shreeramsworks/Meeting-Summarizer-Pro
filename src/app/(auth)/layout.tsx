import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {redirect} from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
      <>
        {children}
      </>
  );
}
