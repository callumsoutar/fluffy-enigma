"use client"

import * as React from "react"
import { IconRotateClockwise, IconDeviceFloppy } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"

interface StickyFormActionsProps {
  formId?: string
  isDirty: boolean
  isSaving?: boolean
  onUndo: () => void
  onSave?: () => void // Optional direct save handler instead of form submit
  message: string
  undoLabel?: string
  saveLabel?: string
}

export function StickyFormActions({
  formId,
  isDirty,
  isSaving,
  onUndo,
  onSave,
  message,
  undoLabel = "Undo changes",
  saveLabel = "Save",
}: StickyFormActionsProps) {
  const isMobile = useIsMobile()
  const [sidebarLeft, setSidebarLeft] = React.useState(0)

  React.useEffect(() => {
    if (isMobile) {
      setSidebarLeft(0)
      return
    }

    const updateSidebarPosition = () => {
      if (isMobile) {
        setSidebarLeft(0)
        return
      }

      // Try to find the sidebar gap which represents the space taken by the sidebar
      const sidebarGap = document.querySelector('[data-slot="sidebar-gap"]')
      if (sidebarGap) {
        const computedWidth = window.getComputedStyle(sidebarGap).width
        const width = parseFloat(computedWidth) || 0
        if (width > 0) {
          setSidebarLeft(width)
          return
        }
      }

      // Fallback: Try to find the sidebar itself
      const sidebar = document.querySelector('[data-slot="sidebar"]')
      if (sidebar) {
        const state = sidebar.getAttribute("data-state")
        const collapsible = sidebar.getAttribute("data-collapsible")
        const variant = sidebar.getAttribute("data-variant")

        if (state === "collapsed") {
          if (collapsible === "icon") {
            setSidebarLeft(variant === "inset" ? 64 : 48)
          } else {
            setSidebarLeft(0)
          }
          return
        }

        // If expanded, try to get the width from container
        const sidebarContainer = sidebar.querySelector('[data-slot="sidebar-container"]')
        if (sidebarContainer) {
          const computedWidth = window.getComputedStyle(sidebarContainer).width
          const width = parseFloat(computedWidth) || 256
          setSidebarLeft(width)
          return
        }
      }

      // Last resort fallback: Check CSS variables
      const sidebarWrapper = document.querySelector('[data-slot="sidebar-wrapper"]')
      const sidebarWidthVar = sidebarWrapper 
        ? window.getComputedStyle(sidebarWrapper).getPropertyValue("--sidebar-width")
        : window.getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width")

      if (sidebarWidthVar) {
        const match = sidebarWidthVar.match(/calc\(var\(--spacing\)\s*\*\s*(\d+)\)/)
        if (match) {
          const multiplier = parseInt(match[1], 10)
          setSidebarLeft(multiplier * 4)
        } else if (sidebarWidthVar.includes('rem')) {
          setSidebarLeft(parseFloat(sidebarWidthVar) * 16)
        } else if (sidebarWidthVar.includes('px')) {
          setSidebarLeft(parseFloat(sidebarWidthVar))
        } else {
          setSidebarLeft(256)
        }
      } else {
        setSidebarLeft(256)
      }
    }

    updateSidebarPosition()

    // Add a small delay to ensure initial calculation is correct after mount
    const timer = setTimeout(updateSidebarPosition, 100)

    window.addEventListener("resize", updateSidebarPosition)
    window.addEventListener("transitionend", updateSidebarPosition)

    const observer = new MutationObserver(updateSidebarPosition)
    const sidebarWrapper = document.querySelector('[data-slot="sidebar-wrapper"]')
    if (sidebarWrapper) {
      observer.observe(sidebarWrapper, { 
        attributes: true, 
        attributeFilter: ["data-state", "data-collapsible"],
        subtree: true
      })
    }

    return () => {
      clearTimeout(timer)
      window.removeEventListener("resize", updateSidebarPosition)
      window.removeEventListener("transitionend", updateSidebarPosition)
      observer.disconnect()
    }
  }, [isMobile])

  if (!isDirty) {
    return null
  }

  const finalSaveLabel = isSaving ? "Saving…" : saveLabel

  return (
    <div
      className="fixed bottom-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl"
      style={{
        left: isMobile ? 0 : `${sidebarLeft}px`,
        right: 0,
        zIndex: 50,
      }}
    >
      <div
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{message}</p>
          <div className="flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onUndo}
              disabled={isSaving}
              className={`h-12 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium ${
                isMobile ? "flex-1 max-w-[200px]" : "px-8 min-w-[160px]"
              }`}
            >
              <IconRotateClockwise className="h-4 w-4 mr-2" />
              {undoLabel}
            </Button>
            <Button
              type={formId ? "submit" : "button"}
              form={formId}
              onClick={onSave}
              size="lg"
              disabled={isSaving}
              className={`h-12 bg-slate-700 hover:bg-slate-800 text-white font-semibold shadow-lg hover:shadow-xl transition-all ${
                isMobile ? "flex-1 max-w-[200px]" : "px-8 min-w-[160px]"
              }`}
            >
              <IconDeviceFloppy className="h-4 w-4 mr-2" />
              {finalSaveLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

