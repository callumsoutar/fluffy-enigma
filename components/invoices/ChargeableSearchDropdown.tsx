"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus } from "lucide-react"
import type { Chargeable } from "@/lib/types/database"

interface ChargeableSearchDropdownProps {
  onAdd: (chargeable: Chargeable, quantity: number) => void
  taxRate?: number
  disabled?: boolean
}

export default function ChargeableSearchDropdown({
  onAdd,
  taxRate = 0.15,
  disabled = false,
}: ChargeableSearchDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [chargeables, setChargeables] = useState<Chargeable[]>([])
  const [loading, setLoading] = useState(false)
  const [quantity, setQuantity] = useState(1)

  const debouncedSearch = useDebounce(search, 300)

  // Fetch chargeables when search changes
  useEffect(() => {
    if (!open) return

    const fetchChargeables = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (debouncedSearch) {
          params.append('search', debouncedSearch)
        }
        params.append('is_active', 'true')

        const response = await fetch(`/api/chargeables?${params.toString()}`)
        if (!response.ok) {
          throw new Error('Failed to fetch chargeables')
        }
        const data = await response.json()
        setChargeables(data.chargeables || [])
      } catch (error) {
        console.error('Error fetching chargeables:', error)
        setChargeables([])
      } finally {
        setLoading(false)
      }
    }

    fetchChargeables()
  }, [debouncedSearch, open])

  const handleSelect = (chargeable: Chargeable) => {
    if (quantity > 0) {
      onAdd(chargeable, quantity)
      setSearch("")
      setQuantity(1)
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-start"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search chargeables..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : chargeables.length === 0 ? (
              <CommandEmpty>No chargeables found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {chargeables.map((chargeable) => (
                  <CommandItem
                    key={chargeable.id}
                    value={`${chargeable.name} ${chargeable.description || ''}`}
                    onSelect={() => handleSelect(chargeable)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{chargeable.name}</span>
                      {chargeable.description && (
                        <span className="text-xs text-muted-foreground">
                          {chargeable.description}
                        </span>
                      )}
                      {chargeable.rate !== null && (
                        <span className="text-xs text-muted-foreground">
                          ${chargeable.rate.toFixed(2)}
                          {chargeable.is_taxable && ` (incl. ${(taxRate * 100).toFixed(0)}% tax)`}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
        <div className="border-t p-2 flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Quantity:</label>
          <Input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-20"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && chargeables.length > 0) {
                e.preventDefault()
                handleSelect(chargeables[0])
              }
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
