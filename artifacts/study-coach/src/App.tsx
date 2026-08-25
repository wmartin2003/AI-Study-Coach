import { type ReactElement, type ReactNode, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/dashboard";
import CoursePage from "@/pages/course";
import TutorPage from "@/pages/tutor";
import QuizPage from "@/pages/quiz";
import NewCoursePage from "@/pages/new-course";
import LoginPage from "@/pages/login";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Route, Switch, useLocation, Router as WouterRouter } from "wouter";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: () => ReactElement }) {
  const { session, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !session) setLocation("/login");
  }, [loading, session, setLocation]);

  if (loading) return null;
  if (!session) return null;
  return <Component />;
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
        <Route path="/" component={() => <ProtectedRoute component={DashboardPage} />} />
        <Route path="/course" component={() => <ProtectedRoute component={CoursePage} />} />
        <Route path="/tutor" component={() => <ProtectedRoute component={TutorPage} />} />
        <Route path="/quiz" component={() => <ProtectedRoute component={QuizPage} />} />
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
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
