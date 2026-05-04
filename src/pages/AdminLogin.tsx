import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2, AlertCircle, Lock, Users, FileText, BarChart3 } from 'lucide-react';

const FEATURES = [
  { icon: BarChart3, label: 'Dashboard & Metrics',    desc: 'Real-time booking overview and revenue summary' },
  { icon: Users,     label: 'User Management',         desc: 'View customers, block/allow access' },
  { icon: FileText,  label: 'Financial Ledger',        desc: 'Double-entry accounting with CSV export' },
  { icon: Lock,      label: 'Role-Based Access',       desc: 'Super Admin · Admin · Finance Manager' },
];

export function AdminLogin() {
  const { adminUser, loading, authError, signInWithGoogle, clearError } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (adminUser) navigate('/admin/dashboard', { replace: true });
  }, [adminUser, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 size={32} className="animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Verifying access…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left — branding */}
        <div className="hidden lg:block space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
              <Shield size={24} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Park Inn Admin</h1>
              <p className="text-sm text-muted-foreground">Secure Management Portal</p>
            </div>
          </div>

          <p className="text-muted-foreground leading-relaxed">
            Manage bookings, track finances, and oversee all operations for Dhanlakshmi Park Inn — all from one secure dashboard.
          </p>

          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={15} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — login card */}
        <Card className="shadow-xl border-border">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-md mb-3 lg:hidden">
              <Shield size={28} className="text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">Admin Sign In</CardTitle>
            <CardDescription>
              Access restricted to authorised administrators only
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {authError && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3.5">
                <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Access Denied</p>
                  <p className="text-xs text-destructive/80 mt-0.5">{authError}</p>
                  <button
                    className="text-xs text-destructive underline mt-1"
                    onClick={clearError}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <Button
              className="w-full gap-3 h-11 text-sm font-medium"
              onClick={signInWithGoogle}
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {loading ? 'Signing in…' : 'Continue with Google'}
            </Button>

            <div className="rounded-lg bg-muted p-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Security Notice</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Only whitelisted email addresses can access this panel</li>
                <li>• All actions are logged for security compliance</li>
                <li>• Sessions expire automatically after inactivity</li>
                <li>• Enforced via Google OAuth 2.0 + Supabase Auth</li>
              </ul>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Having trouble? Contact your super admin to get whitelisted.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
