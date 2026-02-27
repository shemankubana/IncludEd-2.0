import { motion } from "framer-motion";
import { School, Globe, Mail, ShieldCheck, MapPin, Hash, Camera, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const AdminProfile = () => {
    const { user, profile } = useAuth();
    const [school, setSchool] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        const fetchSchool = async () => {
            try {
                const idToken = await user?.getIdToken();
                const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/schools/mine`, {
                    headers: { "Authorization": `Bearer ${idToken}` }
                });
                if (res.ok) setSchool(await res.json());
            } catch (err) {
                console.error("Failed to fetch school profile:", err);
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchSchool();
    }, [user]);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const idToken = await user?.getIdToken();
            const formData = new FormData();
            formData.append("logo", file);

            const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/schools/mine`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${idToken}` },
                body: formData
            });

            if (res.ok) {
                const updatedSchool = await res.json();
                setSchool(updatedSchool);
            }
        } catch (err) {
            console.error("Logo upload failed:", err);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <DashboardLayout role="admin">
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-black mb-2">School Profile</h1>
                    <p className="text-muted-foreground font-medium">Manage your institution's public identity on IncludEd.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <Card className="md:col-span-2 rounded-[32px] border-border/50 shadow-xl overflow-hidden bg-card/50 backdrop-blur-xl">
                        <CardHeader className="bg-primary/5 border-b border-border/50 p-8">
                            <div className="flex items-center gap-6">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-[32px] bg-white border-4 border-white shadow-2xl flex items-center justify-center overflow-hidden">
                                        {school?.logoUrl ? (
                                            <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${school.logoUrl}`} alt="Logo" className="w-full h-full object-cover" />
                                        ) : (
                                            <School className="w-10 h-10 text-primary/20" />
                                        )}
                                        {isUploading && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <Loader2 className="w-6 h-6 text-white animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                    <label className="absolute -right-2 -bottom-2 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform">
                                        <Camera className="w-4 h-4" />
                                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={isUploading} />
                                    </label>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black">{school?.name || "Loading..."}</h2>
                                    <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest mt-1">
                                        <ShieldCheck className="w-4 h-4" /> Verified Institution
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <Hash className="w-3 h-3" /> Registration Code
                                    </p>
                                    <p className="text-lg font-bold text-primary">{school?.code}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <Globe className="w-3 h-3" /> Email Domain
                                    </p>
                                    <p className="text-lg font-bold">@{school?.emailDomain || "None restricted"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <MapPin className="w-3 h-3" /> Location
                                    </p>
                                    <p className="text-lg font-bold">{school?.city}, {school?.country}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <Mail className="w-3 h-3" /> System Contact
                                    </p>
                                    <p className="text-lg font-bold">{profile?.email}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card className="rounded-[32px] border-primary/20 bg-primary/5 shadow-none p-6">
                            <h3 className="font-black text-sm uppercase tracking-widest mb-4">Security Notice</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                School codes are unique. Do not share your registration code publicly.
                                Only provide it to authorized staff and students.
                            </p>
                        </Card>

                        <div className="p-8 rounded-[32px] border border-dashed border-border flex flex-col items-center justify-center text-center gap-4 bg-secondary/10">
                            <div className="w-12 h-12 rounded-2xl bg-background border border-border flex items-center justify-center shadow-lg">
                                <Globe className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest">Public Website</p>
                                <p className="text-sm text-muted-foreground mt-1">Not configured</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default AdminProfile;
