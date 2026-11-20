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
          <span className="font-medium">กำลังโหลด...</span>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !profile) {
    return <Redirect to="/login" />;
  }

  // If role is admin and email is not verified, redirect to verify email page
  if (profile.role === "admin" && !firebaseUser.emailVerified) {
    return <Redirect to="/admin-verify-email" />;
  }

  // Allow admin to view teacher pages, and allow teachers/staff to access admin pages
  const hasAccess =
    profile.role === role ||
    (role === "teacher" && profile.role === "admin") ||
    (role === "admin" && profile.role === "teacher");

  if (!hasAccess) {
    const dest =
      profile.role === "admin"
        ? "/admin"
        : profile.role === "teacher"
        ? "/teacher"
        : profile.role === "parent"
        ? "/parent"
        : "/student";
    return <Redirect to={dest} />;
  }

  return <>{children}</>;
}
