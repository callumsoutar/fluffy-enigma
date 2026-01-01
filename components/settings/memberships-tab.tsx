"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  IconCreditCard,
  IconCalendar,
  IconFileInvoice,
  IconGift,
} from "@tabler/icons-react";
import * as Tabs from "@radix-ui/react-tabs";
import { MembershipTypesConfig } from "./MembershipTypesConfig";
import { MembershipYearConfig } from "./MembershipYearConfig";

const membershipTabs = [
  { id: "membership-types", label: "Membership Types", icon: IconCreditCard },
  { id: "membership-year", label: "Membership Year", icon: IconCalendar },
  { id: "invoicing", label: "Invoicing", icon: IconFileInvoice },
  { id: "benefits", label: "Benefits", icon: IconGift },
];

export function MembershipsTab() {
  const [activeTab, setActiveTab] = useState("membership-types");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabsListRef = useRef<HTMLDivElement>(null);
  const [underlineStyle, setUnderlineStyle] = useState({
    left: 0,
    width: 0,
  });

  // Update underline position when active tab changes
  useEffect(() => {
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

  return (
    <div className="w-full h-full flex flex-col">
      <Tabs.Root
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full h-full flex flex-col"
      >
        <div className="w-full border-b border-gray-200 bg-white relative mb-8">
          <div className="flex items-center w-full overflow-x-auto scrollbar-hide scroll-smooth">
            <Tabs.List
              ref={tabsListRef}
              className="flex flex-row gap-1 min-h-[48px] relative min-w-max"
              aria-label="Membership configuration types"
            >
              {/* Animated underline */}
              <div
                className="absolute bottom-0 h-0.5 bg-indigo-700 transition-all duration-300 ease-out"
                style={{
                  left: `${underlineStyle.left}px`,
                  width: `${underlineStyle.width}px`,
                }}
              />
              {membershipTabs.map((tab) => {
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
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{tab.label}</span>
                  </Tabs.Trigger>
                );
              })}
            </Tabs.List>
          </div>
        </div>

        <div className="flex-1">
          <Tabs.Content value="membership-types" className="outline-none focus:ring-0">
            <MembershipTypesConfig />
          </Tabs.Content>

          <Tabs.Content value="membership-year" className="outline-none focus:ring-0">
            <MembershipYearConfig />
          </Tabs.Content>

          <Tabs.Content value="invoicing" className="outline-none focus:ring-0">
            <div className="text-center py-12 bg-slate-50 rounded-[20px] border border-dashed border-slate-200">
              <p className="text-slate-900 font-bold">
                Membership Invoicing settings will be configured here.
              </p>
            </div>
          </Tabs.Content>

          <Tabs.Content value="benefits" className="outline-none focus:ring-0">
            <div className="text-center py-12 bg-slate-50 rounded-[20px] border border-dashed border-slate-200">
              <p className="text-slate-900 font-bold">
                Membership Benefits settings will be configured here.
              </p>
            </div>
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}

