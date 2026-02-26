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
import NotFound from "./pages/NotFound";

import { AuthProvider } from "./contexts/AuthContext";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/student/dashboard" element={<StudentDashboard />} />
              <Route path="/student/lessons" element={<LessonLibrary />} />
              <Route path="/student/reader/:id" element={<AdaptiveReader />} />
              <Route path="/student/quiz/:id" element={<ComprehensionQuiz />} />
              <Route path="/student/achievements" element={<AchievementHall />} />
              <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
              <Route path="/teacher/create" element={<CreateContent />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
