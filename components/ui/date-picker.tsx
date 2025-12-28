"use client"

import * as React from "react"
import { format, parse, isValid, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date?: string | null
  onChange?: (date: string | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  fromYear?: number
  toYear?: number
}

export function DatePicker({
  date,
  onChange,
  placeholder = "DD/MM/YYYY",
  className,
  disabled,
  fromYear = 1900,
  toYear = new Date().getFullYear() + 10,
}: DatePickerProps) {
  // inputValue tracks the text in the input field
  const [inputValue, setInputValue] = React.useState("")
  const [isOpen, setIsOpen] = React.useState(false)

  // Sync internal input value with external date prop
  React.useEffect(() => {
    if (date) {
      try {
        const parsedDate = parseISO(date)
        if (isValid(parsedDate)) {
          setInputValue(format(parsedDate, "dd/MM/yyyy"))
        }
      } catch {
        setInputValue("")
      }
    } else {
      setInputValue("")
    }
  }, [date])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)

    // Attempt to parse the date as the user types
    // Support dd/MM/yyyy and handle common separators
    const normalizedValue = value.replace(/[-.]/g, "/")
    if (normalizedValue.length >= 8) {
      const parsedDate = parse(normalizedValue, "dd/MM/yyyy", new Date())
      if (isValid(parsedDate) && format(parsedDate, "dd/MM/yyyy") === normalizedValue) {
        onChange?.(format(parsedDate, "yyyy-MM-dd"))
      }
    }
  }

  const handleBlur = () => {
    if (!inputValue) {
      onChange?.(null)
      return
    }

    const normalizedValue = inputValue.replace(/[-.]/g, "/")
    const parsedDate = parse(normalizedValue, "dd/MM/yyyy", new Date())
    
    if (isValid(parsedDate)) {
      const isoDate = format(parsedDate, "yyyy-MM-dd")
      onChange?.(isoDate)
      setInputValue(format(parsedDate, "dd/MM/yyyy"))
    } else {
      // If invalid, reset to the current prop value
      if (date) {
        setInputValue(format(parseISO(date), "dd/MM/yyyy"))
      } else {
        setInputValue("")
      }
    }
  }

  const selectedDate = date ? parseISO(date) : undefined

  return (
    <div className={cn("relative w-full", className)}>
      <Input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-10 bg-white border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
      />
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-500 transition-colors"
            disabled={disabled}
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(newDate) => {
              if (newDate) {
                onChange?.(format(newDate, "yyyy-MM-dd"))
                setInputValue(format(newDate, "dd/MM/yyyy"))
              } else {
                onChange?.(null)
                setInputValue("")
              }
              setIsOpen(false)
            }}
            disabled={disabled}
            initialFocus
            captionLayout="dropdown"
            fromYear={fromYear}
            toYear={toYear}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

