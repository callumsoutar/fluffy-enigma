"use client"

import * as React from "react"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { IconGripVertical } from "@tabler/icons-react"
import { toast } from "sonner"

import type { AircraftWithType } from "@/lib/types/aircraft"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type SortableId = string

function SortableRow(props: {
  id: SortableId
  primary: string
  secondary?: string | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={[
        "flex items-center gap-3 rounded-md border bg-white px-3 py-2",
        isDragging ? "opacity-70" : "",
      ].join(" ")}
    >
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-slate-50"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <IconGripVertical className="h-4 w-4 text-slate-500" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-slate-900">{props.primary}</div>
        {props.secondary ? (
          <div className="truncate text-xs text-slate-600">{props.secondary}</div>
        ) : null}
      </div>
    </div>
  )
}

const reorderSchema = {
  async save(items: { id: string; order: number }[]) {
    const res = await fetch("/api/aircraft/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    })
    if (!res.ok) {
      let message = "Failed to update aircraft order"
      try {
        const data = await res.json()
        message = data?.error || message
      } catch {
        // ignore
      }
      throw new Error(message)
    }
  },
}

export function ReorderAircraftModal(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  aircraft: AircraftWithType[]
  onSaved?: () => void
}) {
  const [ids, setIds] = React.useState<SortableId[]>([])
  const [saving, setSaving] = React.useState(false)

  const aircraftById = React.useMemo(() => {
    return new Map(props.aircraft.map((a) => [a.id, a]))
  }, [props.aircraft])

  React.useEffect(() => {
    if (!props.open) return
    // Use the incoming order from the API as the initial ordering.
    setIds(props.aircraft.map((a) => a.id))
  }, [props.open, props.aircraft])

  const onDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    if (active.id === over.id) return
    setIds((prev) => {
      const oldIndex = prev.indexOf(String(active.id))
      const newIndex = prev.indexOf(String(over.id))
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }, [])

  const canSave = ids.length > 0 && !saving

  const handleSave = React.useCallback(async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const items = ids.map((id, idx) => ({ id, order: idx + 1 }))
      await reorderSchema.save(items)
      toast.success("Aircraft order updated")
      props.onOpenChange(false)
      props.onSaved?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update aircraft order")
    } finally {
      setSaving(false)
    }
  }, [canSave, ids, props])

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reorder aircraft</DialogTitle>
          <DialogDescription>
            Drag aircraft to set the scheduler display order. Lower order values render higher.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-2 overflow-auto">
          <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {ids.map((id) => {
                const a = aircraftById.get(id)
                if (!a) return null
                return (
                  <SortableRow
                    key={id}
                    id={id}
                    primary={a.registration}
                    secondary={a.type || a.aircraft_type?.name || null}
                  />
                )
              })}
            </SortableContext>
          </DndContext>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

