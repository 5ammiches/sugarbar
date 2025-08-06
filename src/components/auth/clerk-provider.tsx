import { ClerkProvider } from "@clerk/tanstack-react-start";
import { ReactNode } from "react";

interface ClerkAuthProviderProps {
  children: ReactNode;
}

export function ClerkAuthProvider({ children }: ClerkAuthProviderProps) {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error("Missing Clerk Publishable Key");
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      // signInFallbackRedirectUrl="/admin"
      // signUpFallbackRedirectUrl="/admin"
      // afterSignOutUrl="/admin/sign-in"
      // signInUrl="/admin/sign-in"
      // signUpUrl="/admin/sign-in"
    >
      {children}
    </ClerkProvider>
  );
}
