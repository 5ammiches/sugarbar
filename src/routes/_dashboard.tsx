import { Outlet, createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export const Route = createFileRoute("/_dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { location } = useRouterState();

  const getPageInfo = (pathname: string) => {
    switch (pathname) {
      case "/queue":
        return { title: "Job Queue", subtitle: "Monitor and manage workflows" };
      case "/database":
        return { title: "Albums", subtitle: "Browse your music collection" };
      default:
        return { title: "Search Albums", subtitle: "Discover new music" };
    }
  };

  const pageInfo = getPageInfo(location.pathname);

  return (
    <div className="dark min-h-screen from-slate-900 via-slate-800 to-slate-900">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-transparent">
          {/* Modern header with glass morphism effect */}
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b border-white/5 bg-black/20 backdrop-blur-xl transition-all duration-200 group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-4 px-4 sm:px-6 w-full">
              <SidebarTrigger className="-ml-1 text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer" />

              <Separator orientation="vertical" className="mr-2 h-4 bg-white/20" />

              {/* Enhanced breadcrumb with modern styling */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden sm:block">
                      <BreadcrumbLink asChild>
                        <Link
                          to="/"
                          className="text-white/60 hover:text-white transition-colors text-sm font-medium"
                        >
                          Sugarbar
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden sm:block text-white/30" />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="text-white font-semibold text-sm truncate">
                        {pageInfo.title}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>

              {/* Page subtitle - hidden on mobile */}
              <div className="hidden lg:block text-right">
                <p className="text-xs text-white/50 font-medium">{pageInfo.subtitle}</p>
              </div>
            </div>
          </header>

          {/* Main content area with improved spacing and responsiveness */}
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 flex flex-col">
              {/* Content wrapper with better mobile padding */}
              <div className="flex-1 overflow-auto">
                <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                  {/* Page title section - mobile friendly */}
                  <div className="lg:hidden">
                    <h1 className="text-2xl font-bold text-white mb-1">{pageInfo.title}</h1>
                    <p className="text-sm text-white/60">{pageInfo.subtitle}</p>
                  </div>

                  {/* Main content */}
                  <div className="relative">
                    <Outlet />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
