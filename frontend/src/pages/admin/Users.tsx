import { motion, AnimatePresence } from "framer-motion";
import { Search, UserCheck, UserX, Trash2, Mail, ShieldAlert, MoreVertical } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const AdminUsers = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterRole, setFilterRole] = useState("all");

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const idToken = await user?.getIdToken();
            let url = `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/admin/users`;
            const params = new URLSearchParams();
            if (filterRole !== "all") params.append("role", filterRole);
            if (searchTerm) params.append("search", searchTerm);

            const res = await fetch(`${url}?${params.toString()}`, {
                headers: { "Authorization": `Bearer ${idToken}` }
            });
            if (res.ok) setUsers(await res.json());
        } catch (err) {
            console.error("Failed to fetch users:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchUsers();
    }, [user, filterRole]);

    const handleApprove = async (id: string) => {
        try {
            const idToken = await user?.getIdToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/admin/users/${id}/approve`, {
                method: "PATCH",
                headers: { "Authorization": `Bearer ${idToken}` }
            });
            if (res.ok) {
                toast({ title: "Approved!", description: "Teacher account is now active." });
                fetchUsers();
            }
        } catch (err) {
            toast({ title: "Error", description: "Failed to approve user.", variant: "destructive" });
        }
    };

    const handleAction = async (id: string, action: 'suspend' | 'delete') => {
        if (!confirm(`Are you sure you want to ${action} this user?`)) return;
        try {
            const idToken = await user?.getIdToken();
            const method = action === 'delete' ? 'DELETE' : 'PATCH';
            const endpoint = action === 'delete' ? id : `${id}/suspend`;

            const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/admin/users/${endpoint}`, {
                method,
                headers: { "Authorization": `Bearer ${idToken}` }
            });
            if (res.ok) {
                toast({ title: "Success", description: `User ${action}ed.` });
                fetchUsers();
            }
        } catch (err) {
            toast({ title: "Error", description: `Failed to ${action} user.`, variant: "destructive" });
        }
    };

    return (
        <DashboardLayout role="admin">
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h1 className="text-3xl font-black">User Management</h1>
                    <div className="flex gap-2">
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search name or email..."
                                className="pl-10 h-11 rounded-xl bg-card border-border/50"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && fetchUsers()}
                            />
                        </div>
                        <select
                            value={filterRole}
                            onChange={e => setFilterRole(e.target.value)}
                            className="h-11 rounded-xl bg-card border border-border/50 px-4 text-sm font-bold"
                        >
                            <option value="all">All Roles</option>
                            <option value="student">Students</option>
                            <option value="teacher">Teachers</option>
                        </select>
                    </div>
                </div>

                <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border/50 bg-secondary/30">
                                    <th className="p-4 text-xs font-black uppercase tracking-widest text-muted-foreground">User</th>
                                    <th className="p-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Role</th>
                                    <th className="p-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Status</th>
                                    <th className="p-4 text-xs font-black uppercase tracking-widest text-muted-foreground">School Details</th>
                                    <th className="p-4 text-xs font-black uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                <AnimatePresence>
                                    {users.map((u, i) => (
                                        <motion.tr
                                            key={u.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="hover:bg-secondary/20 transition-colors"
                                        >
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary border border-primary/20">
                                                        {u.firstName[0]}{u.lastName[0]}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold">{u.firstName} {u.lastName}</div>
                                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Mail className="w-3 h-3" /> {u.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full border ${u.role === 'teacher' ? 'bg-purple-500/10 text-purple-600 border-purple-500/20' :
                                                        u.role === 'admin' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                                                            'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                                    }`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full ${u.status === 'active' ? 'bg-green-500/10 text-green-600' :
                                                        u.status === 'pending_approval' ? 'bg-amber-500/10 text-amber-600 animate-pulse' :
                                                            'bg-red-500/10 text-red-600'
                                                    }`}>
                                                    {u.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm font-medium">
                                                {u.role === 'student' ? `${u.classLevel || 'N/A'} • ${u.term || 'N/A'}` : 'N/A'}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {u.status === 'pending_approval' && (
                                                        <Button size="sm" onClick={() => handleApprove(u.id)} className="bg-green-500 hover:bg-green-600 h-8 font-black text-[10px] uppercase tracking-wider rounded-lg">
                                                            Approve
                                                        </Button>
                                                    )}
                                                    <Button size="icon" variant="ghost" onClick={() => handleAction(u.id, 'suspend')} className="h-8 w-8 text-amber-500 hover:bg-amber-500/10">
                                                        <UserX className="w-4 h-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" onClick={() => handleAction(u.id, 'delete')} className="h-8 w-8 text-red-500 hover:bg-red-500/10">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                    {!loading && users.length === 0 && (
                        <div className="p-12 text-center text-muted-foreground font-bold">
                            No users found matching your criteria.
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default AdminUsers;
