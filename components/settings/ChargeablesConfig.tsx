"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Search, Plus, AlertCircle, DollarSign, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChargeableWithAircraftRates } from "@/lib/types/chargeables";
import type { ChargeableType } from "@/lib/types/chargeables";

interface ChargeableFormData {
  name: string;
  description: string;
  chargeable_type_id: string;
  rate: string;
  is_taxable: boolean;
  is_active: boolean;
}

export function ChargeablesConfig() {
  const [chargeables, setChargeables] = useState<ChargeableWithAircraftRates[]>([]);
  const [selectedChargeable, setSelectedChargeable] = useState<ChargeableWithAircraftRates | null>(null);
  const [chargeableTypes, setChargeableTypes] = useState<ChargeableType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [taxRate, setTaxRate] = useState(0.15); // Default 15%
  const [filterTypeId, setFilterTypeId] = useState<string>("all");

  const [editFormData, setEditFormData] = useState<ChargeableFormData>({
    name: "",
    description: "",
    chargeable_type_id: "",
    rate: "",
    is_taxable: true,
    is_active: true,
  });

  const [addFormData, setAddFormData] = useState<ChargeableFormData>({
    name: "",
    description: "",
    chargeable_type_id: "",
    rate: "",
    is_taxable: true,
    is_active: true,
  });

  const fetchChargeables = async () => {
    try {
      setLoading(true);
      setError(null);
      // Note: Removed include_rates=true as we don't need landing fee rates for additional charges
      const response = await fetch("/api/chargeables");
      if (!response.ok) {
        throw new Error("Failed to fetch chargeables");
      }
      const data = await response.json();
      // Exclude landing fees - they have their own tab now
      const nonLandingFees = (data.chargeables || []).filter(
        (c: ChargeableWithAircraftRates) => c.chargeable_type?.code !== 'landing_fee'
      );
      setChargeables(nonLandingFees);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchChargeableTypes = async () => {
    try {
      const response = await fetch("/api/chargeable_types?is_active=true");
      if (!response.ok) {
        throw new Error("Failed to fetch chargeable types");
      }
      const data = await response.json();
      // Exclude landing_fee type - it has its own tab
      const types = (data.chargeable_types || []).filter(
        (t: ChargeableType) => t.code !== 'landing_fee'
      );
      setChargeableTypes(types);
    } catch (err) {
      console.error("Failed to fetch chargeable types:", err);
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

  useEffect(() => {
    fetchChargeables();
    fetchChargeableTypes();
    fetchTaxRate();
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
    if (selectedChargeable) {
      // Convert stored exclusive rate to inclusive for display
      const inclusiveRate = calculateTaxInclusiveRate(
        selectedChargeable.rate ?? 0,
        selectedChargeable.is_taxable ?? true
      );
      setEditFormData({
        name: selectedChargeable.name,
        description: selectedChargeable.description || "",
        chargeable_type_id: selectedChargeable.chargeable_type_id,
        rate: inclusiveRate.toFixed(2),
        is_taxable: selectedChargeable.is_taxable ?? true,
        is_active: selectedChargeable.is_active ?? true,
      });
    }
  }, [selectedChargeable, taxRate, calculateTaxInclusiveRate]);

  const resetAddForm = () => {
    setAddFormData({
      name: "",
      description: "",
      chargeable_type_id: "",
      rate: "",
      is_taxable: true,
      is_active: true,
    });
  };

  const handleAdd = async () => {
    if (!addFormData.name.trim() || !addFormData.chargeable_type_id || !addFormData.rate) {
      setError("Name, type, and rate are required");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      // Convert inclusive input to exclusive for storage
      const inclusiveRate = parseFloat(addFormData.rate);
      const exclusiveRate = calculateTaxExclusiveRate(inclusiveRate, addFormData.is_taxable);

      const response = await fetch("/api/chargeables", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...addFormData,
          rate: exclusiveRate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create chargeable");
      }

      await fetchChargeables();
      setIsAddDialogOpen(false);
      resetAddForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedChargeable) return;

    if (!editFormData.name.trim() || !editFormData.chargeable_type_id || !editFormData.rate) {
      setError("Name, type, and rate are required");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      // Convert inclusive input to exclusive for storage
      const inclusiveRate = parseFloat(editFormData.rate);
      const exclusiveRate = calculateTaxExclusiveRate(inclusiveRate, editFormData.is_taxable);

      const response = await fetch("/api/chargeables", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedChargeable.id,
          ...editFormData,
          rate: exclusiveRate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update chargeable");
      }

      await fetchChargeables();

      // Refresh to get updated data
      setSelectedChargeable(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (chargeable: ChargeableWithAircraftRates) => {
    if (
      !confirm(
        `Are you sure you want to delete "${chargeable.name}"? This will hide it from the system but preserve historical data.`
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const response = await fetch(`/api/chargeables?id=${chargeable.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete chargeable");
      }

      await fetchChargeables();
      if (selectedChargeable?.id === chargeable.id) {
        setSelectedChargeable(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const filteredChargeables = chargeables.filter((chargeable) => {
    const typeName = chargeable.chargeable_type?.name || "";
    const matchesSearch =
      chargeable.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chargeable.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      typeName.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterTypeId === "all") return matchesSearch;

    return matchesSearch && chargeable.chargeable_type_id === filterTypeId;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: "NZD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-slate-500">Loading chargeables...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header Section */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <DollarSign className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-slate-900">Additional Charges</h3>
        </div>

        <p className="text-sm text-slate-600">
        Configure additional chargeable items such as fuel surcharges, equipment rentals, and other fees (excludes landing fees).
      </p>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="h-[600px] flex gap-6">
        {/* Left side - List of chargeables */}
        <div className="w-1/2 flex flex-col">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search chargeables..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetAddForm} className="bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="w-4 h-4 mr-2" />
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
                        <DollarSign className="h-5 w-5" />
                      </div>
                      <div>
                        <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                          Add New Chargeable
                        </DialogTitle>
                        <DialogDescription className="mt-0.5 text-sm text-slate-500">
                          Create a new additional charge. Required fields are marked with{" "}
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
                            Charge Details
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
                              placeholder="Enter chargeable name"
                              className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                            />
                          </div>

                          <div>
                            <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                              TYPE <span className="text-destructive">*</span>
                            </label>
                            <Select
                              value={addFormData.chargeable_type_id}
                              onValueChange={(value) =>
                                setAddFormData({ ...addFormData, chargeable_type_id: value })
                              }
                            >
                              <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                {chargeableTypes.map((type) => (
                                  <SelectItem key={type.id} value={type.id}>
                                    {type.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                              RATE (NZD, TAX INCLUSIVE) <span className="text-destructive">*</span>
                            </label>
                            <Input
                              id="add-rate"
                              type="number"
                              step="0.01"
                              min="0"
                              value={addFormData.rate}
                              onChange={(e) => setAddFormData({ ...addFormData, rate: e.target.value })}
                              placeholder="0.00"
                              className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                            />
                            {addFormData.rate && !isNaN(parseFloat(addFormData.rate)) && (
                              <div className="mt-2 text-[10px] text-slate-500 italic">
                                {addFormData.is_taxable
                                  ? `Tax Exclusive: ${formatCurrency(
                                      calculateTaxExclusiveRate(parseFloat(addFormData.rate), true)
                                    )}`
                                  : `Tax Exempt (no conversion needed)`}
                              </div>
                            )}
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
                              placeholder="Enter description"
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
                                Whether this chargeable is available for use.
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
                        disabled={
                          saving ||
                          !addFormData.name.trim() ||
                          !addFormData.chargeable_type_id ||
                          !addFormData.rate
                        }
                        className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                      >
                        {saving ? "Creating..." : "Create"}
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mb-4">
            <Label htmlFor="filter-type" className="text-sm mb-2 block font-medium text-slate-700">
              Filter by Type
            </Label>
            <Select value={filterTypeId} onValueChange={(value) => setFilterTypeId(value)}>
              <SelectTrigger id="filter-type" className="w-full">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {chargeableTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
            {filteredChargeables.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                {searchTerm
                  ? "No chargeables match your search."
                  : "No chargeables configured yet. Click 'Add New' to get started."}
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredChargeables.map((chargeable) => (
                  <div
                    key={chargeable.id}
                    className={`p-2.5 cursor-pointer hover:bg-slate-50 transition-colors ${
                      selectedChargeable?.id === chargeable.id
                        ? "bg-indigo-50 border-l-4 border-l-indigo-600 pl-2"
                        : ""
                    }`}
                    onClick={() => setSelectedChargeable(chargeable)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <h4 className="font-medium text-sm text-slate-900 truncate">
                            {chargeable.name}
                          </h4>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {chargeable.chargeable_type?.name || "Unknown"}
                          </Badge>
                        </div>
                        {chargeable.description && (
                          <p className="text-xs text-slate-500 line-clamp-1 mb-1">
                            {chargeable.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-slate-700 font-medium">
                            {formatCurrency(
                              calculateTaxInclusiveRate(chargeable.rate ?? 0, chargeable.is_taxable ?? true)
                            )}
                          </span>
                          {chargeable.is_taxable ? (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800">
                              Taxable
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 text-orange-600 border-orange-300"
                            >
                              Tax Exempt
                            </Badge>
                          )}
                          {!chargeable.is_active && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-500">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side - Edit form */}
        <div className="w-1/2 border border-slate-200 rounded-xl p-6 flex flex-col">
          {selectedChargeable ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Edit Chargeable</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(selectedChargeable)}
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
                    placeholder="Enter chargeable name"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-type" className="text-sm font-medium text-slate-700">
                    Type <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={editFormData.chargeable_type_id}
                    onValueChange={(value) =>
                      setEditFormData({ ...editFormData, chargeable_type_id: value })
                    }
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {chargeableTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-rate" className="text-sm font-medium text-slate-700">
                    Rate (NZD, Tax Inclusive) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFormData.rate}
                    onChange={(e) => setEditFormData({ ...editFormData, rate: e.target.value })}
                    placeholder="0.00"
                    className="mt-1.5"
                  />
                  {editFormData.rate && !isNaN(parseFloat(editFormData.rate)) && (
                    <div className="mt-2 text-xs text-slate-500">
                      {editFormData.is_taxable
                        ? `Tax Exclusive: ${formatCurrency(
                            calculateTaxExclusiveRate(parseFloat(editFormData.rate), true)
                          )}`
                        : `Tax Exempt (no conversion needed)`}
                    </div>
                  )}
                </div>

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
                  disabled={
                    saving ||
                    !editFormData.name.trim() ||
                    !editFormData.chargeable_type_id ||
                    !editFormData.rate
                  }
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">
              <div className="text-center">
                <DollarSign className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="font-medium">Select a chargeable from the list to edit</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

