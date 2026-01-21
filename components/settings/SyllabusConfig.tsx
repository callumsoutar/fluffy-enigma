"use client";

import { useState, useEffect } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Archive, AlertCircle, GraduationCap, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Syllabus, SyllabusFormData } from "@/lib/types/syllabus";

export default function SyllabusConfig() {
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSyllabus, setEditingSyllabus] = useState<Syllabus | null>(null);
  const [formData, setFormData] = useState<SyllabusFormData>({
    name: "",
    description: "",
    number_of_exams: 0,
    is_active: true,
  });
  const [hasExams, setHasExams] = useState(false);

  const fetchSyllabi = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/syllabus");
      if (!response.ok) {
        throw new Error("Failed to fetch syllabi");
      }
      const data = await response.json();
      setSyllabi(data.syllabi || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSyllabi();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      number_of_exams: 0,
      is_active: true,
    });
    setHasExams(false);
  };

  const handleAdd = async () => {
    try {
      setError(null);
      const response = await fetch("/api/syllabus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create syllabus");
      }

      await fetchSyllabi();
      setIsAddDialogOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleEdit = async () => {
    if (!editingSyllabus) return;

    try {
      setError(null);
      const response = await fetch("/api/syllabus", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...formData, id: editingSyllabus.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update syllabus");
      }

      await fetchSyllabi();
      setIsEditDialogOpen(false);
      setEditingSyllabus(null);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to void this syllabus? This will make it unavailable for new entries."
      )
    ) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/syllabus?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete syllabus");
      }

      await fetchSyllabi();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const openEditDialog = (syllabus: Syllabus) => {
    setEditingSyllabus(syllabus);
    const hasExamsValue = syllabus.number_of_exams > 0;
    setHasExams(hasExamsValue);
    setFormData({
      name: syllabus.name,
      description: syllabus.description || "",
      number_of_exams: syllabus.number_of_exams,
      is_active: syllabus.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const filteredSyllabi = syllabi.filter((syllabus) => {
    return (
      syllabus.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      syllabus.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-500">Loading syllabi...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header Section */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <GraduationCap className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-slate-900">Training Programs</h3>
      </div>
      
      <p className="text-sm text-slate-600">
        Manage syllabus structures and training program requirements.
      </p>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex items-center gap-2 mb-6 bg-slate-50/80 p-1.5 rounded-2xl border border-slate-100/80">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search syllabi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-10 bg-white border-slate-200 rounded-xl shadow-none focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 transition-all border-none"
          />
        </div>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <Dialog 
          open={isAddDialogOpen} 
          onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button 
              onClick={resetForm} 
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
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                      Add New Syllabus
                    </DialogTitle>
                    <DialogDescription className="mt-0.5 text-sm text-slate-500">
                      Create a new training program syllabus. Required fields are marked with{" "}
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
                        Syllabus Details
                      </span>
                    </div>

                    <div className="grid gap-5">
                      <div>
                        <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          NAME <span className="text-destructive">*</span>
                        </label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g., PPL Ground School"
                          className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          DESCRIPTION
                        </label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Enter a brief description"
                          rows={3}
                          className="rounded-xl border-slate-200 bg-white px-3 py-2 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                        />
                      </div>

                      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                        <Switch
                          id="has_exams"
                          checked={hasExams}
                          onCheckedChange={(checked) => {
                            setHasExams(checked);
                            if (!checked) {
                              setFormData({ ...formData, number_of_exams: 0 });
                            }
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Label htmlFor="has_exams" className="text-xs font-semibold text-slate-900 leading-none cursor-pointer">
                              Has Exams
                            </Label>
                            {hasExams && (
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] font-medium text-slate-500">
                                  Number:
                                </label>
                                <Input
                                  id="number_of_exams"
                                  type="number"
                                  min="1"
                                  max="99"
                                  value={formData.number_of_exams || ""}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    // Allow empty string for better UX
                                    if (value === "") {
                                      setFormData({ ...formData, number_of_exams: 0 });
                                    } else {
                                      const numValue = parseInt(value, 10);
                                      if (!isNaN(numValue) && numValue > 0) {
                                        setFormData({ ...formData, number_of_exams: numValue });
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    // Ensure at least 1 if hasExams is true and field is empty
                                    if (hasExams && (!e.target.value || parseInt(e.target.value, 10) < 1)) {
                                      setFormData({ ...formData, number_of_exams: 1 });
                                    }
                                  }}
                                  placeholder="1"
                                  className="h-8 w-20 rounded-lg border-slate-200 bg-white px-2 text-sm font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                                />
                              </div>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug">
                            {hasExams 
                              ? "Specify how many exams are required for this training program."
                              : "This training program does not include any exams."
                            }
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                        <Switch
                          id="is_active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                        />
                        <div className="min-w-0">
                          <Label htmlFor="is_active" className="text-xs font-semibold text-slate-900 leading-none cursor-pointer">
                            Active
                          </Label>
                          <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                            Whether this syllabus is available for student enrollment.
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
                    disabled={!formData.name.trim()}
                    className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                  >
                    Create Syllabus
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      {filteredSyllabi.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <GraduationCap className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <p className="text-slate-900 font-semibold mb-2">
            {searchTerm ? "No matching syllabi" : "No syllabi configured"}
          </p>
          <p className="text-sm text-slate-500 mb-4">
            {searchTerm ? "Try a different search term" : "Click \"Add New\" to get started."}
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="font-semibold text-slate-700">Name</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center">Exams</TableHead>
                <TableHead className="font-semibold text-slate-700">Status</TableHead>
                <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSyllabi.map((syllabus) => (
                <TableRow key={syllabus.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium text-slate-900">
                    <div>
                      <div>{syllabus.name}</div>
                      {syllabus.description && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {syllabus.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-slate-600">
                    {syllabus.number_of_exams > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {syllabus.number_of_exams}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200 italic">
                        No exams
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                        syllabus.is_active
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      {syllabus.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(syllabus)}
                        className="hover:bg-slate-50"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {syllabus.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(syllabus.id)}
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          title="Void syllabus"
                        >
                          <Archive className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog 
        open={isEditDialogOpen} 
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingSyllabus(null);
            resetForm();
          }
        }}
      >
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
                  <Edit className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                    Edit Syllabus
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm text-slate-500">
                    Update syllabus details. Required fields are marked with{" "}
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
                      Syllabus Details
                    </span>
                  </div>

                  <div className="grid gap-5">
                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        NAME <span className="text-destructive">*</span>
                      </label>
                      <Input
                        id="edit-name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., PPL Ground School"
                        className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        DESCRIPTION
                      </label>
                      <Textarea
                        id="edit-description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Enter a brief description"
                        rows={3}
                        className="rounded-xl border-slate-200 bg-white px-3 py-2 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      />
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <Switch
                        id="edit-has_exams"
                        checked={hasExams}
                        onCheckedChange={(checked) => {
                          setHasExams(checked);
                          if (!checked) {
                            setFormData({ ...formData, number_of_exams: 0 });
                          }
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Label htmlFor="edit-has_exams" className="text-xs font-semibold text-slate-900 leading-none cursor-pointer">
                            Has Exams
                          </Label>
                          {hasExams && (
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] font-medium text-slate-500">
                                Number:
                              </label>
                              <Input
                                id="edit-number_of_exams"
                                type="number"
                                min="1"
                                max="99"
                                value={formData.number_of_exams || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Allow empty string for better UX
                                  if (value === "") {
                                    setFormData({ ...formData, number_of_exams: 0 });
                                  } else {
                                    const numValue = parseInt(value, 10);
                                    if (!isNaN(numValue) && numValue > 0) {
                                      setFormData({ ...formData, number_of_exams: numValue });
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  // Ensure at least 1 if hasExams is true and field is empty
                                  if (hasExams && (!e.target.value || parseInt(e.target.value, 10) < 1)) {
                                    setFormData({ ...formData, number_of_exams: 1 });
                                  }
                                }}
                                placeholder="1"
                                className="h-8 w-20 rounded-lg border-slate-200 bg-white px-2 text-sm font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                              />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">
                          {hasExams 
                            ? "Specify how many exams are required for this training program."
                            : "This training program does not include any exams."
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <Switch
                        id="edit-is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                      <div className="min-w-0">
                        <Label htmlFor="edit-is_active" className="text-xs font-semibold text-slate-900 leading-none cursor-pointer">
                          Active
                        </Label>
                        <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                          Whether this syllabus is available for student enrollment.
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
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingSyllabus(null);
                    resetForm();
                  }}
                  className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleEdit}
                  disabled={!formData.name.trim()}
                  className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                >
                  Update Syllabus
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
