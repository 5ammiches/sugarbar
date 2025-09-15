/// <reference types="vite/client" />
import { ClerkAuthProvider } from "@/components/auth/clerk-provider";
import { ConvexProvider } from "@/components/ConvexProvider";
import { DefaultCatchBoundary } from "@/components/DefaultCatchBoundary";
import { NotFound } from "@/components/NotFound";
import "@/styles/app.css";
import { getAuth } from "@clerk/tanstack-react-start/server";
import { Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { getWebRequest } from "@tanstack/react-start/server";
import * as React from "react";
import { Toaster } from "@/components/ui/sonner";

const fetchClerkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const { userId } = await getAuth(getWebRequest()!);

  return {
    userId,
  };
});

export const Route = createRootRoute({
  // beforeLoad: async () => {
  //   const { userId } = await fetchClerkAuth();

  //   return {
  //     userId,
  //   };
  // },
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
          <Toaster richColors={true} position="top-center" />
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
