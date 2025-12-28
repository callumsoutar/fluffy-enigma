"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus, Trash2, Edit, GripVertical, HelpCircle, GraduationCap, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Syllabus } from "@/lib/types/syllabus";
import type { Lesson, SyllabusStage, LessonInsert, LessonUpdate } from "@/lib/types/lessons";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

// Fetch functions
const fetchSyllabi = async (): Promise<Syllabus[]> => {
  const response = await fetch("/api/syllabus");
  if (!response.ok) throw new Error("Failed to fetch syllabi");
  const data = await response.json();
  return data.syllabi || [];
};

const fetchLessons = async (syllabusId: string): Promise<Lesson[]> => {
  const response = await fetch(`/api/lessons?syllabus_id=${syllabusId}`);
  if (!response.ok) throw new Error("Failed to fetch lessons");
  const data = await response.json();
  return data.lessons || [];
};

interface SortableLessonItemProps {
  lesson: Lesson;
  onEdit: (lesson: Lesson) => void;
  onDelete: (id: string) => void;
}

function SortableLessonItem({ lesson, onEdit, onDelete }: SortableLessonItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl transition-all duration-200",
        isDragging ? "shadow-xl border-indigo-300 ring-2 ring-indigo-100 z-50" : "hover:border-slate-300 hover:shadow-sm"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing p-1"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-500 font-mono">
          #{lesson.order}
        </div>
        
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm text-slate-900 truncate">{lesson.name}</h4>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {lesson.is_required && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-indigo-100 text-indigo-700 border-indigo-200 shadow-none hover:bg-indigo-100">
                  Required
                </Badge>
              )}
              {lesson.syllabus_stage && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200 text-slate-600 font-medium bg-slate-50">
                  {lesson.syllabus_stage}
                </Badge>
              )}
              {!lesson.is_active && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-200 text-orange-600 font-medium bg-orange-50">
                  Inactive
                </Badge>
              )}
            </div>
          </div>
          {lesson.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 group-hover:line-clamp-none transition-all">
              {lesson.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
          onClick={() => onEdit(lesson)}
        >
          <Edit className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
          onClick={() => onDelete(lesson.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// Lesson creation/editing component
function LessonModal({
  isOpen,
  onClose,
  syllabusId,
  lesson = null
}: {
  isOpen: boolean;
  onClose: () => void;
  syllabusId: string;
  lesson?: Lesson | null;
}) {
  const queryClient = useQueryClient();

  const isEditing = !!lesson;

  // Compute initial values directly from props - no state initialization from props
  const getInitialValues = () => ({
    name: lesson?.name || "",
    description: lesson?.description || "",
    isRequired: lesson?.is_required ?? true,
    syllabusStage: (lesson?.syllabus_stage || "none") as SyllabusStage | "none"
  });

  const [formValues, setFormValues] = useState(getInitialValues);

  // Update form values when modal opens/closes or lesson changes
  // We schedule this as a separate effect that runs after render
  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    const timeoutId = setTimeout(() => {
      if (isOpen) {
        setFormValues(getInitialValues());
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [isOpen, lesson]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: async (data: LessonInsert | (LessonUpdate & { id: string })) => {
      const url = "/api/lessons";
      const method = isEditing ? "PATCH" : "POST";
      const body = isEditing ? { id: lesson?.id, ...data } : data;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${isEditing ? "update" : "create"} lesson`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons", syllabusId] });
      toast.success(`Lesson ${isEditing ? "updated" : "created"} successfully`);
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.name.trim()) return;

    const data = {
      name: formValues.name.trim(),
      description: formValues.description.trim() || null,
      is_required: formValues.isRequired,
      syllabus_stage: formValues.syllabusStage === "none" ? null : formValues.syllabusStage,
      ...(!isEditing && { syllabus_id: syllabusId }),
    };

    mutation.mutate(data as LessonInsert | (LessonUpdate & { id: string }));
  };

  const updateField = <K extends keyof typeof formValues>(field: K, value: typeof formValues[K]) => {
    setFormValues(prev => ({ ...prev, [field]: value }));
  };

  const syllabusStages: SyllabusStage[] = [
    'basic syllabus',
    'advances syllabus',
    'circuit training',
    'terrain and weather awareness',
    'instrument flying and flight test revision',
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[600px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                {isEditing ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  {isEditing ? "Edit Lesson" : "Add Lesson"}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  {isEditing 
                    ? "Update the lesson details below." 
                    : "Add a new training lesson to this syllabus."
                  }
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
            <div className="space-y-6">
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">
                    Lesson Details
                  </span>
                </div>

                <div className="grid gap-5">
                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      LESSON NAME <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={formValues.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="e.g., Circuit Training - Touch and Go"
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      DESCRIPTION
                    </label>
                    <Textarea
                      value={formValues.description}
                      onChange={(e) => updateField('description', e.target.value)}
                      placeholder="Objectives, coverage, and outcomes..."
                      rows={4}
                      className="rounded-xl border-slate-200 bg-white px-3 py-2 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        SYLLABUS STAGE
                      </label>
                      <Select value={formValues.syllabusStage} onValueChange={(value) => updateField('syllabusStage', value as SyllabusStage | "none")}>
                        <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                          <SelectValue placeholder="Select a stage" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {syllabusStages.map((stage) => (
                            <SelectItem key={stage} value={stage}>
                              {stage.charAt(0).toUpperCase() + stage.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center h-full pt-5">
                      <div className="flex h-full items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 w-full">
                        <Switch
                          checked={formValues.isRequired}
                          onCheckedChange={(checked) => updateField('isRequired', checked)}
                          id="required"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Label htmlFor="required" className="text-xs font-semibold text-slate-900 leading-none cursor-pointer">
                              Required
                            </Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger type="button">
                                  <HelpCircle className="w-3 h-3 text-slate-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-[11px] max-w-[200px]">
                                    Required lessons must be completed before progressing.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                            Mandatory for completion.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </form>

          <div className="border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={mutation.isPending || !formValues.name.trim()}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {mutation.isPending 
                  ? `${isEditing ? "Updating" : "Creating"}...` 
                  : isEditing ? "Update Lesson" : "Create Lesson"
                }
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function LessonsTab() {
  const [selectedSyllabus, setSelectedSyllabus] = useState<string | null>(null);
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const queryClient = useQueryClient();

  // Sensors for dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch syllabi
  const { data: syllabi = [], isLoading: syllabusLoading } = useQuery({
    queryKey: ["syllabi"],
    queryFn: fetchSyllabi,
  });

  // Fetch lessons for selected syllabus
  const { data: lessons = [], isLoading: lessonsLoading } = useQuery({
    queryKey: ["lessons", selectedSyllabus],
    queryFn: () => selectedSyllabus ? fetchLessons(selectedSyllabus) : Promise.resolve([]),
    enabled: !!selectedSyllabus,
  });

  const deleteLessonMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/lessons?id=${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete lesson");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons", selectedSyllabus] });
      toast.success("Lesson deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete lesson");
    },
  });

  // Reorder lessons mutation
  const reorderMutation = useMutation({
    mutationFn: async ({ syllabusId, lessonOrders }: { syllabusId: string; lessonOrders: { id: string; order: number }[] }) => {
      const response = await fetch("/api/lessons/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syllabus_id: syllabusId, lesson_orders: lessonOrders }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to reorder lessons");
      }
      return response.json();
    },
    onMutate: async ({ syllabusId, lessonOrders }) => {
      await queryClient.cancelQueries({ queryKey: ["lessons", syllabusId] });
      const previousLessons = queryClient.getQueryData<Lesson[]>(["lessons", syllabusId]);

      if (previousLessons) {
        const updatedLessons = lessonOrders.map(order => {
          const lesson = previousLessons.find(l => l.id === order.id);
          return lesson ? { ...lesson, order: order.order } : null;
        }).filter(Boolean) as Lesson[];
        
        updatedLessons.sort((a, b) => a.order - b.order);
        queryClient.setQueryData(["lessons", syllabusId], updatedLessons);
      }

      return { previousLessons, syllabusId };
    },
    onError: (err, variables, context) => {
      if (context?.previousLessons) {
        queryClient.setQueryData(["lessons", context.syllabusId], context.previousLessons);
      }
      toast.error("Failed to reorder lessons");
    },
    onSuccess: () => {
      toast.success("Lesson order updated");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons", selectedSyllabus] });
    },
  });

  // Handle drag and drop
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !selectedSyllabus || active.id === over.id) return;

    const oldIndex = lessons.findIndex((l) => l.id === active.id);
    const newIndex = lessons.findIndex((l) => l.id === over.id);

    const reorderedItems = arrayMove(lessons, oldIndex, newIndex);

    // Update order numbers
    const lessonOrders = reorderedItems.map((lesson, index) => ({
      id: lesson.id,
      order: index + 1,
    }));

    reorderMutation.mutate({ syllabusId: selectedSyllabus, lessonOrders });
  };

  const selectedSyllabusData = syllabi.find(s => s.id === selectedSyllabus);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header Section */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <BookOpen className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-slate-900">Lessons Management</h3>
      </div>
      
      <p className="text-sm text-slate-600">
        Create and manage training lessons for each syllabus. Drag and drop to reorder.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        {/* Left Column: Syllabi Selection */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Syllabi</h4>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {syllabusLoading ? (
              <div className="text-center py-8 text-slate-400 text-xs">Loading syllabi...</div>
            ) : syllabi.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs border border-dashed rounded-xl">
                No syllabi found.
              </div>
            ) : (
              syllabi.map((syllabus) => (
                <div
                  key={syllabus.id}
                  className={cn(
                    "group relative p-4 border rounded-xl cursor-pointer transition-all duration-200",
                    selectedSyllabus === syllabus.id
                      ? "border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-600"
                      : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"
                  )}
                  onClick={() => setSelectedSyllabus(syllabus.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={cn(
                          "font-bold text-sm truncate",
                          selectedSyllabus === syllabus.id ? "text-indigo-900" : "text-slate-900"
                        )}>
                          {syllabus.name}
                        </h4>
                        {!syllabus.is_active && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 border-orange-200 text-orange-600">Inactive</Badge>
                        )}
                      </div>
                      {syllabus.description && (
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{syllabus.description}</p>
                      )}
                    </div>
                    {selectedSyllabus === syllabus.id && (
                      <ChevronRight className="w-4 h-4 text-indigo-600 shrink-0" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Lessons List */}
        <div className="lg:col-span-8 flex flex-col gap-4 border-l border-slate-100 pl-6">
          <div className="flex items-center justify-between min-h-[32px]">
            {selectedSyllabusData ? (
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-bold text-slate-900">{selectedSyllabusData.name} Lessons</h4>
                <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 border-none">
                  {lessons.length} total
                </Badge>
              </div>
            ) : (
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Lessons</h4>
            )}
            
            {selectedSyllabus && (
              <Button 
                onClick={() => {
                  setEditingLesson(null);
                  setLessonModalOpen(true);
                }} 
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 h-8 text-[11px] font-bold rounded-lg px-3 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Lesson
              </Button>
            )}
          </div>

          <div className="flex-1">
            {!selectedSyllabus ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 rounded-[24px] bg-slate-50/30">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <GraduationCap className="w-6 h-6 text-slate-400" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">Select a Syllabus</h4>
                <p className="text-xs text-slate-500 max-w-[240px]">
                  Choose a syllabus from the left to manage its training lessons.
                </p>
              </div>
            ) : lessonsLoading ? (
              <div className="text-center py-20 text-slate-400 text-xs">Loading lessons...</div>
            ) : lessons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 rounded-[24px] bg-slate-50/30">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <Plus className="w-6 h-6 text-slate-400" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">No Lessons Found</h4>
                <p className="text-xs text-slate-500 max-w-[240px] mb-4">
                  Add the first lesson to the {selectedSyllabusData?.name} syllabus.
                </p>
                <Button 
                  onClick={() => setLessonModalOpen(true)} 
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-slate-200 text-xs font-bold"
                >
                  Create First Lesson
                </Button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalAxis]}
              >
                <SortableContext
                  items={lessons.map((l) => l.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 pb-4">
                    {lessons.map((lesson) => (
                      <SortableLessonItem
                        key={lesson.id}
                        lesson={lesson}
                        onEdit={(l) => {
                          setEditingLesson(l);
                          setLessonModalOpen(true);
                        }}
                        onDelete={(id) => deleteLessonMutation.mutate(id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedSyllabus && (
        <LessonModal
          isOpen={lessonModalOpen}
          onClose={() => {
            setLessonModalOpen(false);
            setEditingLesson(null);
          }}
          syllabusId={selectedSyllabus}
          lesson={editingLesson}
        />
      )}
    </div>
  );
}
