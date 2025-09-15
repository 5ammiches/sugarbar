import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import JobQueue from "@/components/JobQueue";
import Search from "@/components/Search";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/")({
  component: AlbumPipelineDashboard,
});

export default function AlbumPipelineDashboard() {
  const [activeView, setActiveView] = useState("search");

  return (
    <div className="dark">
      <SidebarProvider>
        <AppSidebar activeView={activeView} onViewChange={setActiveView} />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1 text-white cursor-pointer" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">Album Pipeline</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {activeView === "search" && "Search Albums"}
                      {activeView === "queue" && "Job Queue"}
                      {activeView === "database" && "My Albums"}
                      {activeView === "progress" && "Progress"}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 flex flex-col gap-4 p-4 pt-0 overflow-auto">
              {/*{activeView === "search" && <Search />}
              {activeView === "queue" && <JobQueue />}*/}
              <div className={activeView === "search" ? "block" : "hidden"}>
                <Search />
              </div>
              <div className={activeView === "queue" ? "block" : "hidden"}>
                <JobQueue />
              </div>

              {/*{activeView === "database" && (
                <Card>
                  <CardHeader>
                    <CardTitle>My Albums Database</CardTitle>
                    <CardDescription>
                      Albums that have been successfully processed
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                              Album
                            </th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                              Artist
                            </th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                              Tracks
                            </th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                              Added
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {mockAlbums.map((album) => (
                            <tr key={album.id} className="border-b">
                              <td className="p-4 align-middle">
                                <div className="font-medium text-foreground">
                                  {album.name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  by {album.artist}
                                </div>
                              </td>
                              <td className="p-4 align-middle text-foreground">
                                {album.artist}
                              </td>
                              <td className="p-4 align-middle text-foreground">
                                {album.tracks}
                              </td>
                              <td className="p-4 align-middle text-foreground">
                                {album.addedDate}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}*/}

              {/*{activeView === "progress" && (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Total Albums
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">1,234</div>
                        <p className="text-xs text-muted-foreground">
                          +20.1% from last month
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Active Jobs
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">23</div>
                        <p className="text-xs text-muted-foreground">
                          +180.1% from last month
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}*/}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
