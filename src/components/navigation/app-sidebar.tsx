import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { Clock, Database, Music, Search } from "lucide-react";

const items = [
  {
    title: "Search Albums",
    url: "/",
    icon: Search,
    id: "search",
    description: "Discover new music",
  },
  {
    title: "Job Queue",
    url: "/queue",
    icon: Clock,
    id: "queue",
    description: "Monitor workflows",
  },
  {
    title: "Albums",
    url: "/database",
    icon: Database,
    id: "database",
    description: "Browse collection",
  },
];

export function AppSidebar() {
  const { location } = useRouterState();
  const isActive = (url: string) => location.pathname === url;

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
            <Music className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold text-sidebar-foreground">
              Sugarbar
            </h1>
            <p className="text-xs text-sidebar-foreground/60">Album Pipeline</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4 py-6">
        <SidebarGroup className="space-y-2">
          {/* <SidebarGroupLabel className="px-2 text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider mb-4">
            Navigation
          </SidebarGroupLabel> */}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {items.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className={cn(
                      "group relative flex h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                      "data-[active=true]:bg-gradient-to-r data-[active=true]:from-purple-500/10 data-[active=true]:to-pink-500/10",
                      "data-[active=true]:text-sidebar-accent-foreground data-[active=true]:shadow-sm",
                      "data-[active=true]:border data-[active=true]:border-purple-500/20"
                    )}
                  >
                    <Link
                      to={item.url}
                      search={(prev) => prev}
                      className="flex w-full items-center gap-3"
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                          "group-hover:bg-sidebar-accent/30",
                          "group-data-[active=true]:bg-gradient-to-br group-data-[active=true]:from-purple-500/20 group-data-[active=true]:to-pink-500/20"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">
                          {item.title}
                        </span>
                        <span className="text-xs text-sidebar-foreground/50 group-data-[active=true]:text-sidebar-foreground/70">
                          {item.description}
                        </span>
                      </div>
                      {isActive(item.url) && (
                        <div className="ml-auto h-2 w-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
