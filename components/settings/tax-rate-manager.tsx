"use client";

import React, { useState, useEffect } from "react";
import {
  IconLoader2,
  IconCurrencyDollar,
  IconAlertCircle,
  IconCheck,
  IconEdit,
  IconX,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaxRate } from "@/lib/types/tax-rates";

export function TaxRateManager() {
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTaxRateId, setSelectedTaxRateId] = useState<string>("");

  useEffect(() => {
    fetchTaxRates();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const fetchTaxRates = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/tax-rates");
      const data = await response.json();
      if (response.ok) {
        const rates = data.tax_rates || [];
        setTaxRates(rates);
        const defaultRate = rates.find((rate: TaxRate) => rate.is_default);
        if (defaultRate) {
          setSelectedTaxRateId(defaultRate.id);
        }
      } else {
        setError(data.error || "Failed to fetch tax rates");
      }
    } catch {
      setError("Failed to fetch tax rates");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDefault = async () => {
    if (!selectedTaxRateId) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // The API now handles unsetting other defaults when setting a new one
      const response = await fetch("/api/tax-rates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedTaxRateId, is_default: true }),
      });

      if (response.ok) {
        setSuccess("Tax rate updated successfully");
        await fetchTaxRates();
        setIsEditing(false);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update tax rate");
      }
    } catch {
      setError("Failed to update tax rate");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    const defaultRate = taxRates.find((rate) => rate.is_default);
    if (defaultRate) {
      setSelectedTaxRateId(defaultRate.id);
    }
    setIsEditing(false);
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <IconLoader2 className="w-8 h-8 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-500 font-medium mt-2">
          Loading tax rates...
        </span>
      </div>
    );
  }

  if (taxRates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50 rounded-[20px] border border-dashed border-slate-200">
        <IconCurrencyDollar className="w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-bold text-slate-900 mb-2">
          No Tax Rates Found
        </h3>
        <p className="text-sm text-slate-500 max-w-md font-medium">
          Contact your administrator to set up tax rates in the system.
        </p>
      </div>
    );
  }

  const currentDefault = taxRates.find((rate) => rate.is_default);

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-xs font-bold flex items-start gap-2 uppercase tracking-tight">
          <IconAlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-2 text-xs font-bold uppercase tracking-tight">
          <IconCheck className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {!isEditing && currentDefault ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <IconCurrencyDollar className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    {currentDefault.tax_name}
                  </h3>
                  <div className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">
                    {currentDefault.country_code}
                    {currentDefault.region_code &&
                      ` - ${currentDefault.region_code}`}
                  </div>
                </div>
                <p className="text-sm text-slate-500 font-medium mt-0.5">
                  Applied to all new invoices by default
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {(currentDefault.rate * 100).toFixed(2)}%
              </div>
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                size="sm"
                className="h-9 rounded-xl border-slate-200 font-bold text-xs uppercase tracking-wider"
              >
                <IconEdit className="w-3.5 h-3.5 mr-1.5" />
                Change
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Select Default Tax Rate
            </label>
            <Select
              value={selectedTaxRateId}
              onValueChange={setSelectedTaxRateId}
            >
              <SelectTrigger className="w-full h-11 rounded-xl border-slate-200 bg-white">
                <SelectValue placeholder="Choose a tax rate..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {taxRates.map((rate) => (
                  <SelectItem
                    key={rate.id}
                    value={rate.id}
                    className="rounded-lg"
                  >
                    <div className="flex items-center justify-between w-full min-w-[300px]">
                      <span className="font-bold">
                        {rate.tax_name} ({rate.country_code}
                        {rate.region_code && ` - ${rate.region_code}`})
                      </span>
                      <span className="ml-auto font-black text-indigo-600">
                        {(rate.rate * 100).toFixed(2)}%
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleSaveDefault}
              disabled={saving || !selectedTaxRateId}
              className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-100 transition-all active:scale-[0.98] font-semibold border-none flex items-center gap-2 px-6"
            >
              {saving ? (
                <IconLoader2 className="w-4 h-4 animate-spin" />
              ) : (
                <IconDeviceFloppy className="w-4 h-4" />
              )}
              Save as Default
            </Button>
            <Button
              onClick={handleCancel}
              variant="outline"
              disabled={saving}
              className="h-11 px-6 rounded-xl border-slate-200 font-bold text-slate-600"
            >
              <IconX className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

