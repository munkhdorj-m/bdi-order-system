import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UserRole = "admin" | "rep" | "buyer";

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  supermarket_id: string | null;
  active: boolean;
};

export type SessionContext = {
  userId: string;
  email: string | null;
  profile: Profile;
};

export async function getSession(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, supermarket_id, active")
    .eq("id", user.id)
    .single();

  if (error || !profile) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: profile as Profile,
  };
}

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export function homePathForRole(profile: Profile): string {
  if (!profile.active) return "/inactive";
  switch (profile.role) {
    case "admin":
      return "/admin";
    case "rep":
      return "/rep";
    case "buyer":
      return profile.supermarket_id ? "/catalog" : "/pending";
  }
}
