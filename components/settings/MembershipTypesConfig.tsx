"use client";

import { useState, useEffect } from "react";
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
import { 
  Search, 
  Plus, 
  AlertCircle, 
  Users, 
  Trash2, 
  X, 
  ChevronDown, 
  ChevronUp,
  CreditCard
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MembershipTypeWithChargeable } from "@/lib/types/memberships";

interface MembershipTypeFormData {
  name: string;
  code: string;
  description: string;
  duration_months: string;
  benefits: string[];
  is_active: boolean;
  chargeable_id: string | null;
}

export function MembershipTypesConfig() {
  const [membershipTypes, setMembershipTypes] = useState<MembershipTypeWithChargeable[]>([]);
  const [selectedType, setSelectedType] = useState<MembershipTypeWithChargeable | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newBenefit, setNewBenefit] = useState("");
  const [membershipChargeables, setMembershipChargeables] = useState<{id: string; name: string; rate: number; is_taxable: boolean}[]>([]);
  const [isBenefitsExpanded, setIsBenefitsExpanded] = useState(true);
  const [taxRate, setTaxRate] = useState(0.15); // Default NZ GST

  const [editFormData, setEditFormData] = useState<MembershipTypeFormData>({
    name: "",
    code: "",
    description: "",
    duration_months: "",
    benefits: [],
    is_active: true,
    chargeable_id: null,
  });

  const [addFormData, setAddFormData] = useState<MembershipTypeFormData>({
    name: "",
    code: "",
    description: "",
    duration_months: "12",
    benefits: [],
    is_active: true,
    chargeable_id: null,
  });

  const fetchMembershipTypes = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/membership-types");
      if (!response.ok) {
        throw new Error("Failed to fetch membership types");
      }
      const data = await response.json();
      setMembershipTypes(data.membership_types || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchMembershipChargeables = async () => {
    try {
      const response = await fetch("/api/chargeables?type=membership_fee");
      if (response.ok) {
        const data = await response.json();
        setMembershipChargeables(data.chargeables || []);
      }
    } catch (err) {
      console.error("Failed to fetch membership chargeables:", err);
    }
  };

  const fetchTaxRate = async () => {
    try {
      const response = await fetch("/api/tax-rates?is_default=true");
      if (response.ok) {
        const data = await response.json();
        const defaultRate = data.tax_rates?.[0]?.rate;
        setTaxRate(defaultRate || 0.15);
      }
    } catch {
      setTaxRate(0.15);
    }
  };

  useEffect(() => {
    fetchMembershipTypes();
    fetchMembershipChargeables();
    fetchTaxRate();
  }, []);

  useEffect(() => {
    if (selectedType) {
      setEditFormData({
        name: selectedType.name,
        code: selectedType.code,
        description: selectedType.description || "",
        duration_months: selectedType.duration_months.toString(),
        benefits: Array.isArray(selectedType.benefits) ? selectedType.benefits.filter((b): b is string => typeof b === 'string') : [],
        is_active: selectedType.is_active ?? true,
        chargeable_id: selectedType.chargeable_id || null,
      });
    }
  }, [selectedType]);

  const resetAddForm = () => {
    setAddFormData({
      name: "",
      code: "",
      description: "",
      duration_months: "12",
      benefits: [],
      is_active: true,
      chargeable_id: null,
    });
  };

  const generateCode = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 50);
  };

  const handleAdd = async () => {
    if (!addFormData.name.trim() || !addFormData.code.trim() || !addFormData.duration_months) {
      setError("Name, code, and duration are required");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch("/api/membership-types", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...addFormData,
          duration_months: parseInt(addFormData.duration_months),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create membership type");
      }

      await fetchMembershipTypes();
      setIsAddDialogOpen(false);
      resetAddForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedType) return;

    if (!editFormData.name.trim() || !editFormData.code.trim() || !editFormData.duration_months) {
      setError("Name, code, and duration are required");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/membership-types/${selectedType.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...editFormData,
          duration_months: parseInt(editFormData.duration_months),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update membership type");
      }

      await fetchMembershipTypes();
      setSelectedType(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: MembershipTypeWithChargeable) => {
    if (!confirm(`Are you sure you want to delete "${type.name}"? This will deactivate it but preserve historical data.`)) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const response = await fetch(`/api/membership-types/${type.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete membership type");
      }

      await fetchMembershipTypes();
      if (selectedType?.id === type.id) {
        setSelectedType(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const addBenefitToForm = (formType: "add" | "edit") => {
    if (!newBenefit.trim()) return;

    if (formType === "add") {
      setAddFormData({
        ...addFormData,
        benefits: [...addFormData.benefits, newBenefit.trim()],
      });
    } else {
      setEditFormData({
        ...editFormData,
        benefits: [...editFormData.benefits, newBenefit.trim()],
      });
    }
    setNewBenefit("");
  };

  const removeBenefitFromForm = (index: number, formType: "add" | "edit") => {
    if (formType === "add") {
      setAddFormData({
        ...addFormData,
        benefits: addFormData.benefits.filter((_, i) => i !== index),
      });
    } else {
      setEditFormData({
        ...editFormData,
        benefits: editFormData.benefits.filter((_, i) => i !== index),
      });
    }
  };

  const filteredTypes = membershipTypes.filter(type => {
    const matchesSearch = type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      type.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      type.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDuration = (months: number) => {
    if (months === 1) return "1 month";
    if (months === 12) return "1 year";
    if (months % 12 === 0) return `${months / 12} years`;
    return `${months} months`;
  };

  const calculateTaxInclusiveRate = (rate: number, isTaxable: boolean = true) => {
    if (!isTaxable) return rate;
    return rate * (1 + taxRate);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-slate-500">Loading membership types...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="h-[650px] flex gap-6">
        {/* Left side - List */}
        <div className="w-1/2 flex flex-col">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search membership types..."
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
              <DialogContent className="p-0 border-none shadow-2xl rounded-[24px] overflow-hidden w-[calc(100vw-1rem)] max-w-[540px]">
                <div className="flex h-full min-h-0 flex-col bg-white">
                  <DialogHeader className="px-6 pt-6 pb-4 text-left">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div>
                        <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                          Add Membership Type
                        </DialogTitle>
                        <DialogDescription className="mt-0.5 text-sm text-slate-500">
                          Create a new membership type.
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
                    <div className="space-y-6">
                      <div className="grid gap-5">
                        <div>
                          <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            NAME <span className="text-destructive">*</span>
                          </label>
                          <Input
                            id="add-name"
                            value={addFormData.name}
                            onChange={(e) => {
                              const name = e.target.value;
                              setAddFormData({
                                ...addFormData,
                                name,
                                code: generateCode(name)
                              });
                            }}
                            placeholder="e.g., Flying Member"
                            className="rounded-xl border-slate-200"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            CODE <span className="text-destructive">*</span>
                          </label>
                          <Input
                            id="add-code"
                            value={addFormData.code}
                            onChange={(e) => setAddFormData({ ...addFormData, code: e.target.value })}
                            placeholder="e.g., flying_member"
                            className="rounded-xl border-slate-200"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            DURATION (MONTHS) <span className="text-destructive">*</span>
                          </label>
                          <Input
                            id="add-duration"
                            type="number"
                            min="1"
                            value={addFormData.duration_months}
                            onChange={(e) => setAddFormData({ ...addFormData, duration_months: e.target.value })}
                            className="rounded-xl border-slate-200"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            LINKED CHARGEABLE
                          </label>
                          <Select
                            value={addFormData.chargeable_id || "none"}
                            onValueChange={(value) =>
                              setAddFormData({ ...addFormData, chargeable_id: value === "none" ? null : value })
                            }
                          >
                            <SelectTrigger className="rounded-xl border-slate-200">
                              <SelectValue placeholder="Select a chargeable..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No linked chargeable</SelectItem>
                              {membershipChargeables.map((chargeable) => (
                                <SelectItem key={chargeable.id} value={chargeable.id}>
                                  {chargeable.name} ({formatCurrency(calculateTaxInclusiveRate(chargeable.rate, chargeable.is_taxable))})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            DESCRIPTION
                          </label>
                          <Textarea
                            id="add-description"
                            value={addFormData.description}
                            onChange={(e) => setAddFormData({ ...addFormData, description: e.target.value })}
                            rows={2}
                            className="rounded-xl border-slate-200"
                          />
                        </div>

                        <div className="flex h-full min-h-[64px] items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                          <Switch
                            id="add-is_active"
                            checked={addFormData.is_active}
                            onCheckedChange={(checked) => setAddFormData({ ...addFormData, is_active: checked })}
                          />
                          <div className="min-w-0">
                            <Label htmlFor="add-is_active" className="text-xs font-semibold text-slate-900 leading-none cursor-pointer">
                              Active
                            </Label>
                            <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                              Available for new memberships.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t bg-white px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1 rounded-xl">
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAdd}
                        disabled={saving || !addFormData.name.trim() || !addFormData.code.trim() || !addFormData.duration_months}
                        className="flex-[1.5] rounded-xl bg-slate-900 hover:bg-slate-800"
                      >
                        {saving ? "Creating..." : "Create"}
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
            {filteredTypes.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                {searchTerm ? "No membership types match your search." : "No membership types configured yet."}
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredTypes.map((type) => (
                  <div
                    key={type.id}
                    className={cn(
                      "p-3 cursor-pointer hover:bg-slate-50 transition-colors",
                      selectedType?.id === type.id ? "bg-indigo-50 border-l-4 border-l-indigo-600 pl-2" : ""
                    )}
                    onClick={() => setSelectedType(type)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm text-slate-900">{type.name}</h4>
                        {!type.is_active && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-500">Inactive</Badge>}
                      </div>
                      <span className="text-sm font-semibold text-indigo-600">
                        {type.chargeables 
                          ? formatCurrency(calculateTaxInclusiveRate(type.chargeables.rate ?? 0, type.chargeables.is_taxable ?? false))
                          : formatCurrency(0)
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Code: {type.code}</span>
                      <span>•</span>
                      <span>{formatDuration(type.duration_months)}</span>
                      {Array.isArray(type.benefits) && type.benefits.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{type.benefits.length} benefits</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side - Edit */}
        <div className="w-1/2 border border-slate-200 rounded-xl p-6 flex flex-col">
          {selectedType ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Edit Membership Type</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(selectedType)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                <section className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-1 w-1 rounded-full bg-indigo-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Basic Information</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-name" className="text-xs font-medium text-slate-700">Name</Label>
                      <Input
                        id="edit-name"
                        value={editFormData.name}
                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                        className="h-9 text-sm rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-code" className="text-xs font-medium text-slate-700">Code</Label>
                      <Input
                        id="edit-code"
                        value={editFormData.code}
                        onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value })}
                        className="h-9 text-sm rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-description" className="text-xs font-medium text-slate-700">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      rows={2}
                      className="text-sm rounded-lg"
                    />
                  </div>
                </section>

                <section className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-1 w-1 rounded-full bg-indigo-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pricing & Duration</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-duration" className="text-xs font-medium text-slate-700">Duration (Months)</Label>
                      <Input
                        id="edit-duration"
                        type="number"
                        min="1"
                        value={editFormData.duration_months}
                        onChange={(e) => setEditFormData({ ...editFormData, duration_months: e.target.value })}
                        className="h-9 text-sm rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-chargeable" className="text-xs font-medium text-slate-700">Linked Chargeable</Label>
                    <Select
                      value={editFormData.chargeable_id || "none"}
                      onValueChange={(value) =>
                        setEditFormData({ ...editFormData, chargeable_id: value === "none" ? null : value })
                      }
                    >
                      <SelectTrigger className="h-9 text-sm rounded-lg">
                        <SelectValue placeholder="Select a chargeable..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No linked chargeable</SelectItem>
                        {membershipChargeables.map((chargeable) => (
                          <SelectItem key={chargeable.id} value={chargeable.id}>
                            {chargeable.name} ({formatCurrency(calculateTaxInclusiveRate(chargeable.rate, chargeable.is_taxable))})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </section>

                <section className="space-y-4 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setIsBenefitsExpanded(!isBenefitsExpanded)}
                    className="w-full flex items-center justify-between hover:opacity-70 transition-opacity"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-indigo-500" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Benefits</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{editFormData.benefits.length}</Badge>
                    </div>
                    {isBenefitsExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>

                  {isBenefitsExpanded && (
                    <div className="space-y-2">
                      <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                        {editFormData.benefits.map((benefit, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg group">
                            <span className="text-xs text-slate-700">{benefit}</span>
                            <button
                              onClick={() => removeBenefitFromForm(index, "edit")}
                              className="text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newBenefit}
                          onChange={(e) => setNewBenefit(e.target.value)}
                          placeholder="Add benefit..."
                          onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addBenefitToForm("edit"))}
                          className="h-8 text-xs rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addBenefitToForm("edit")}
                          disabled={!newBenefit.trim()}
                          className="h-8 w-8 p-0 rounded-lg"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </section>

                <section className="space-y-4 pt-4 border-t pb-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="edit-is_active"
                        checked={editFormData.is_active}
                        onCheckedChange={(checked) => setEditFormData({ ...editFormData, is_active: checked })}
                      />
                      <div className="flex flex-col">
                        <Label htmlFor="edit-is_active" className="text-xs font-semibold text-slate-900 leading-none">
                          Active
                        </Label>
                        <p className="text-[10px] text-slate-500 mt-1">Available for selection</p>
                      </div>
                    </div>
                    {editFormData.is_active ? (
                      <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 text-[10px]">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-500 border-slate-300 text-[10px]">Inactive</Badge>
                    )}
                  </div>
                </section>
              </div>

              <div className="mt-auto pt-4 border-t">
                <Button
                  onClick={handleEdit}
                  disabled={saving || !editFormData.name.trim() || !editFormData.code.trim() || !editFormData.duration_months}
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                <p className="text-sm">Select a membership type to edit</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

