"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, AlertCircle, PlaneLanding, Trash2, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChargeableWithAircraftRates } from "@/lib/types/chargeables";
import type { AircraftType } from "@/lib/types/aircraft";

interface LandingFeeFormData {
  name: string;
  description: string;
  chargeable_type_id: string;
  is_taxable: boolean;
  is_active: boolean;
}

export function LandingFeesConfig() {
  const [landingFees, setLandingFees] = useState<ChargeableWithAircraftRates[]>([]);
  const [selectedFee, setSelectedFee] = useState<ChargeableWithAircraftRates | null>(null);
  const [aircraftTypes, setAircraftTypes] = useState<AircraftType[]>([]);
  const [landingFeeTypeId, setLandingFeeTypeId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [taxRate, setTaxRate] = useState(0.15);
  const [aircraftRates, setAircraftRates] = useState<Record<string, string>>({});

  const [editFormData, setEditFormData] = useState<LandingFeeFormData>({
    name: "",
    description: "",
    chargeable_type_id: "",
    is_taxable: true,
    is_active: true,
  });

  const [addFormData, setAddFormData] = useState<LandingFeeFormData>({
    name: "",
    description: "",
    chargeable_type_id: "",
    is_taxable: true,
    is_active: true,
  });

  const fetchLandingFees = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/chargeables?type=landing_fee&include_rates=true");
      if (!response.ok) {
        throw new Error("Failed to fetch landing fees");
      }
      const data = await response.json();
      setLandingFees(data.chargeables || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchAircraftTypes = async () => {
    try {
      const response = await fetch("/api/aircraft-types");
      if (!response.ok) {
        throw new Error("Failed to fetch aircraft types");
      }
      const data = await response.json();
      setAircraftTypes(data.aircraft_types || []);
    } catch (err) {
      console.error("Failed to fetch aircraft types:", err);
    }
  };

  const fetchTaxRate = async () => {
    try {
      const response = await fetch("/api/tax-rates?is_default=true");
      if (!response.ok) {
        throw new Error("Failed to fetch tax rate");
      }
      const data = await response.json();
      const defaultRate = data.tax_rates?.[0]?.rate;
      setTaxRate(defaultRate || 0.15);
    } catch {
      console.warn("Could not fetch tax rate, using default 15%");
      setTaxRate(0.15);
    }
  };

  const fetchLandingFeeTypeId = async () => {
    try {
      const response = await fetch("/api/chargeable_types");
      if (response.ok) {
        const data = await response.json();
        const landingFeeType = data.chargeable_types?.find(
          (t: { code: string }) => t.code === "landing_fee"
        );
        if (landingFeeType) {
          setLandingFeeTypeId(landingFeeType.id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch landing fee type:", err);
    }
  };

  useEffect(() => {
    fetchLandingFees();
    fetchTaxRate();
    fetchAircraftTypes();
    fetchLandingFeeTypeId();
  }, []);

  const calculateTaxInclusiveRate = useCallback(
    (rate: number, isTaxable: boolean = true) => {
      if (!isTaxable) return rate;
      return rate * (1 + taxRate);
    },
    [taxRate]
  );

  const calculateTaxExclusiveRate = useCallback(
    (inclusiveRate: number, isTaxable: boolean = true) => {
      if (!isTaxable) return inclusiveRate;
      return inclusiveRate / (1 + taxRate);
    },
    [taxRate]
  );

  useEffect(() => {
    if (selectedFee) {
      setEditFormData({
        name: selectedFee.name,
        description: selectedFee.description || "",
        chargeable_type_id: selectedFee.chargeable_type_id,
        is_taxable: selectedFee.is_taxable ?? true,
        is_active: selectedFee.is_active ?? true,
      });

      // Initialize aircraft rates for landing fees (convert to inclusive)
      if (selectedFee.landing_fee_rates) {
        const rates: Record<string, string> = {};
        selectedFee.landing_fee_rates.forEach((r) => {
          const inclusive = calculateTaxInclusiveRate(r.rate, selectedFee.is_taxable ?? true);
          rates[r.aircraft_type_id] = inclusive.toFixed(2);
        });
        setAircraftRates(rates);
      } else {
        setAircraftRates({});
      }
    }
  }, [selectedFee, taxRate, calculateTaxInclusiveRate]);

  const resetAddForm = () => {
    setAddFormData({
      name: "",
      description: "",
      chargeable_type_id: landingFeeTypeId,
      is_taxable: true,
      is_active: true,
    });
  };

  const handleAdd = async () => {
    if (!addFormData.name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const response = await fetch("/api/chargeables", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...addFormData,
          chargeable_type_id: landingFeeTypeId,
          rate: 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create landing fee");
      }

      await fetchLandingFees();
      setIsAddDialogOpen(false);
      resetAddForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const saveAircraftRates = async (chargeableId: string) => {
    const existingRates = selectedFee?.landing_fee_rates || [];

    // Update or create rates for each aircraft type that has a value
    for (const aircraftTypeId of Object.keys(aircraftRates)) {
      const rateValue = aircraftRates[aircraftTypeId];
      if (!rateValue || rateValue.trim() === "") continue;

      // Convert inclusive input to exclusive for storage
      const inclusiveRate = parseFloat(rateValue);
      const exclusiveRate = calculateTaxExclusiveRate(inclusiveRate, editFormData.is_taxable);

      const existingRate = existingRates.find((r) => r.aircraft_type_id === aircraftTypeId);

      if (existingRate) {
        // Update existing rate
        await fetch("/api/landing-fee-rates", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chargeable_id: chargeableId,
            aircraft_type_id: aircraftTypeId,
            rate: exclusiveRate,
          }),
        });
      } else {
        // Create new rate
        await fetch("/api/landing-fee-rates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chargeable_id: chargeableId,
            aircraft_type_id: aircraftTypeId,
            rate: exclusiveRate,
          }),
        });
      }
    }

    // Delete rates that were cleared (empty string or removed)
    for (const existingRate of existingRates) {
      const currentValue = aircraftRates[existingRate.aircraft_type_id];
      if (!currentValue || currentValue.trim() === "") {
        await fetch(
          `/api/landing-fee-rates?chargeable_id=${chargeableId}&aircraft_type_id=${existingRate.aircraft_type_id}`,
          { method: "DELETE" }
        );
      }
    }
  };

  const handleEdit = async () => {
    if (!selectedFee) return;

    if (!editFormData.name.trim()) {
      setError("Name is required");
      return;
    }

    // Validate that at least one aircraft rate is set
    const hasAircraftRates = Object.values(aircraftRates).some(
      (rate) => rate && rate.trim() !== ""
    );
    if (!hasAircraftRates) {
      setError("At least one aircraft-specific rate must be set");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const response = await fetch("/api/chargeables", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedFee.id,
          ...editFormData,
          chargeable_type_id: landingFeeTypeId,
          rate: 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update landing fee");
      }

      // Save aircraft-specific rates
      await saveAircraftRates(selectedFee.id);

      await fetchLandingFees();

      // Update selected fee to reflect changes
      const updatedFees = landingFees.map((f) =>
        f.id === selectedFee.id ? { ...f, ...editFormData } : f
      );
      const updatedSelected = updatedFees.find((f) => f.id === selectedFee.id);
      if (updatedSelected) {
        setSelectedFee(updatedSelected);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (fee: ChargeableWithAircraftRates) => {
    if (
      !confirm(
        `Are you sure you want to delete "${fee.name}"? This will hide it from the system but preserve historical data.`
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const response = await fetch(`/api/chargeables?id=${fee.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete landing fee");
      }

      await fetchLandingFees();
      if (selectedFee?.id === fee.id) {
        setSelectedFee(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const filteredFees = landingFees.filter((fee) => {
    return (
      fee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fee.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-slate-500">Loading landing fees...</div>
      </div>
    );
  }

  return (
    <div className="h-[600px] flex gap-6">
      {/* Left side - List of landing fees */}
      <div className="w-1/2 flex flex-col">
        <div className="flex items-center gap-2 mb-6 bg-slate-50/80 p-1.5 rounded-2xl border border-slate-100/80">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search landing fees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-10 bg-white border-slate-200 rounded-xl shadow-none focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 transition-all border-none"
            />
          </div>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={resetAddForm} 
                className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-100 transition-all active:scale-[0.98] whitespace-nowrap font-semibold border-none"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add New
              </Button>
            </DialogTrigger>
            <DialogContent
              className={cn(
                "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
                "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[540px]",
                "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
                "h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
              )}
            >
              <div className="flex h-full min-h-0 flex-col bg-white">
                <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                      <PlaneLanding className="h-5 w-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                        Add New Landing Fee
                      </DialogTitle>
                      <DialogDescription className="mt-0.5 text-sm text-slate-500">
                        Create a new landing fee location. Required fields are marked with{" "}
                        <span className="text-destructive">*</span>.
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
                  <div className="space-y-6">
                    <section>
                      <div className="mb-3 flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        <span className="text-xs font-semibold tracking-tight text-slate-900">
                          Location Details
                        </span>
                      </div>

                      <div className="grid gap-5">
                        <div>
                          <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            NAME <span className="text-destructive">*</span>
                          </label>
                          <Input
                            id="add-name"
                            value={addFormData.name}
                            onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                            placeholder="e.g., Wellington International"
                            className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                          />
                          <div className="mt-1 text-[10px] text-slate-500 italic">
                            You&apos;ll set aircraft-specific rates after creating.
                          </div>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            DESCRIPTION
                          </label>
                          <Textarea
                            id="add-description"
                            value={addFormData.description}
                            onChange={(e) =>
                              setAddFormData({ ...addFormData, description: e.target.value })
                            }
                            placeholder="e.g., Landing fees for Wellington airport"
                            rows={3}
                            className="rounded-xl border-slate-200 bg-white px-3 py-2 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                          />
                        </div>

                        <div className="flex h-full min-h-[64px] items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                          <Switch
                            id="add-is_taxable"
                            checked={addFormData.is_taxable}
                            onCheckedChange={(checked) =>
                              setAddFormData({ ...addFormData, is_taxable: checked })
                            }
                          />
                          <div className="min-w-0">
                            <Label
                              htmlFor="add-is_taxable"
                              className="text-xs font-semibold text-slate-900 leading-none cursor-pointer"
                            >
                              Taxable
                            </Label>
                            <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                              Uses organization tax rate.
                            </p>
                          </div>
                        </div>

                        <div className="flex h-full min-h-[64px] items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                          <Switch
                            id="add-is_active"
                            checked={addFormData.is_active}
                            onCheckedChange={(checked) =>
                              setAddFormData({ ...addFormData, is_active: checked })
                            }
                          />
                          <div className="min-w-0">
                            <Label
                              htmlFor="add-is_active"
                              className="text-xs font-semibold text-slate-900 leading-none cursor-pointer"
                            >
                              Active
                            </Label>
                            <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                              Whether this landing fee is available for use.
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>

                <div className="border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                      className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAdd}
                      disabled={saving || !addFormData.name.trim()}
                      className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                    >
                      {saving ? "Creating..." : "Create Landing Fee"}
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
          {filteredFees.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {searchTerm
                ? "No landing fees match your search."
                : "No landing fees configured yet. Click 'Add New' to get started."}
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredFees.map((fee) => (
                <div
                  key={fee.id}
                  className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                    selectedFee?.id === fee.id
                      ? "bg-indigo-50 border-l-4 border-l-indigo-600"
                      : ""
                  }`}
                  onClick={() => setSelectedFee(fee)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900">{fee.name}</h4>
                      {!fee.is_active && (
                        <Badge variant="outline" className="text-xs text-slate-500">
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </div>
                  {fee.description && (
                    <p className="text-sm text-slate-600 mt-1">{fee.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side - Edit form */}
      <div className="w-1/2 border border-slate-200 rounded-xl p-6 flex flex-col">
        {selectedFee ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900">Edit Landing Fee</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(selectedFee)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              <div>
                <Label htmlFor="edit-name" className="text-sm font-medium text-slate-700">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="Enter landing fee name"
                  className="mt-1.5"
                />
              </div>

              {/* Aircraft-specific rates */}
              {aircraftTypes.length > 0 && (
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <Label className="mb-3 block font-semibold text-slate-900">
                    Aircraft-Specific Rates (Tax Inclusive)
                  </Label>
                  <div className="text-xs text-slate-600 mb-3">
                    Set rates for each aircraft type. At least one rate is required.
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {aircraftTypes.map((aircraftType) => (
                      <div key={aircraftType.id} className="flex items-center gap-2">
                        <Label
                          htmlFor={`rate-${aircraftType.id}`}
                          className="w-32 text-sm truncate text-slate-700"
                        >
                          {aircraftType.name}
                        </Label>
                        <Input
                          id={`rate-${aircraftType.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={aircraftRates[aircraftType.id] || ""}
                          onChange={(e) =>
                            setAircraftRates({ ...aircraftRates, [aircraftType.id]: e.target.value })
                          }
                          placeholder="0.00"
                          className="flex-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="edit-description" className="text-sm font-medium text-slate-700">
                  Description <span className="text-slate-400 text-xs">(Optional)</span>
                </Label>
                <Textarea
                  id="edit-description"
                  value={editFormData.description}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, description: e.target.value })
                  }
                  placeholder="Enter description"
                  rows={3}
                  className="mt-1.5"
                />
              </div>

              <div className="flex items-center space-x-3 py-2">
                <Switch
                  id="edit-is_taxable"
                  checked={editFormData.is_taxable}
                  onCheckedChange={(checked) =>
                    setEditFormData({ ...editFormData, is_taxable: checked })
                  }
                />
                <Label
                  htmlFor="edit-is_taxable"
                  className="text-sm font-medium text-slate-700 cursor-pointer"
                >
                  Taxable (uses organization tax rate)
                </Label>
              </div>

              <div className="flex items-center space-x-3 py-2">
                <Switch
                  id="edit-is_active"
                  checked={editFormData.is_active}
                  onCheckedChange={(checked) =>
                    setEditFormData({ ...editFormData, is_active: checked })
                  }
                />
                <Label
                  htmlFor="edit-is_active"
                  className="text-sm font-medium text-slate-700 cursor-pointer"
                >
                  Active
                </Label>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200">
              <Button
                onClick={handleEdit}
                disabled={saving || !editFormData.name.trim()}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-100 transition-all active:scale-[0.98] font-semibold border-none"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500">
            <div className="text-center">
              <PlaneLanding className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="font-medium">Select a landing fee from the list to edit</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

