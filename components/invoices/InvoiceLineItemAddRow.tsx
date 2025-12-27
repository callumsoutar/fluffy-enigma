"use client"

import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import type { Chargeable } from "@/lib/types/database"
import type { ChargeableType } from "@/lib/types/chargeables"
import { InvoiceCalculations } from "@/lib/invoice-calculations"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { Plus, X, Search } from "lucide-react"

type TaxCode = "taxable" | "non_taxable"

/**
 * Map chargeable type codes to emoji icons
 */
function getTypeEmoji(code: string): string {
  const codeLower = code.toLowerCase()
  if (codeLower.includes("aircraft") || codeLower.includes("rental")) return "✈️"
  if (codeLower.includes("instruction") || codeLower.includes("training")) return "📚"
  if (codeLower.includes("membership")) return "👥"
  if (codeLower.includes("fuel")) return "⛽"
  if (codeLower.includes("maintenance") || codeLower.includes("repair")) return "🔧"
  if (codeLower.includes("storage") || codeLower.includes("hangar")) return "🏢"
  if (codeLower.includes("cleaning")) return "🧹"
  if (codeLower.includes("rental") || codeLower.includes("room")) return "🏠"
  if (codeLower.includes("fee")) return "💰"
  if (codeLower.includes("insurance")) return "🛡️"
  return "📦" // Default
}

interface InvoiceLineItemAddRowProps {
  disabled?: boolean
  taxRate?: number
  /**
   * Number of table columns to span when collapsed.
   * Defaults to 6 (Item, Qty, Rate, Tax, Amount, Actions).
   */
  colSpan?: number
  onAdd: (item: {
    chargeable: Chargeable
    chargeable_id: string
    quantity: number
    unit_price: number
    description: string
    tax_rate_id?: string
  }) => void
  layout?: "table-row" | "div"
}

