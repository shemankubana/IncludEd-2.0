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
import { BookOpen, Home, BookHeadphones, LayoutDashboard, Settings, LogOut, Bell, User } from "lucide-react";
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
    const { user, logout } = useAuth();

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
        { title: "Live Classes", url: "/teacher/classes", icon: <Bell className="w-5 h-5" /> },
        { title: "Upload Content", url: "/teacher/create", icon: <Settings className="w-5 h-5" /> },
        { title: "My Content", url: "/teacher/my-content", icon: <BookOpen className="w-5 h-5" /> },
    ];

    const navItems = role === "student" ? studentNav : teacherNav;

    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full bg-background">
                <Sidebar className="border-r border-border shadow-sm">
                    <SidebarHeader className="p-6">
                        <div className="flex items-center justify-center">
                            <img src="/logo.png" alt="IncludEd Logo" className="w-32 h-auto" />
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
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                    <User className="w-4 h-4" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-xs font-bold truncate">{user?.displayName || "User"}</p>
                                    <p className="text-[10px] text-muted-foreground truncate capitalize">{role}</p>
                                </div>
                            </div>
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
                            <h2 className="text-sm font-bold tracking-tight text-muted-foreground">
                                Dashboard
                            </h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <ThemeToggle />
                            <div className="p-1 px-3 rounded-full bg-accent/10 border border-accent/20 text-accent text-[10px] font-bold flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                AI Active
                            </div>
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
