import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { LoadingSpinner } from "./ui";

/**
 * Gate for pages that need a signed-in user.
 *
 * Waits for the stored session to be checked before deciding, otherwise a
 * reload on /orders would bounce to the sign-in page for a split second. The
 * attempted location is passed along so sign-in can return the user to it.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner label="Checking your session" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
