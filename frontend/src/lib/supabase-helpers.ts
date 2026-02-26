import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "teacher" | "student" | "parent";

export const assignRole = async (userId: string, role: AppRole) => {
  const { error } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role });
  if (error) throw error;
};

export const getUserRoles = async (userId: string): Promise<AppRole[]> => {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  return (data || []).map((r: any) => r.role as AppRole);
};
