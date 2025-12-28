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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Archive, AlertCircle, FileText, ChevronDown, ChevronRight, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Exam, ExamFormData } from "@/lib/types/exam";
import type { Syllabus } from "@/lib/types/syllabus";

export default function ExamsConfig() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [formData, setFormData] = useState<ExamFormData>({
    name: "",
    description: "",
    syllabus_id: "none",
    passing_score: 70,
    is_active: true,
  });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const fetchExams = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/exams");
      if (!response.ok) {
        throw new Error("Failed to fetch exams");
      }
      const data = await response.json();
      setExams(data.exams || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchSyllabi = async () => {
    try {
      const response = await fetch("/api/syllabus");
      if (!response.ok) {
        throw new Error("Failed to fetch syllabi");
      }
      const data = await response.json();
      setSyllabi(data.syllabi || []);
    } catch (err) {
      console.error("Failed to fetch syllabi:", err);
    }
  };

  useEffect(() => {
    fetchExams();
    fetchSyllabi();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      syllabus_id: "none",
      passing_score: 70,
      is_active: true,
    });
  };

  const handleAdd = async () => {
    try {
      setError(null);
      const response = await fetch("/api/exams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          syllabus_id: formData.syllabus_id === "none" ? null : formData.syllabus_id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create exam");
      }

      await fetchExams();
      setIsAddDialogOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleEdit = async () => {
    if (!editingExam) return;

    try {
      setError(null);
      const response = await fetch("/api/exams", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          id: editingExam.id,
          syllabus_id: formData.syllabus_id === "none" ? null : formData.syllabus_id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update exam");
      }

      await fetchExams();
      setIsEditDialogOpen(false);
      setEditingExam(null);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to deactivate this exam? This will make it unavailable for new entries."
      )
    ) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/exams?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to deactivate exam");
      }

      await fetchExams();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const openEditDialog = (exam: Exam) => {
    setEditingExam(exam);
    setFormData({
      name: exam.name,
      description: exam.description || "",
      syllabus_id: exam.syllabus_id || "none",
      passing_score: exam.passing_score,
      is_active: exam.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const getSyllabusName = (syllabusId: string) => {
    const syllabus = syllabi.find((s) => s.id === syllabusId);
    return syllabus ? syllabus.name : "Independent Exams";
  };

  const toggleGroup = (syllabusId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [syllabusId]: !prev[syllabusId],
    }));
  };

  const groupedExams = exams.reduce((groups, exam) => {
    const key = exam.syllabus_id || "no-syllabus";
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(exam);
    return groups;
  }, {} as Record<string, Exam[]>);

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-500">Loading exams...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header Section */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <FileText className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-slate-900">Exams</h3>
      </div>
      
      <p className="text-sm text-slate-600">
        Configure theoretical exams, assessments, and passing requirements.
      </p>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-500">
          {exams.length} {exams.length === 1 ? "exam" : "exams"} total
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Exam
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
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                      Add New Exam
                    </DialogTitle>
                    <DialogDescription className="mt-0.5 text-sm text-slate-500">
                      Create a new theoretical exam or assessment. Required fields are marked with{" "}
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
                        Exam Details
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
                          placeholder="e.g., PPL Law Exam"
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

                      <div>
                        <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          SYLLABUS (OPTIONAL)
                        </label>
                        <Select
                          value={formData.syllabus_id}
                          onValueChange={(value) => setFormData({ ...formData, syllabus_id: value })}
                        >
                          <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                            <SelectValue placeholder="Select a syllabus" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Syllabus</SelectItem>
                            {syllabi.map((syllabus) => (
                              <SelectItem key={syllabus.id} value={syllabus.id}>
                                {syllabus.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            PASSING SCORE (%)
                          </label>
                          <Input
                            id="passing_score"
                            type="number"
                            min="0"
                            max="100"
                            value={formData.passing_score}
                            onChange={(e) => setFormData({ ...formData, passing_score: parseInt(e.target.value) || 0 })}
                            className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                          />
                        </div>

                        <div className="flex items-center h-full pt-5">
                          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 w-full">
                            <Switch
                              id="is_active"
                              checked={formData.is_active}
                              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                            />
                            <div className="min-w-0">
                              <Label htmlFor="is_active" className="text-xs font-semibold text-slate-900 leading-none cursor-pointer">
                                Active
                              </Label>
                            </div>
                          </div>
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
                    Create Exam
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {Object.keys(groupedExams).length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <FileText className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <p className="text-slate-900 font-semibold mb-2">No exams configured</p>
          <p className="text-sm text-slate-500 mb-4">
            Click &quot;Add Exam&quot; to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedExams).map(([syllabusId, syllabusExams]) => {
            const isExpanded = expandedGroups[syllabusId] || false;
            return (
              <div key={syllabusId} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors border-b border-transparent data-[expanded=true]:border-slate-100"
                  data-expanded={isExpanded}
                  onClick={() => toggleGroup(syllabusId)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      {syllabusId === "no-syllabus" ? <FileText className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        {syllabusId === "no-syllabus" ? "Independent Exams" : getSyllabusName(syllabusId)}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                        {syllabusExams.length} exam{syllabusExams.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    )}
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50 border-t">
                          <TableHead className="font-semibold text-slate-700 pl-6">Exam Name</TableHead>
                          <TableHead className="font-semibold text-slate-700 text-center">Pass Mark</TableHead>
                          <TableHead className="font-semibold text-slate-700">Status</TableHead>
                          <TableHead className="text-right font-semibold text-slate-700 pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {syllabusExams.map((exam) => (
                          <TableRow key={exam.id} className="hover:bg-slate-50 group">
                            <TableCell className="font-medium text-slate-900 pl-6 py-4">
                              <div>
                                <div>{exam.name}</div>
                                {exam.description && (
                                  <div className="text-xs text-slate-500 mt-0.5 line-clamp-1 group-hover:line-clamp-none">
                                    {exam.description}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-slate-600">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {exam.passing_score}%
                              </span>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                                  exam.is_active
                                    ? "bg-green-50 text-green-700 border border-green-200"
                                    : "bg-slate-100 text-slate-600 border border-slate-200"
                                }`}
                              >
                                {exam.is_active ? "Active" : "Inactive"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditDialog(exam);
                                  }}
                                  className="hover:bg-slate-50"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                {exam.is_active && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(exam.id);
                                    }}
                                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                    title="Deactivate exam"
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
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
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
                    Edit Exam
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm text-slate-500">
                    Update exam details. Required fields are marked with{" "}
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
                      Exam Details
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
                        placeholder="e.g., PPL Law Exam"
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

                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        SYLLABUS (OPTIONAL)
                      </label>
                      <Select
                        value={formData.syllabus_id}
                        onValueChange={(value) => setFormData({ ...formData, syllabus_id: value })}
                      >
                        <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                          <SelectValue placeholder="Select a syllabus" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Syllabus</SelectItem>
                          {syllabi.map((syllabus) => (
                            <SelectItem key={syllabus.id} value={syllabus.id}>
                              {syllabus.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          PASSING SCORE (%)
                        </label>
                        <Input
                          id="edit-passing_score"
                          type="number"
                          min="0"
                          max="100"
                          value={formData.passing_score}
                          onChange={(e) => setFormData({ ...formData, passing_score: parseInt(e.target.value) || 0 })}
                          className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                        />
                      </div>

                      <div className="flex items-center h-full pt-5">
                        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 w-full">
                          <Switch
                            id="edit-is_active"
                            checked={formData.is_active}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                          />
                          <div className="min-w-0">
                            <Label htmlFor="edit-is_active" className="text-xs font-semibold text-slate-900 leading-none cursor-pointer">
                              Active
                            </Label>
                          </div>
                        </div>
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
                    setEditingExam(null);
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
                  Update Exam
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
