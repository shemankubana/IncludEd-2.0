import React from "react";
import {
    SidebarProvider,
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarInset,
    SidebarTrigger
} from "@/components/ui/sidebar";
import { BookOpen, Home, BookHeadphones, LayoutDashboard, Settings, LogOut, Bell, User, Users, ShieldCheck, GraduationCap, Type } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
    title: string;
    url: string;
    icon: React.ReactNode;
}

interface DashboardLayoutProps {
    children: React.ReactNode;
    role: "student" | "teacher" | "admin";
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, role }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, profile, logout, previewMode, setPreviewMode, dyslexicMode, setDyslexicMode } = useAuth();
    const effectiveRole = previewMode ? "student" : role;

    const handleLogout = async () => {
        try {
            await logout();
            navigate("/auth");
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    const studentNav: NavItem[] = [
        { title: "Home", url: "/student/dashboard", icon: <Home className="w-5 h-5" /> },
        { title: "My Lessons", url: "/student/lessons", icon: <BookOpen className="w-5 h-5" /> },
        { title: "Achievements", url: "/student/achievements", icon: <BookHeadphones className="w-5 h-5" /> },
    ];

    const teacherNav: NavItem[] = [
        { title: "Overview", url: "/teacher/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
        { title: "Upload Content", url: "/teacher/create", icon: <Settings className="w-5 h-5" /> },
        { title: "My Content", url: "/teacher/my-content", icon: <BookOpen className="w-5 h-5" /> },
        { title: "Profile", url: "/teacher/profile", icon: <User className="w-5 h-5" /> },
    ];

    const adminNav: NavItem[] = [
        { title: "Dashboard", url: "/admin/dashboard", icon: <ShieldCheck className="w-5 h-5" /> },
        { title: "User Roster", url: "/admin/users", icon: <Users className="w-5 h-5" /> },
        { title: "School Profile", url: "/admin/profile", icon: <GraduationCap className="w-5 h-5" /> },
    ];

    const navItems = effectiveRole === "student" ? studentNav : effectiveRole === "admin" ? adminNav : teacherNav;

    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full bg-background">
                <Sidebar className="border-r border-border shadow-sm">
                    <SidebarHeader className="p-6">
                        <div className="flex flex-col items-center justify-center gap-2">
                            {profile?.school?.logoUrl ? (
                                <div className="w-20 h-20 rounded-2xl bg-white border border-border shadow-sm flex items-center justify-center overflow-hidden">
                                    <img
                                        src={`${import.meta.env.VITE_API_URL || "http://localhost:3000"}${profile.school.logoUrl}`}
                                        alt={profile.school.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            ) : (
                                <img src="/logo.png" alt="IncludEd Logo" className="w-28 h-auto" />
                            )}
                            {profile?.school && (
                                <p className="text-[10px] font-black uppercase text-primary tracking-widest text-center px-4 leading-tight">
                                    {profile.school.name}
                                </p>
                            )}
                        </div>
                    </SidebarHeader>

                    <SidebarContent className="px-3">
                        <SidebarGroup>
                            <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                Menu
                            </SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {navItems.map((item) => (
                                        <SidebarMenuItem key={item.title}>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={location.pathname === item.url}
                                                className="rounded-xl h-11 px-4 mb-1 transition-all hover:bg-primary/5 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                                            >
                                                <Link to={item.url} className="flex items-center gap-3">
                                                    {item.icon}
                                                    <span className="font-semibold">{item.title}</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    </SidebarContent>

                    <SidebarFooter className="p-4 mt-auto">
                        <div className="p-4 rounded-2xl bg-secondary/50 border border-border flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
                                    {profile?.firstName?.[0] || user?.email?.[0] || 'U'}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-xs font-bold truncate">{profile?.firstName || user?.displayName || "User"}</p>
                                    <p className="text-[10px] text-muted-foreground truncate capitalize">
                                        {effectiveRole} {previewMode && "(Preview)"}
                                    </p>
                                </div>
                            </div>

                            {role === "teacher" && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full justify-start gap-2 h-8 text-[10px] font-bold uppercase tracking-wider"
                                    onClick={() => setPreviewMode(!previewMode)}
                                >
                                    <User className="w-3.5 h-3.5" />
                                    {previewMode ? "Back to Teacher" : "Preview as Student"}
                                </Button>
                            )}

                            {effectiveRole === "student" && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={`w-full justify-start gap-2 h-8 text-[10px] font-bold uppercase tracking-wider transition-all ${dyslexicMode ? 'bg-primary/10 border-primary text-primary' : ''}`}
                                    onClick={() => setDyslexicMode(!dyslexicMode)}
                                >
                                    <Type className="w-3.5 h-3.5" />
                                    {dyslexicMode ? "Standard Font" : "Dyslexia Friendly"}
                                </Button>
                            )}

                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start gap-2 h-8 text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                onClick={handleLogout}
                            >
                                <LogOut className="w-3.5 h-3.5" /> Log Out
                            </Button>
                        </div>
                    </SidebarFooter>
                </Sidebar>

                <SidebarInset className="flex flex-col flex-1 overflow-hidden">
                    <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/50 backdrop-blur-md sticky top-0 z-30">
                        <div className="flex items-center gap-4">
                            <SidebarTrigger className="md:hidden" />
                            <div className="h-4 w-px bg-border hidden md:block" />
                            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                                {location.pathname.split('/').pop()?.replace('-', ' ')}
                            </h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <ThemeToggle />
                            {effectiveRole !== "student" && (
                                <div className="p-1 px-3 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                    AI Active
                                </div>
                            )}
                        </div>
                    </header>

                    <main className="flex-1 overflow-y-auto p-6 md:p-10">
                        {children}
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
};

export default DashboardLayout;
