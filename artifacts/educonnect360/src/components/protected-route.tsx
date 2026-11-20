import { type ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/types";

export function ProtectedRoute({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  const { firebaseUser, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <i className="fa-solid fa-circle-notch fa-spin text-primary text-xl" />
          <span className="font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !profile) {
    return <Redirect to="/login" />;
  }

  if (profile.role !== role) {
    const dest =
      profile.role === "teacher"
        ? "/teacher"
        : profile.role === "parent"
        ? "/parent"
        : "/student";
    return <Redirect to={dest} />;
  }

  return <>{children}</>;
}
