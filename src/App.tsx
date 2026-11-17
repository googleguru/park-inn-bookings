import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { ClientAuthProvider } from "@/contexts/ClientAuthContext";
import { MotionConfig } from "motion/react";
import Index from "./pages/Index";
import AdminPage from "./pages/Admin";
import Profile from "./pages/Profile";
import Setup from "./pages/Setup";
import NotFound from "./pages/NotFound";
import { Dashboard } from "@/components/admin/Dashboard";
import { Bookings } from "@/components/admin/Bookings";
import { Customers } from "@/components/admin/Customers";
import { Money } from "@/components/admin/Money";
import { Activity } from "@/components/admin/Activity";
import { Settings } from "@/components/admin/Settings";

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
    <MotionConfig reducedMotion="user">
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Index />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/setup" element={<Setup />} />

          {/* Admin section — AdminPage wraps all sub-routes in AdminProvider + AdminGuard */}
          <Route path="/admin" element={<AdminPage />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="bookings"  element={<Bookings />} />
            <Route path="customers" element={<Customers />} />
            <Route path="money"     element={<Money />} />
            <Route path="activity"  element={<Activity />} />
            <Route path="settings"  element={<Settings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
    </MotionConfig>
    </ClientAuthProvider>
  </QueryClientProvider>
);

export default App;