export default function InvoiceLineItemAddRow({
  disabled = false,
  taxRate = 0.15,
  colSpan = 6,
  onAdd,
  layout = "div",
}: InvoiceLineItemAddRowProps) {
  const [active, setActive] = useState(false)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 250)

  const [loading, setLoading] = useState(false)
  const [chargeables, setChargeables] = useState<Chargeable[]>([])
  const [selected, setSelected] = useState<Chargeable | null>(null)

  const [typesLoading, setTypesLoading] = useState(false)
  const [chargeableTypes, setChargeableTypes] = useState<ChargeableType[]>([])
  const [selectedTypeId, setSelectedTypeId] = useState<string>("all")

  const [description, setDescription] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState<number>(0)
  const [taxCode, setTaxCode] = useState<TaxCode>("taxable")

  const searchInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return

    const fetchChargeables = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (debouncedSearch) params.append("search", debouncedSearch)
        params.append("is_active", "true")
        if (selectedTypeId !== "all") params.append("chargeable_type_id", selectedTypeId)
        const res = await fetch(`/api/chargeables?${params.toString()}`)
        if (!res.ok) throw new Error("Failed to fetch chargeables")
        const data = await res.json()
        setChargeables(data.chargeables || [])
      } catch (e) {
        console.error(e)
        setChargeables([])
      } finally {
        setLoading(false)
      }
    }

    fetchChargeables()
  }, [debouncedSearch, open, selectedTypeId])

  useEffect(() => {
    if (!open) return

    const fetchTypes = async () => {
      setTypesLoading(true)
      try {
        const res = await fetch("/api/chargeable_types?is_active=true")
        if (!res.ok) throw new Error("Failed to fetch chargeable types")
        const data = await res.json()
        setChargeableTypes(data.chargeable_types || [])
      } catch (e) {
        console.error(e)
        setChargeableTypes([])
      } finally {
        setTypesLoading(false)
      }
    }

    fetchTypes()
  }, [open])

  // Focus command input when opening
  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => searchInputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  const effectiveTaxRate = taxCode === "taxable" ? taxRate : 0

  const preview = useMemo(() => {
    return InvoiceCalculations.calculateItemAmounts({
      quantity,
      unit_price: unitPrice,
      tax_rate: effectiveTaxRate,
    })
  }, [effectiveTaxRate, quantity, unitPrice])

  const canAdd =
    !disabled &&
    !!selected &&
    description.trim().length > 0 &&
    quantity > 0 &&
    Number.isFinite(unitPrice) &&
    unitPrice >= 0

  const reset = () => {
    setSelected(null)
    setDescription("")
    setSearch("")
    setQuantity(1)
    setUnitPrice(0)
    setTaxCode("taxable")
    setOpen(false)
    setActive(false)
  }

  const handleAdd = () => {
    if (!selected || !canAdd) return
    onAdd({
      chargeable: selected,
      chargeable_id: selected.id,
      description: description.trim(),
      quantity,
      unit_price: unitPrice,
    })
    reset()
  }

  const activate = () => {
    if (disabled) return
    setActive(true)
    // Open the chargeable picker immediately for fast entry.
    window.setTimeout(() => setOpen(true), 0)
  }

  if (layout === "table-row") {
    if (!active) {
      return (
        <TableRow className="border-t bg-muted/15 hover:bg-muted/20">
          <TableCell colSpan={colSpan} className="p-2">
            <Button
              type="button"
              variant="ghost"
              onClick={activate}
              disabled={disabled}
              className="h-10 w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Add line item
            </Button>
          </TableCell>
        </TableRow>
      )
    }

    return (
      <TableRow className="border-t bg-muted/10 hover:bg-muted/10">
        <TableCell className="p-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <div>
                <Input
                  value={description}
                  readOnly
                  placeholder="Item…"
                  disabled={disabled}
                  onClick={() => setOpen(true)}
                  className="h-9"
                />
              </div>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[520px] max-w-[calc(100vw-2rem)] p-0">
              <Command shouldFilter={false}>
                <div className="border-b p-2.5 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium text-muted-foreground whitespace-nowrap">Type</div>
                    <Select
                      value={selectedTypeId}
                      onValueChange={setSelectedTypeId}
                      disabled={disabled || typesLoading}
                    >
                      <SelectTrigger className="h-8 w-[180px]">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectItem value="all">
                          <span className="flex items-center gap-1.5">
                            <span>🔍</span>
                            <span>All types</span>
                          </span>
                        </SelectItem>
                        {chargeableTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <span className="flex items-center gap-1.5">
                              <span>{getTypeEmoji(t.code)}</span>
                              <span>{(t.name as string) || t.code}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <CommandInput
                  ref={searchInputRef}
                  placeholder="Search chargeables…"
                  value={search}
                  onValueChange={setSearch}
                  disabled={disabled}
                />
                <CommandList className="max-h-[280px]">
                  {loading ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
                  ) : chargeables.length === 0 ? (
                    <CommandEmpty>No chargeables found.</CommandEmpty>
                  ) : (
                    <CommandGroup>
                      {chargeables.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.name} ${c.description || ""}`}
                          onSelect={() => {
                            setSelected(c)
                            setDescription(c.name)
                            setSearch(c.name)
                            setUnitPrice(c.rate ?? 0)
                            setTaxCode(c.is_taxable ? "taxable" : "non_taxable")
                            setOpen(false)
                          }}
                          className="flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">{c.name}</div>
                            {c.description ? (
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {c.description}
                              </div>
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap pt-0.5 tabular-nums">
                            {c.rate !== null ? `$${c.rate.toFixed(2)}` : "—"}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </TableCell>

        <TableCell className="p-2">
          <Input
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            disabled={disabled || !selected}
            className="h-9 text-right tabular-nums"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAdd()
              }
            }}
          />
        </TableCell>

        <TableCell className="p-2">
          <Input
            type="number"
            min={0}
            step={0.01}
            value={unitPrice}
            onChange={(e) => setUnitPrice(Math.max(0, Number(e.target.value) || 0))}
            disabled={disabled || !selected}
            className="h-9 text-right tabular-nums"
          />
        </TableCell>

        <TableCell className="p-2">
          <Select
            value={taxCode}
            onValueChange={(v) => setTaxCode(v as TaxCode)}
            disabled={disabled || !selected}
          >
            <SelectTrigger className="w-full h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="taxable">
                Taxable ({Math.round(taxRate * 100)}%)
              </SelectItem>
              <SelectItem value="non_taxable">Non-taxable</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>

        <TableCell className="p-2 text-right font-semibold tabular-nums">
          ${preview.line_total.toFixed(2)}
        </TableCell>

        <TableCell className="p-2">
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={reset}
              disabled={disabled}
              className={cn("h-9 w-9", !selected && "opacity-60")}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={!canAdd}
              className="h-9 gap-2"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  // Div Layout (default for Check-In page)
  return (
    <div className="p-4 bg-muted/5 border-t border-border/40">
      <div className="flex items-center gap-3">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              className="flex-1 justify-start gap-2 h-9 border-dashed text-muted-foreground hover:text-foreground hover:bg-white"
            >
              {selected ? (
                <>
                  <span className="font-bold text-xs text-foreground">{selected.name}</span>
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" />
                  <span className="text-xs font-bold uppercase tracking-widest opacity-60">Search chargeables…</span>
                </>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[400px] p-0 shadow-2xl rounded-xl overflow-hidden border-none">
            <Command shouldFilter={false}>
              <CommandInput
                ref={searchInputRef}
                placeholder="Type to search…"
                value={search}
                onValueChange={setSearch}
                className="h-11"
              />
              <CommandList className="max-h-[300px]">
                {loading ? (
                  <div className="py-8 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Searching…</div>
                ) : chargeables.length === 0 ? (
                  <CommandEmpty className="py-8 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">No matches found</CommandEmpty>
                ) : (
                  <CommandGroup>
                    {chargeables.map((c) => (
                      <CommandItem
                        key={c.id}
                        onSelect={() => {
                          setSelected(c)
                          setDescription(c.name)
                          setUnitPrice(c.rate ?? 0)
                          setTaxCode(c.is_taxable ? "taxable" : "non_taxable")
                          setOpen(false)
                        }}
                        className="flex items-center justify-between py-3 px-4 cursor-pointer"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-sm">{c.name}</span>
                          {c.description && <span className="text-[10px] text-muted-foreground line-clamp-1">{c.description}</span>}
                        </div>
                        {c.rate !== null && <span className="text-xs font-black tabular-nums">${c.rate.toFixed(2)}</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selected && (
          <div className="flex items-center gap-3 animate-in slide-in-from-right-2 duration-200">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">Qty</span>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="w-14 h-9 text-center font-bold tabular-nums"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">Rate</span>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
                  className="w-20 h-9 pl-5 text-right font-bold tabular-nums"
                />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={reset} className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/5">
                <X className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={handleAdd} className="h-9 px-4 font-black uppercase tracking-widest text-[10px] gap-2 shadow-lg shadow-primary/10">
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
