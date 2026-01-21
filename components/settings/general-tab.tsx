"use client";

import React, { useState } from "react";
import {
  IconBuilding,
  IconMail,
  IconSettings,
  IconDeviceFloppy,
  IconLoader2,
  IconPlane,
} from "@tabler/icons-react";
import * as Tabs from "@radix-ui/react-tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTenantProfile } from "@/hooks/use-tenant-profile";
import { toast } from "sonner";
import { AircraftTypesConfig } from "./AircraftTypesConfig";
import { BusinessHoursConfig } from "./business-hours-config";
import { Dropzone } from "@/components/ui/dropzone";

const generalTabs = [
  { id: "school-info", label: "School Information", icon: IconBuilding },
  { id: "contact-info", label: "Contact Information", icon: IconMail },
  { id: "system-settings", label: "System Settings", icon: IconSettings },
  { id: "aircraft", label: "Aircraft", icon: IconPlane },
];

export function GeneralTab() {
  const [selectedTab, setSelectedTab] = useState("school-info");
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const tabsListRef = React.useRef<HTMLDivElement>(null);
  const [underlineStyle, setUnderlineStyle] = React.useState({
    left: 0,
    width: 0,
  });

  // Update underline position when active tab changes
  React.useEffect(() => {
    const activeElement = tabRefs.current[selectedTab];
    if (activeElement && tabsListRef.current) {
      const listRect = tabsListRef.current.getBoundingClientRect();
      const activeRect = activeElement.getBoundingClientRect();
      setUnderlineStyle({
        left: activeRect.left - listRect.left,
        width: activeRect.width,
      });
    }
  }, [selectedTab]);

  // Use tenant profile hook for organization info
  const {
    profile,
    isLoading: isLoadingProfile,
    isUpdating: isUpdatingProfile,
    updateProfile,
    refetch: refetchProfile,
  } = useTenantProfile();

  // Local state for form values (profile data)
  const [formData, setFormData] = useState({
    // School Information (from tenants table)
    name: "",
    registration_number: "",
    description: "",
    website_url: "",
    logo_url: "",
    // Contact Information (from tenants table)
    contact_email: "",
    contact_phone: "",
    address: "",
    billing_address: "",
    gst_number: "",
    // Regional Settings (from tenants table)
    timezone: "",
    currency: "",
  });

  // Logo upload state
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Initialize form data when profile loads
  React.useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        registration_number: profile.registration_number || "",
        description: profile.description || "",
        website_url: profile.website_url || "",
        logo_url: profile.logo_url || "",
        contact_email: profile.contact_email || "",
        contact_phone: profile.contact_phone || "",
        address: profile.address || "",
        billing_address: profile.billing_address || "",
        gst_number: profile.gst_number || "",
        timezone: profile.timezone || "Pacific/Auckland",
        currency: profile.currency || "NZD",
      });
    }
  }, [profile]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveSchoolInfo = async () => {
    try {
      await updateProfile({
        name: formData.name,
        registration_number: formData.registration_number || null,
        description: formData.description || null,
        website_url: formData.website_url || null,
      });
      toast.success("School information saved successfully");
    } catch (error) {
      console.error("Error saving school info:", error);
      toast.error("Failed to save school information");
    }
  };

  const handleSaveContactInfo = async () => {
    try {
      await updateProfile({
        contact_email: formData.contact_email || null,
        contact_phone: formData.contact_phone || null,
        address: formData.address || null,
        billing_address: formData.billing_address || null,
        gst_number: formData.gst_number || null,
      });
      toast.success("Contact information saved successfully");
    } catch (error) {
      console.error("Error saving contact info:", error);
      toast.error("Failed to save contact information");
    }
  };

  const handleTimezoneChange = (value: string) => {
    handleInputChange("timezone", value);
  };

  const handleCurrencyChange = (value: string) => {
    handleInputChange("currency", value);
  };

  const handleSaveRegionalSettings = async () => {
    try {
      await updateProfile({
        timezone: formData.timezone,
        currency: formData.currency,
      });
      toast.success("Regional settings saved successfully");
    } catch (error) {
      console.error("Error saving regional settings:", error);
      toast.error("Failed to save regional settings");
    }
  };

  const handleLogoUpload = async (file: File | null) => {
    if (!file) {
      // Handle logo removal
      try {
        setIsUploadingLogo(true);
        const response = await fetch("/api/settings/logo", {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to delete logo");
        }

        // Update local state
        setFormData((prev) => ({ ...prev, logo_url: "" }));
        toast.success("Logo removed successfully");
        
        // Refresh profile
        if (refetchProfile) {
          await refetchProfile();
        }
      } catch (error) {
        console.error("Error deleting logo:", error);
        toast.error("Failed to delete logo");
      } finally {
        setIsUploadingLogo(false);
      }
      return;
    }

    try {
      setIsUploadingLogo(true);
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      const response = await fetch("/api/settings/logo", {
        method: "POST",
        body: uploadFormData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload logo");
      }

      const data = await response.json();
      
      // Update local state
      setFormData((prev) => ({ ...prev, logo_url: data.url }));
      toast.success("Logo uploaded successfully");
      
      // Refresh profile
      if (refetchProfile) {
        await refetchProfile();
      }
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload logo"
      );
    } finally {
      setIsUploadingLogo(false);
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <IconLoader2 className="w-8 h-8 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-500 font-medium mt-2">
          Loading settings...
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <Tabs.Root
        value={selectedTab}
        onValueChange={setSelectedTab}
        className="w-full h-full flex flex-col"
      >
        <div className="w-full border-b border-gray-200 bg-white relative mb-8">
          <div className="flex items-center w-full overflow-x-auto scrollbar-hide scroll-smooth">
            <Tabs.List
              ref={tabsListRef}
              className="flex flex-row gap-1 min-h-[48px] relative min-w-max"
              aria-label="General configuration types"
            >
              {/* Animated underline */}
              <div
                className="absolute bottom-0 h-0.5 bg-indigo-700 transition-all duration-300 ease-out"
                style={{
                  left: `${underlineStyle.left}px`,
                  width: `${underlineStyle.width}px`,
                }}
              />
              {generalTabs.map((tab) => {
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
          <Tabs.Content value="school-info" className="outline-none">
            <div className="space-y-6 max-w-4xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className="text-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    School Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="Flight School Name"
                    value={formData.name}
                    className="rounded-xl border-slate-200 h-11"
                    onChange={(e) =>
                      handleInputChange("name", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="registration_number"
                    className="text-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    Registration Number
                  </Label>
                  <Input
                    id="registration_number"
                    placeholder="ABC123"
                    value={formData.registration_number}
                    className="rounded-xl border-slate-200 h-11"
                    onChange={(e) =>
                      handleInputChange("registration_number", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="description"
                  className="text-xs font-bold uppercase tracking-wider text-slate-500"
                >
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of your flight school..."
                  rows={4}
                  value={formData.description}
                  className="rounded-xl border-slate-200 resize-none"
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="website_url"
                  className="text-xs font-bold uppercase tracking-wider text-slate-500"
                >
                  Website URL
                </Label>
                <Input
                  id="website_url"
                  placeholder="https://www.yourflightschool.com"
                  value={formData.website_url}
                  className="rounded-xl border-slate-200 h-11"
                  onChange={(e) =>
                    handleInputChange("website_url", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="company_logo"
                  className="text-xs font-bold uppercase tracking-wider text-slate-500"
                >
                  Company Logo
                </Label>
                <Dropzone
                  onFileSelect={handleLogoUpload}
                  accept="image/*"
                  maxSize={5 * 1024 * 1024}
                  currentFile={formData.logo_url}
                  disabled={isUploadingLogo || isUpdatingProfile}
                  label="Drop logo here or click to upload"
                />
                <p className="text-[11px] text-slate-500 font-medium">
                  Upload your company logo (PNG, JPG, GIF, or WEBP, max 5MB)
                </p>
              </div>
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveSchoolInfo}
                  disabled={isUpdatingProfile}
                  className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-100 transition-all active:scale-[0.98] font-semibold border-none flex items-center gap-2 px-6"
                >
                  {isUpdatingProfile ? (
                    <IconLoader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <IconDeviceFloppy className="w-4 h-4" />
                  )}
                  Save School Information
                </Button>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="contact-info" className="outline-none">
            <div className="space-y-6 max-w-4xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="contact_email"
                    className="text-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="contact_email"
                    type="email"
                    placeholder="contact@flightschool.com"
                    value={formData.contact_email}
                    className="rounded-xl border-slate-200 h-11"
                    onChange={(e) =>
                      handleInputChange("contact_email", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="contact_phone"
                    className="text-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="contact_phone"
                    placeholder="+1 (555) 123-4567"
                    value={formData.contact_phone}
                    className="rounded-xl border-slate-200 h-11"
                    onChange={(e) =>
                      handleInputChange("contact_phone", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="address"
                  className="text-xs font-bold uppercase tracking-wider text-slate-500"
                >
                  Physical Address
                </Label>
                <Textarea
                  id="address"
                  placeholder="123 Airport Road, Aviation City, AC 12345"
                  rows={2}
                  value={formData.address}
                  className="rounded-xl border-slate-200 resize-none"
                  onChange={(e) => handleInputChange("address", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="billing_address"
                  className="text-xs font-bold uppercase tracking-wider text-slate-500"
                >
                  Billing Address
                </Label>
                <Textarea
                  id="billing_address"
                  placeholder="123 Airport Road, Aviation City, AC 12345"
                  rows={2}
                  value={formData.billing_address}
                  className="rounded-xl border-slate-200 resize-none"
                  onChange={(e) =>
                    handleInputChange("billing_address", e.target.value)
                  }
                />
                <p className="text-[11px] text-slate-500 font-medium">
                  This address will appear on invoices
                </p>
              </div>
              <div className="max-w-md space-y-2">
                <Label
                  htmlFor="gst_number"
                  className="text-xs font-bold uppercase tracking-wider text-slate-500"
                >
                  GST/Tax Number
                </Label>
                <Input
                  id="gst_number"
                  placeholder="12-345-678"
                  value={formData.gst_number}
                  className="rounded-xl border-slate-200 h-11"
                  onChange={(e) =>
                    handleInputChange("gst_number", e.target.value)
                  }
                />
                <p className="text-[11px] text-slate-500 font-medium">
                  Your GST or tax registration number for invoices
                </p>
              </div>
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveContactInfo}
                  disabled={isUpdatingProfile}
                  className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-100 transition-all active:scale-[0.98] font-semibold border-none flex items-center gap-2 px-6"
                >
                  {isUpdatingProfile ? (
                    <IconLoader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <IconDeviceFloppy className="w-4 h-4" />
                  )}
                  Save Contact Information
                </Button>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="system-settings" className="outline-none">
            <div className="space-y-8 max-w-4xl">
              {/* General System Settings */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <IconSettings className="w-4 h-4 text-slate-400" />
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                    Regional Settings
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label
                      htmlFor="timezone"
                      className="text-xs font-bold uppercase tracking-wider text-slate-500"
                    >
                      Default Timezone
                    </Label>
                    <Select
                      value={formData.timezone}
                      onValueChange={handleTimezoneChange}
                    >
                      <SelectTrigger className="w-full h-11 rounded-xl border-slate-200">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Pacific/Auckland">
                          Pacific/Auckland (NZ)
                        </SelectItem>
                        <SelectItem value="Australia/Sydney">
                          Australia/Sydney
                        </SelectItem>
                        <SelectItem value="America/New_York">
                          America/New_York
                        </SelectItem>
                        <SelectItem value="America/Los_Angeles">
                          America/Los_Angeles
                        </SelectItem>
                        <SelectItem value="Europe/London">
                          Europe/London
                        </SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="currency"
                      className="text-xs font-bold uppercase tracking-wider text-slate-500"
                    >
                      Default Currency
                    </Label>
                    <Select
                      value={formData.currency}
                      onValueChange={handleCurrencyChange}
                    >
                      <SelectTrigger className="w-full h-11 rounded-xl border-slate-200">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="NZD">
                          NZD - New Zealand Dollar
                        </SelectItem>
                        <SelectItem value="AUD">
                          AUD - Australian Dollar
                        </SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">
                          GBP - British Pound
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-600 font-medium">
                    These settings affect how dates, times, and currency are
                    displayed throughout the application.
                  </p>
                </div>
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSaveRegionalSettings}
                    disabled={isUpdatingProfile}
                    className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-100 transition-all active:scale-[0.98] font-semibold border-none flex items-center gap-2 px-6"
                  >
                    {isUpdatingProfile ? (
                      <IconLoader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <IconDeviceFloppy className="w-4 h-4" />
                    )}
                    Save Regional Settings
                  </Button>
                </div>
              </div>

              {/* Business Hours */}
              <div className="space-y-6">
                <BusinessHoursConfig />
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="aircraft" className="outline-none">
            <AircraftTypesConfig />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}
