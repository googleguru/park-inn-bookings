import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAdmin } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { BlurFade } from '@/components/magicui/blur-fade';
import { BorderBeam } from '@/components/magicui/border-beam';
import heroImage from '@/assets/venue-hero.webp';
import { AlertCircle, ArrowLeft, Clock, Fingerprint, Loader2, ScrollText, ShieldCheck, Smartphone } from 'lucide-react';

const PROTECTIONS = [
  { icon: Fingerprint, label: 'Google accounts only',  desc: 'Password sign-ins never receive admin rights' },
  { icon: Smartphone,  label: 'One device at a time',  desc: 'Signing in elsewhere ends the previous session' },
  { icon: Clock,       label: 'Auto-lock',             desc: 'Locks after 15 minutes without activity' },
  { icon: ScrollText,  label: 'Full audit trail',      desc: 'Sign-ins and admin changes are recorded' },
];

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export function AdminLogin() {
  const { adminUser, loading, authError, signInWithGoogle, clearError } = useAdmin();
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

            <Button
              className="mt-6 h-12 w-full gap-3 rounded-xl border border-border bg-background text-sm font-medium text-foreground shadow-sm hover:bg-muted"
              onClick={signInWithGoogle}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon />}
              {loading ? 'Verifying access…' : 'Continue with Google'}
            </Button>

            <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
              Signing in here ends any admin session open on another device.
              Need access? Ask a super admin to add your Google account.
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
