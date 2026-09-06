import { type ReactElement, type ReactNode, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import PrivacyPage from "@/pages/privacy";
import DashboardPage from "@/pages/dashboard";
import CoursePage from "@/pages/course";
import TutorPage from "@/pages/tutor";
import QuizPage from "@/pages/quiz";
import NewCoursePage from "@/pages/new-course";
import OnboardingPage from "@/pages/onboarding";
import AchievementsPage from "@/pages/achievements";
import ProfilePage from "@/pages/profile";
import SettingsPage from "@/pages/settings";
import LoginPage from "@/pages/login";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme";
import { getGetProfileQueryKey, useGetProfile } from "@workspace/api-client-react";
import { Route, Switch, useLocation, Router as WouterRouter } from "wouter";

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !session) setLocation("/login");
  }, [loading, session, setLocation]);

  if (loading || !session) return null;
  return <>{children}</>;
}

function ProtectedRoute({ component: Component }: { component: () => ReactElement }) {
  const { session } = useAuth();
  const [, setLocation] = useLocation();
  const profileQuery = useGetProfile({
    query: { queryKey: getGetProfileQueryKey(), enabled: !!session },
  });

  useEffect(() => {
    if (profileQuery.data && !profileQuery.data.onboardingCompleted) setLocation("/onboarding");
  }, [profileQuery.data, setLocation]);

  return (
    <RequireAuth>
      {profileQuery.data && !profileQuery.data.onboardingCompleted ? null : <Component />}
    </RequireAuth>
  );
}

// `/` is the one route that isn't uniformly public or protected: a
// logged-out visitor needs something to evaluate (the landing page), while
// a signed-in student lands on their dashboard. Everything else keeps its
// existing all-public or all-protected behavior.
function HomeRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <LandingPage />;
  return <ProtectedRoute component={DashboardPage} />;
}

function Router() {
  const { session, loading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && session && location === "/login") setLocation("/");
  }, [loading, session, location, setLocation]);

  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/onboarding" component={() => <RequireAuth><OnboardingPage /></RequireAuth>} />
        <Route path="/" component={HomeRoute} />
        <Route path="/course" component={() => <ProtectedRoute component={CoursePage} />} />
        <Route path="/tutor" component={() => <ProtectedRoute component={TutorPage} />} />
        <Route path="/quiz" component={() => <ProtectedRoute component={QuizPage} />} />
        <Route path="/achievements" component={() => <ProtectedRoute component={AchievementsPage} />} />
        <Route path="/profile" component={() => <ProtectedRoute component={ProfilePage} />} />
        <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
        <Route path="/courses/new" component={() => <ProtectedRoute component={NewCoursePage} />} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
