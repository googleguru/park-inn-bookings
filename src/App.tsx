import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { ClientAuthProvider } from "@/contexts/ClientAuthContext";
import Index from "./pages/Index";
import AdminPage from "./pages/Admin";
import Profile from "./pages/Profile";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import { DashboardOverview } from "@/components/admin/DashboardOverview";
import { BookingManagement } from "@/components/admin/BookingManagement";
import { LedgerSystem } from "@/components/admin/LedgerSystem";
import { UserManagement } from "@/components/admin/UserManagement";
import { AuditLogs } from "@/components/admin/AuditLogs";
import { EventManagement } from "@/components/admin/EventManagement";
import { AdminSettings } from "@/components/admin/AdminSettings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ClientAuthProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Index />} />
          <Route path="/profile" element={<Profile />} />

          {/* Admin section — AdminPage wraps all sub-routes in AdminProvider + AdminGuard */}
          <Route path="/admin" element={<AdminPage />}>
            <Route path="dashboard"  element={<DashboardOverview />} />
            <Route path="bookings"   element={<BookingManagement />} />
            <Route path="ledger"     element={<LedgerSystem />} />
            <Route path="users"      element={<UserManagement />} />
            <Route path="events"     element={<EventManagement />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="settings"   element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
    </ClientAuthProvider>
  </QueryClientProvider>
);

export default App;
