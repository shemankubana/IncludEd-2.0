import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/use-theme";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Welcome from "./pages/Welcome";
import StudentDashboard from "./pages/student/Dashboard";
import LessonLibrary from "./pages/student/Lessons";
import AdaptiveReader from "./pages/student/Reader";
import ComprehensionQuiz from "./pages/student/Quiz";
import AchievementHall from "./pages/student/Achievements";
import TeacherDashboard from "./pages/teacher/Dashboard";
import CreateContent from "./pages/teacher/CreateContent";
import MyContent from "./pages/teacher/MyContent";
import PendingApproval from "./pages/teacher/PendingApproval";

// Dashboard Components
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminProfile from "./pages/admin/Profile";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";

// Auth & Protection
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/welcome" element={<Welcome />} />

              {/* Student Routes */}
              <Route path="/student/dashboard" element={<ProtectedRoute requiredRole="student"><StudentDashboard /></ProtectedRoute>} />
              <Route path="/student/lessons" element={<ProtectedRoute requiredRole="student"><LessonLibrary /></ProtectedRoute>} />
              <Route path="/student/reader/:id" element={<ProtectedRoute requiredRole="student"><AdaptiveReader /></ProtectedRoute>} />
              <Route path="/student/quiz/:id" element={<ProtectedRoute requiredRole="student"><ComprehensionQuiz /></ProtectedRoute>} />
              <Route path="/student/achievements" element={<ProtectedRoute requiredRole="student"><AchievementHall /></ProtectedRoute>} />

              {/* Teacher Routes */}
              <Route path="/teacher/dashboard" element={<ProtectedRoute requiredRole="teacher"><TeacherDashboard /></ProtectedRoute>} />
              <Route path="/teacher/create" element={<ProtectedRoute requiredRole="teacher"><CreateContent /></ProtectedRoute>} />
              <Route path="/teacher/my-content" element={<ProtectedRoute requiredRole="teacher"><MyContent /></ProtectedRoute>} />
              <Route path="/teacher/pending" element={<PendingApproval />} />

              {/* Admin Routes */}
              <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/profile" element={<ProtectedRoute requiredRole="admin"><AdminProfile /></ProtectedRoute>} />

              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
