"use client";

import React from "react";
import { IconCreditCard } from "@tabler/icons-react";

export function MembershipsTab() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <IconCreditCard className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
            Membership Configuration
          </h3>
        </div>
        <div className="text-center py-12 bg-slate-50 rounded-[20px] border border-dashed border-slate-200">
          <p className="text-slate-900 font-bold">
            Membership settings will be configured here.
          </p>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            This section will allow you to manage membership types, renewal
            policies, and membership year configuration.
          </p>
        </div>
      </div>
    </div>
  );
}

