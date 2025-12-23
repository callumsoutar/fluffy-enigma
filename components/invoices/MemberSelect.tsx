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
import { ChevronDown } from "lucide-react"

export interface UserResult {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

interface MemberSelectProps {
  value: UserResult | null
  onSelect: (user: UserResult | null) => void
  disabled?: boolean
}

export default function MemberSelect({
  value,
  onSelect,
  disabled = false,
}: MemberSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [users, setUsers] = useState<UserResult[]>([])
  const [loading, setLoading] = useState(false)

  const debouncedSearch = useDebounce(search, 300)

  // Fetch users when search changes
  useEffect(() => {
    if (!open) return

    const fetchUsers = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (debouncedSearch) {
          params.append('search', debouncedSearch)
        }

        const response = await fetch(`/api/users?${params.toString()}`)
        if (!response.ok) {
          throw new Error('Failed to fetch users')
        }
        const data = await response.json()
        setUsers(data.users || [])
      } catch (error) {
        console.error('Error fetching users:', error)
        setUsers([])
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [debouncedSearch, open])

  const displayName = value
    ? [value.first_name, value.last_name].filter(Boolean).join(" ") || value.email
    : "Select member..."

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-10 w-full justify-between rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0"
        >
          <span className="truncate">{displayName}</span>
          <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl border-slate-200 shadow-xl" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search members..." value={search} onValueChange={setSearch} className="border-none focus:ring-0" />
          <CommandList className="max-h-[300px]">
            {loading ? (
              <div className="py-6 text-center text-sm text-slate-500">
                Loading...
              </div>
            ) : users.length === 0 ? (
              <CommandEmpty>No members found.</CommandEmpty>
            ) : (
              <CommandGroup>
                <CommandItem
                  value="none"
                  onSelect={() => {
                    onSelect(null)
                    setOpen(false)
                  }}
                  className="rounded-lg py-2.5"
                >
                  No member selected
                </CommandItem>
                {users.map((user) => {
                  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email
                  return (
                    <CommandItem
                      key={user.id}
                      value={`${displayName} ${user.email}`}
                      onSelect={() => {
                        onSelect(user)
                        setOpen(false)
                      }}
                      className="rounded-lg py-2.5"
                    >
                      <span className="font-medium">{displayName}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
