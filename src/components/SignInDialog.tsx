import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { isValidEmail } from "@/lib/security";

interface EmailCodeFormProps {
  onSendCode: (email: string) => Promise<void>;
  onVerify: (email: string, code: string) => Promise<void>;
  /** Shown on the code step, e.g. to explain that only admins receive a code. */
  sentHint?: string;
  submitLabel?: string;
}

/** Two-step email sign-in: enter email → enter the 6-digit code we emailed. */
export function EmailCodeForm({ onSendCode, onVerify, sentHint, submitLabel = "Send code" }: EmailCodeFormProps) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!isValidEmail(clean)) {
      setError("Please enter a valid email address.");
      emailRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSendCode(clean);
      setEmail(clean);
      setCode("");
      setStep("code");
      setCooldown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onVerify(email, value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work.");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  if (step === "email") {
    return (
      <form onSubmit={send} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signin-email">Email address</Label>
          <Input
            id="signin-email"
            ref={emailRef}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@gmail.com"
            className="h-12 rounded-xl"
          />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="h-12 w-full gap-2 rounded-xl" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {busy ? "Sending…" : submitLabel}
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>.
        {sentHint && <span className="mt-1 block">{sentHint}</span>}
      </p>
      <div className="flex justify-center">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(v) => {
            const digits = v.replace(/\D/g, "");
            setCode(digits);
            if (digits.length === 6) verify(digits);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          aria-label="6-digit code"
          disabled={busy}
        >
          <InputOTPGroup>
            {Array.from({ length: 6 }).map((_, i) => (
              <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg" />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
      <Button className="h-12 w-full rounded-xl" disabled={busy || code.length !== 6} onClick={() => verify()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={() => { setStep("email"); setError(null); }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Change email
        </button>
        <button
          type="button"
          className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
          disabled={cooldown > 0 || busy}
          onClick={() => send()}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </div>
  );
}

interface SignInDialogProps extends EmailCodeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
}

export default function SignInDialog({ open, onOpenChange, title, description, ...form }: SignInDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl p-7">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* Remount per open so a reopened dialog starts at the email step. */}
        {open && <EmailCodeForm {...form} />}
      </DialogContent>
    </Dialog>
  );
}
