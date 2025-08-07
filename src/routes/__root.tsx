/// <reference types="vite/client" />
import { Link, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/tanstack-react-start";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import * as React from "react";
import { getAuth } from "@clerk/tanstack-react-start/server";
import { getWebRequest } from "@tanstack/react-start/server";
import { DefaultCatchBoundary } from "@/components/DefaultCatchBoundary";
import { NotFound } from "@/components/NotFound";
import { ClerkAuthProvider } from "@/components/auth/clerk-provider";
import { ConvexProvider } from "@/components/ConvexProvider";
import "@/styles/app.css";

const fetchClerkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const { userId } = await getAuth(getWebRequest()!);

  return {
    userId,
  };
});

export const Route = createRootRoute({
  beforeLoad: async () => {
    const { userId } = await fetchClerkAuth();

    return {
      userId,
    };
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
    ],
    links: [
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      { rel: "manifest", href: "/site.webmanifest", color: "#fffff" },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  errorComponent: (props: any) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    );
  },
  notFoundComponent: () => <NotFound />,
  component: () => (
    <ClerkAuthProvider>
      <ConvexProvider>
        <RootDocument>
          <Outlet />
          <TanStackRouterDevtools position="bottom-right" />
        </RootDocument>
      </ConvexProvider>
    </ClerkAuthProvider>
  ),
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
