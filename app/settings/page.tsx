"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IconSettings,
  IconFileInvoice,
  IconCurrencyDollar,
  IconCalendar,
  IconSchool,
  IconCreditCard,
} from "@tabler/icons-react";
import * as Tabs from "@radix-ui/react-tabs";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GeneralTab } from "@/components/settings/general-tab";
import { InvoicingTab } from "@/components/settings/invoicing-tab";
import { ChargesTab } from "@/components/settings/charges-tab";
import { BookingsTab } from "@/components/settings/bookings-tab";
import { TrainingTab } from "@/components/settings/training-tab";
import { MembershipsTab } from "@/components/settings/memberships-tab";

// Check if user has access to settings
async function checkSettingsAccess(): Promise<{ hasAccess: boolean }> {
  const response = await fetch("/api/settings?category=general");
  if (response.status === 403 || response.status === 401) {
    return { hasAccess: false };
  }
  return { hasAccess: true };
}

const mainTabs = [
  { id: "general", label: "General", icon: IconSettings },
  { id: "invoicing", label: "Invoicing", icon: IconFileInvoice },
  { id: "charges", label: "Charges", icon: IconCurrencyDollar },
  { id: "bookings", label: "Bookings", icon: IconCalendar },
  { id: "training", label: "Training", icon: IconSchool },
  { id: "memberships", label: "Memberships", icon: IconCreditCard },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = React.useState("general");
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const tabsListRef = React.useRef<HTMLDivElement>(null);
  const [underlineStyle, setUnderlineStyle] = React.useState({
    left: 0,
    width: 0,
  });
  const [showScrollLeft, setShowScrollLeft] = React.useState(false);
  const [showScrollRight, setShowScrollRight] = React.useState(false);

  // Check access
  const { data: accessData, isLoading: isCheckingAccess } = useQuery({
    queryKey: ["settings-access"],
    queryFn: checkSettingsAccess,
    retry: false,
  });

  // Update underline position when active tab changes
  React.useEffect(() => {
    const activeElement = tabRefs.current[activeTab];
    if (activeElement && tabsListRef.current) {
      const listRect = tabsListRef.current.getBoundingClientRect();
      const activeRect = activeElement.getBoundingClientRect();
      setUnderlineStyle({
        left: activeRect.left - listRect.left,
        width: activeRect.width,
      });
    }
  }, [activeTab]);

  // Check if scroll indicators should be shown
  React.useEffect(() => {
    const checkScroll = () => {
      if (tabsListRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = tabsListRef.current;
        setShowScrollLeft(scrollLeft > 0);
        setShowScrollRight(scrollLeft + clientWidth < scrollWidth);
      }
    };

    checkScroll();
    const listElement = tabsListRef.current;
    listElement?.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);

    return () => {
      listElement?.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, []);

  if (isCheckingAccess) {
    return (
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (!accessData?.hasAccess) {
    return (
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="text-muted-foreground">
              You do not have permission to access settings. Only owners and
              admins can configure system settings.
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Settings
              </h1>
              <p className="text-slate-500 mt-1">
                Configure your flight school settings and preferences.
              </p>
            </div>

            {/* Tabbed Content */}
            <Card className="shadow-sm border border-slate-200 bg-white rounded-[20px] overflow-hidden">
              <CardContent className="p-0">
                <Tabs.Root
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="w-full flex flex-col"
                >
                  {/* Tab Header */}
                  <div className="w-full border-b border-slate-200 bg-white relative">
                    {/* Mobile: Simple Tab Switcher */}
                    <div className="md:hidden px-4 pt-3 pb-3">
                      <Select value={activeTab} onValueChange={setActiveTab}>
                        <SelectTrigger className="w-full h-11 border-2 border-slate-200 hover:border-slate-300 focus:border-slate-400 rounded-xl">
                          <SelectValue>
                            {(() => {
                              const activeTabItem = mainTabs.find(
                                (t) => t.id === activeTab
                              );
                              const Icon = activeTabItem?.icon || IconSettings;
                              return (
                                <div className="flex items-center gap-2">
                                  <Icon className="w-4 h-4 text-indigo-600" />
                                  <span className="font-medium text-indigo-900">
                                    {activeTabItem?.label || "Select tab"}
                                  </span>
                                </div>
                              );
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200">
                          {mainTabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                              <SelectItem
                                key={tab.id}
                                value={tab.id}
                                className={cn(
                                  "rounded-lg mx-1 my-0.5",
                                  isActive ? "bg-indigo-50" : ""
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Icon
                                    className={`w-4 h-4 ${
                                      isActive
                                        ? "text-indigo-600"
                                        : "text-slate-500"
                                    }`}
                                  />
                                  <span
                                    className={
                                      isActive
                                        ? "font-bold text-indigo-900"
                                        : "text-slate-600 font-medium"
                                    }
                                  >
                                    {tab.label}
                                  </span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Desktop: Horizontal tabs */}
                    <div className="hidden md:flex items-center px-6 pt-2 relative">
                      {showScrollLeft && (
                        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
                      )}
                      {showScrollRight && (
                        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
                      )}
                      <div className="flex items-center w-full overflow-x-auto scrollbar-hide scroll-smooth">
                        <Tabs.List
                          ref={tabsListRef}
                          className="flex flex-row gap-1 min-h-[48px] relative min-w-max"
                          aria-label="Settings categories"
                        >
                          <div
                            className="absolute bottom-0 h-0.5 bg-indigo-700 transition-all duration-300 ease-out"
                            style={{
                              left: `${underlineStyle.left}px`,
                              width: `${underlineStyle.width}px`,
                            }}
                          />
                          {mainTabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                              <Tabs.Trigger
                                key={tab.id}
                                ref={(el) => {
                                  tabRefs.current[tab.id] = el;
                                }}
                                value={tab.id}
                                className="inline-flex items-center gap-2 px-4 py-3 pb-1 text-base font-medium border-b-2 border-transparent transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 cursor-pointer data-[state=active]:text-indigo-800 data-[state=inactive]:text-gray-500 hover:text-indigo-600 whitespace-nowrap flex-shrink-0 min-h-[48px] min-w-[44px] touch-manipulation active:bg-gray-50 rounded-none"
                                style={{
                                  background: "none",
                                  boxShadow: "none",
                                }}
                                aria-label={`${tab.label} settings`}
                              >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                <span>{tab.label}</span>
                              </Tabs.Trigger>
                            );
                          })}
                        </Tabs.List>
                      </div>
                    </div>
                  </div>

                  {/* Tab Content */}
                  <div className="w-full p-4 sm:p-6 lg:p-8">
                    <Tabs.Content value="general" className="outline-none">
                      <GeneralTab />
                    </Tabs.Content>

                    <Tabs.Content value="invoicing" className="outline-none">
                      <InvoicingTab />
                    </Tabs.Content>

                    <Tabs.Content value="charges" className="outline-none">
                      <ChargesTab />
                    </Tabs.Content>

                    <Tabs.Content value="bookings" className="outline-none">
                      <BookingsTab />
                    </Tabs.Content>

                    <Tabs.Content value="training" className="outline-none">
                      <TrainingTab />
                    </Tabs.Content>

                    <Tabs.Content value="memberships" className="outline-none">
                      <MembershipsTab />
                    </Tabs.Content>
                  </div>
                </Tabs.Root>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

