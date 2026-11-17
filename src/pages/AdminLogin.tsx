import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAdmin } from '@/contexts/AdminContext';
import { EmailCodeForm } from '@/components/SignInDialog';
import { BlurFade } from '@/components/magicui/blur-fade';
import { BorderBeam } from '@/components/magicui/border-beam';
import heroImage from '@/assets/venue-hero.webp';
import { AlertCircle, ArrowLeft, Clock, Mail, ScrollText, ShieldCheck, Smartphone } from 'lucide-react';

const PROTECTIONS = [
  { icon: Mail,        label: 'Admin Gmail only',      desc: 'Codes go only to approved admin Gmail addresses' },
  { icon: Smartphone,  label: 'One device at a time',  desc: 'Signing in elsewhere ends the previous session' },
  { icon: Clock,       label: 'Auto-lock',             desc: 'Locks after 15 minutes without activity' },
  { icon: ScrollText,  label: 'Full audit trail',      desc: 'Sign-ins and changes are saved to your Google Sheet' },
];

export function AdminLogin() {
  const { adminUser, authError, sendCode, verifyCode, clearError } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (adminUser) navigate('/admin/dashboard', { replace: true });
  }, [adminUser, navigate]);

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-secondary lg:block">
        <motion.img
          src={heroImage}
          alt=""
          aria-hidden="true"
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/60 to-secondary/20" />
        <div className="relative flex h-full flex-col justify-between p-12 text-secondary-foreground">
          <Link to="/" className="inline-flex w-fit items-center gap-2 text-sm text-secondary-foreground/70 transition-colors hover:text-secondary-foreground">
            <ArrowLeft size={14} /> Back to website
          </Link>
          <div className="max-w-md space-y-8">
            <BlurFade delay={0.1}>
              <p className="text-[11px] uppercase tracking-[0.3em] text-gold">Admin console</p>
              <h1 className="mt-3 text-5xl font-semibold leading-[1.05]">
                Dhanlakshmi <span className="whitespace-nowrap italic text-gold">Park Inn</span>
              </h1>
            </BlurFade>
            <div className="grid grid-cols-2 gap-3">
              {PROTECTIONS.map(({ icon: Icon, label, desc }, i) => (
                <BlurFade key={label} delay={0.2 + i * 0.06}>
                  <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                    <Icon size={16} className="text-gold" />
                    <p className="mt-3 text-sm font-medium">{label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-secondary-foreground/60">{desc}</p>
                  </div>
                </BlurFade>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="flex items-center justify-center bg-background p-6">
        <BlurFade className="w-full max-w-sm">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-elegant">
            <BorderBeam size={90} duration={9} colorFrom="hsl(var(--gold))" colorTo="hsl(var(--primary))" />
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
              <ShieldCheck size={24} className="text-gold" />
            </div>
            <h2 className="text-center text-2xl font-semibold">Admin sign in</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Restricted to approved administrators.
            </p>

            {authError && (
              <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
                <div className="text-left">
                  <p className="text-sm text-destructive">{authError}</p>
                  <button className="mt-1 text-xs text-destructive/80 underline" onClick={clearError}>
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6">
              <EmailCodeForm
                onSendCode={sendCode}
                onVerify={verifyCode}
                submitLabel="Email me a sign-in code"
                sentHint="Codes are only sent to admin accounts — check your Gmail inbox."
              />
            </div>

            <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
              Signing in here ends any admin session open on another device.
              Need access? Ask the owner to add your Gmail address in Settings.
            </p>
          </div>
          <Link to="/" className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground lg:hidden">
            <ArrowLeft size={14} /> Back to website
          </Link>
        </BlurFade>
      </div>
    </div>
  );
}
