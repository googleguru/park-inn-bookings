import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { checkPasswordStrength } from "@/lib/passwordStrength";
import { KeyRound } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const pw = checkPasswordStrength(password);
  const barColors = ["bg-destructive", "bg-destructive", "bg-warning", "bg-warning", "bg-success"];

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when arriving via the email link.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw.ok) {
      toast.error("Password too weak: " + pw.errors[0]);
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. You are now signed in.");
    navigate("/");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm p-6 space-y-5 shadow-xl">
        <div className="text-center space-y-2">
          <KeyRound className="mx-auto h-10 w-10 text-primary" />
          <h1 className="text-xl font-semibold">Set a new password</h1>
          <p className="text-sm text-muted-foreground">
            {ready
              ? "Choose a strong password for your account."
              : "Validating your reset link…"}
          </p>
        </div>

        {ready && (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-pass">New password</Label>
              <Input
                id="new-pass"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8+ chars, mixed case, number, symbol"
              />
              {password.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex gap-1">
                    {[0,1,2,3].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full ${i < pw.score ? barColors[pw.score] : "bg-muted"}`}
                      />
                    ))}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Strength: <span className="font-medium text-foreground">{pw.label}</span>
                  </div>
                  {pw.errors.length > 0 && (
                    <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
                      {pw.errors.slice(0, 3).map(err => <li key={err}>{err}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-pass">Confirm password</Label>
              <Input
                id="confirm-pass"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>

            <Button type="submit" className="w-full h-11" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
};

export default ResetPassword;
