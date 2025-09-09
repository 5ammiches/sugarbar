import { Search, Music, Clock, Database, Play } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const items = [
  {
    title: "Search Albums",
    url: "#search",
    icon: Search,
    id: "search",
  },
  {
    title: "Job Queue",
    url: "#queue",
    icon: Clock,
    id: "queue",
  },
  {
    title: "My Albums",
    url: "#database",
    icon: Database,
    id: "database",
  },
  {
    title: "Progress",
    url: "#progress",
    icon: Play,
    id: "progress",
  },
]

interface AppSidebarProps {
  activeView: string
  onViewChange: (view: string) => void
}

export function AppSidebar({ activeView, onViewChange }: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <Music className="h-4 w-4" />
            Album Pipeline
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={activeView === item.id} onClick={() => onViewChange(item.id)}>
                    <button className="flex items-center gap-2">
                      <item.icon />
                      <span>{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
