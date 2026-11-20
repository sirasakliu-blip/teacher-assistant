import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Login from '@/pages/login';
import Register from '@/pages/register';
import AdminRegister from '@/pages/admin-register';
import AdminVerifyEmail from '@/pages/admin-verify-email';
import ParentView from '@/pages/parent-view';
import ParentLiff from '@/pages/parent-liff';
import TeacherHome from '@/pages/teacher-home';
import TeacherClass from '@/pages/teacher-class';
import TeacherGradebook from '@/pages/teacher-gradebook';
import TeacherAiAssistant from '@/pages/teacher-ai-assistant';
import TeacherLeaveRequests from '@/pages/teacher-leave-requests';
import AdminDashboard from '@/pages/admin-dashboard';
import StudentHome from '@/pages/student-home';
import StudentClass from '@/pages/student-class';
import ParentPortal from '@/pages/parent-portal';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/protected-route';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/admin-register" component={AdminRegister} />
      <Route path="/admin-verify-email" component={AdminVerifyEmail} />
      <Route path="/parent-view" component={ParentView} />
      <Route path="/parent-liff" component={ParentLiff} />

      <Route path="/teacher">
        <ProtectedRoute role="teacher">
          <TeacherHome />
        </ProtectedRoute>
      </Route>
      <Route path="/teacher/classes/:classId">
        <ProtectedRoute role="teacher">
          <TeacherClass />
        </ProtectedRoute>
      </Route>
      <Route path="/teacher/classes/:classId/assignments/:assignmentId">
        <ProtectedRoute role="teacher">
          <TeacherGradebook />
        </ProtectedRoute>
      </Route>
      <Route path="/teacher/ai-assistant">
        <ProtectedRoute role="teacher">
          <TeacherAiAssistant />
        </ProtectedRoute>
      </Route>
      <Route path="/teacher/leave-requests">
        <ProtectedRoute role="teacher">
          <TeacherLeaveRequests />
        </ProtectedRoute>
      </Route>

      <Route path="/teacher/invites">
        <ProtectedRoute role="admin">
          <AdminDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/admin">
        <ProtectedRoute role="admin">
          <AdminDashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/student">
        <ProtectedRoute role="student">
          <StudentHome />
        </ProtectedRoute>
      </Route>
      <Route path="/student/classes/:classId">
        <ProtectedRoute role="student">
          <StudentClass />
        </ProtectedRoute>
      </Route>
      <Route path="/parent">
        <ProtectedRoute role="parent">
          <ParentPortal />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
