"use client";

import React, { useState } from "react";
import {
  IconFileInvoice,
  IconCreditCard,
  IconMessage,
  IconAutomation,
  IconCurrencyDollar,
  IconDeviceFloppy,
  IconLoader2,
} from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettingsManager } from "@/hooks/use-settings";
import { toast } from "sonner";
import { TaxRateManager } from "./tax-rate-manager";

export function InvoicingTab() {
  const {
    settings,
    getSettingValue,
    updateSettings,
    isLoading,
    isUpdating,
  } = useSettingsManager("invoicing");

  const [formData, setFormData] = useState({
    invoice_prefix: "",
    default_invoice_due_days: 7,
    payment_terms_days: 30,
    payment_terms_message: "",
    invoice_footer_message: "",
    auto_generate_invoices: false,
    include_logo_on_invoice: true,
    invoice_due_reminder_days: 7,
    late_fee_percentage: 0,
  });

  // Initialize form data when settings load
  React.useEffect(() => {
    if (settings) {
      setFormData({
        invoice_prefix: getSettingValue("invoice_prefix", "INV"),
        default_invoice_due_days: getSettingValue(
          "default_invoice_due_days",
          7
        ),
        payment_terms_days: getSettingValue("payment_terms_days", 30),
        payment_terms_message: getSettingValue(
          "payment_terms_message",
          "Payment terms: Net 30 days."
        ),
        invoice_footer_message: getSettingValue(
          "invoice_footer_message",
          "Thank you for your business."
        ),
        auto_generate_invoices: getSettingValue(
          "auto_generate_invoices",
          false
        ),
        include_logo_on_invoice: getSettingValue(
          "include_logo_on_invoice",
          true
        ),
        invoice_due_reminder_days: getSettingValue(
          "invoice_due_reminder_days",
          7
        ),
        late_fee_percentage: getSettingValue("late_fee_percentage", 0),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const handleInputChange = (
    field: string,
    value: string | number | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveAll = async () => {
    try {
      await updateSettings(formData);
      toast.success("Invoicing settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    }
  };

  if (isLoading) {
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
    <div className="space-y-12 max-w-4xl">
      {/* Invoice Configuration */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <IconFileInvoice className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
            Invoice Configuration
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label
              htmlFor="invoice_prefix"
              className="text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              Invoice Number Prefix
            </Label>
            <Input
              id="invoice_prefix"
              placeholder="INV"
              value={formData.invoice_prefix}
              className="rounded-xl border-slate-200 h-11"
              onChange={(e) =>
                handleInputChange("invoice_prefix", e.target.value)
              }
            />
            <p className="text-[11px] text-slate-500 font-medium">
              Prefix for invoice numbers (e.g., INV-2024-001)
            </p>
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="default_invoice_due_days"
              className="text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              Default Due Days
            </Label>
            <Input
              id="default_invoice_due_days"
              type="number"
              min="0"
              value={formData.default_invoice_due_days}
              className="rounded-xl border-slate-200 h-11"
              onChange={(e) =>
                handleInputChange(
                  "default_invoice_due_days",
                  parseInt(e.target.value) || 0
                )
              }
            />
            <p className="text-[11px] text-slate-500 font-medium">
              Default number of days until invoice is due
            </p>
          </div>
        </div>
      </div>

      {/* Payment Terms */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <IconCreditCard className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
            Payment Terms
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label
              htmlFor="payment_terms_days"
              className="text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              Payment Terms (Days)
            </Label>
            <Input
              id="payment_terms_days"
              type="number"
              min="0"
              value={formData.payment_terms_days}
              className="rounded-xl border-slate-200 h-11"
              onChange={(e) =>
                handleInputChange(
                  "payment_terms_days",
                  parseInt(e.target.value) || 0
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="late_fee_percentage"
              className="text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              Late Fee Percentage (%)
            </Label>
            <Input
              id="late_fee_percentage"
              type="number"
              min="0"
              step="0.1"
              value={formData.late_fee_percentage}
              className="rounded-xl border-slate-200 h-11"
              onChange={(e) =>
                handleInputChange(
                  "late_fee_percentage",
                  parseFloat(e.target.value) || 0
                )
              }
            />
            <p className="text-[11px] text-slate-500 font-medium">
              Late fee percentage for overdue invoices
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="payment_terms_message"
            className="text-xs font-bold uppercase tracking-wider text-slate-500"
          >
            Payment Terms Message
          </Label>
          <Textarea
            id="payment_terms_message"
            rows={3}
            placeholder="Payment terms: Net 30 days."
            value={formData.payment_terms_message}
            className="rounded-xl border-slate-200 resize-none"
            onChange={(e) =>
              handleInputChange("payment_terms_message", e.target.value)
            }
          />
          <p className="text-[11px] text-slate-500 font-medium">
            This message will appear on invoices
          </p>
        </div>
      </div>

      {/* Invoice Messages */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <IconMessage className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
            Invoice Messages
          </h3>
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="invoice_footer_message"
            className="text-xs font-bold uppercase tracking-wider text-slate-500"
          >
            Invoice Footer Message
          </Label>
          <Textarea
            id="invoice_footer_message"
            rows={3}
            placeholder="Thank you for your business."
            value={formData.invoice_footer_message}
            className="rounded-xl border-slate-200 resize-none"
            onChange={(e) =>
              handleInputChange("invoice_footer_message", e.target.value)
            }
          />
          <p className="text-[11px] text-slate-500 font-medium">
            This message will appear at the bottom of invoices
          </p>
        </div>
      </div>

      {/* Automation & Reminders */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <IconAutomation className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
            Automation & Reminders
          </h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="space-y-0.5">
              <Label
                htmlFor="auto_generate_invoices"
                className="text-sm font-bold text-slate-900"
              >
                Auto-Generate Invoices
              </Label>
              <p className="text-[11px] text-slate-500 font-medium">
                Automatically generate invoices after flights
              </p>
            </div>
            <Switch
              id="auto_generate_invoices"
              checked={formData.auto_generate_invoices}
              onCheckedChange={(checked) =>
                handleInputChange("auto_generate_invoices", checked)
              }
            />
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="space-y-0.5">
              <Label
                htmlFor="include_logo_on_invoice"
                className="text-sm font-bold text-slate-900"
              >
                Include Logo on Invoice
              </Label>
              <p className="text-[11px] text-slate-500 font-medium">
                Show school logo on printed invoices
              </p>
            </div>
            <Switch
              id="include_logo_on_invoice"
              checked={formData.include_logo_on_invoice}
              onCheckedChange={(checked) =>
                handleInputChange("include_logo_on_invoice", checked)
              }
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="invoice_due_reminder_days"
              className="text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              Reminder Days Before Due
            </Label>
            <Input
              id="invoice_due_reminder_days"
              type="number"
              min="0"
              className="max-w-xs rounded-xl border-slate-200 h-11"
              value={formData.invoice_due_reminder_days}
              onChange={(e) =>
                handleInputChange(
                  "invoice_due_reminder_days",
                  parseInt(e.target.value) || 0
                )
              }
            />
            <p className="text-[11px] text-slate-500 font-medium">
              Days before due date to send payment reminder
            </p>
          </div>
        </div>
      </div>

      {/* Tax Configuration */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <IconCurrencyDollar className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
            Tax Configuration
          </h3>
        </div>
        <TaxRateManager />
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-8 border-t border-slate-100">
        <Button
          onClick={handleSaveAll}
          disabled={isUpdating}
          className="bg-slate-900 text-white font-bold rounded-xl h-11 px-6 shadow-lg shadow-slate-900/10 hover:bg-slate-800 flex items-center gap-2"
        >
          {isUpdating ? (
            <IconLoader2 className="w-4 h-4 animate-spin" />
          ) : (
            <IconDeviceFloppy className="w-4 h-4" />
          )}
          Save All Invoicing Settings
        </Button>
      </div>
    </div>
  );
}
