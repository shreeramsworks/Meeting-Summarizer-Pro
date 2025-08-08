
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type AuthFormProps = {
  mode: "login" | "signup";
  onClose: () => void;
};

export default function AuthForm({ mode, onClose }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const handleAuthAction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        if (error) {
          throw error;
        }
        if (data.user) {
           if (data.user.identities?.length === 0) {
              toast({
                  variant: "destructive",
                  title: "Signup Error",
                  description: "This email address is already in use.",
              });
           } else {
              toast({
                title: "Success!",
                description: "Please check your email to confirm your account.",
              });
              onClose();
           }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }
        
        // Use a hard redirect to ensure the page and session are fully refreshed.
        window.location.href = '/dashboard';
      }
    } catch (error: any) {
        toast({
          variant: "destructive",
          title: mode === 'login' ? "Login Failed" : "Signup Failed",
          description: error.message || "An unexpected error occurred. Please try again.",
        });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <div className="flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-primary" />
                </div>
                <DialogTitle className="text-center text-2xl font-bold">
                    {mode === "login" ? "Welcome Back" : "Create an Account"}
                </DialogTitle>
                <DialogDescription className="text-center">
                    {mode === "login"
                        ? "Sign in to access your meeting summaries."
                        : "to start summarizing your meetings."}
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAuthAction} className="space-y-4">
                {mode === "signup" && (
                <div className="space-y-1">
                    <Label htmlFor="full-name">Full Name</Label>
                    <Input
                    id="full-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="John Doe"
                    disabled={isLoading}
                    />
                </div>
                )}
                <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    disabled={isLoading}
                />
                </div>
                <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    disabled={isLoading}
                />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "login" ? "Sign In" : "Sign Up"}
                </Button>
            </form>
        </DialogContent>
    </Dialog>
  );
}
