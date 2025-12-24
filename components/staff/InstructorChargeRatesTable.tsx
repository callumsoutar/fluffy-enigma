"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Check, X, Edit2, Trash2, Plus, Info } from "lucide-react"

interface FlightType {
  id: string
  name: string
}

interface Props {
  instructorId: string
}

interface Rate {
  id: string
  instructor_id: string
  flight_type_id: string
  rate_per_hour: string
  currency: string
  effective_from: string
}

interface EditingRate {
  id: string
  flight_type_id: string
  rate_per_hour: string
  effective_from: string
}

export default function InstructorChargeRatesTable({ instructorId }: Props) {
  const [rates, setRates] = useState<Rate[]>([])
  const [loading, setLoading] = useState(true)
  const [flightTypes, setFlightTypes] = useState<FlightType[]>([])
  const [editingRate, setEditingRate] = useState<EditingRate | null>(null)
  const [saving, setSaving] = useState(false)
  const [addingNewRate, setAddingNewRate] = useState(false)
  const [defaultTaxRate, setDefaultTaxRate] = useState<number>(0.15) // Default to 15%

  const todayIsoDate = () => new Date().toISOString().slice(0, 10)

  // Fetch rates
  useEffect(() => {
    async function fetchRates() {
      try {
        const ratesRes = await fetch(`/api/instructor-charge-rates?instructor_id=${instructorId}`)
        if (!ratesRes.ok) {
          setRates([])
        } else {
          const ratesData = await ratesRes.json()
          setRates(ratesData.rates || [])
        }
      } catch {
        setRates([])
      } finally {
        setLoading(false)
      }
    }
    fetchRates()
  }, [instructorId])

  // Fetch flight types and default tax rate
  useEffect(() => {
    async function fetchData() {
      try {
        const [typesRes, taxRes] = await Promise.all([
          fetch('/api/flight-types'),
          fetch('/api/tax-rates?is_default=true')
        ])

        if (!typesRes.ok) {
          return
        }

        const typesData = await typesRes.json()
        setFlightTypes(typesData.flight_types || [])

        if (taxRes.ok) {
          const taxData = await taxRes.json()
          if (taxData.tax_rates && taxData.tax_rates.length > 0) {
            setDefaultTaxRate(parseFloat(taxData.tax_rates[0].rate))
          }
        }
      } catch {
        // Don't show toast for initial data loading errors
      }
    }
    fetchData()
  }, [])

  const handleAddRate = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!flightTypes.length) {
      toast.error('No flight types available')
      return
    }

    // Get available flight types (not already assigned to this instructor)
    const assignedFlightTypeIds = rates.map(rate => rate.flight_type_id)
    const availableFlightTypes = flightTypes.filter(ft => !assignedFlightTypeIds.includes(ft.id))

    if (availableFlightTypes.length === 0) {
      toast.error('All flight types already have rates assigned')
      return
    }

    setAddingNewRate(true)
    setEditingRate({
      id: 'new',
      flight_type_id: availableFlightTypes[0].id,
      rate_per_hour: '',
      effective_from: todayIsoDate(),
    })
  }

  const handleSaveNewRate = async () => {
    if (!editingRate || editingRate.id !== 'new') return

    const taxInclusiveRate = parseFloat(editingRate.rate_per_hour)
    if (isNaN(taxInclusiveRate) || taxInclusiveRate < 0) {
      toast.error('Please enter a valid rate')
      return
    }

    if (!editingRate.flight_type_id) {
      toast.error('Please select a flight type')
      return
    }

    const taxExclusiveRate = calculateTaxExclusive(taxInclusiveRate)

    setSaving(true)
    try {
      const res = await fetch('/api/instructor-charge-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructor_id: instructorId,
          flight_type_id: editingRate.flight_type_id,
          rate_per_hour: taxExclusiveRate,
          effective_from: editingRate.effective_from,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to add rate')
      }

      // Refresh rates
      const ratesRes = await fetch(`/api/instructor-charge-rates?instructor_id=${instructorId}`)
      if (ratesRes.ok) {
        const ratesData = await ratesRes.json()
        setRates(ratesData.rates || [])
      }

      setAddingNewRate(false)
      setEditingRate(null)
      toast.success('Rate added successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add rate')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelNewRate = () => {
    setAddingNewRate(false)
    setEditingRate(null)
  }

  const handleEditRate = (rate: Rate) => {
    const taxInclusiveRate = calculateTaxInclusive(parseFloat(rate.rate_per_hour))

    setEditingRate({
      id: rate.id,
      flight_type_id: rate.flight_type_id,
      rate_per_hour: taxInclusiveRate.toFixed(2),
      effective_from: rate.effective_from || todayIsoDate(),
    })
  }

  const handleCancelEdit = () => {
    setEditingRate(null)
  }

  const handleSaveRate = async () => {
    if (!editingRate) return

    const taxInclusiveRate = parseFloat(editingRate.rate_per_hour)
    if (isNaN(taxInclusiveRate) || taxInclusiveRate < 0) {
      toast.error('Please enter a valid rate')
      return
    }

    const taxExclusiveRate = calculateTaxExclusive(taxInclusiveRate)

    setSaving(true)
    try {
      const res = await fetch('/api/instructor-charge-rates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingRate.id,
          rate_per_hour: taxExclusiveRate,
          effective_from: editingRate.effective_from,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to update rate')
      }

      // Refresh rates
      const ratesRes = await fetch(`/api/instructor-charge-rates?instructor_id=${instructorId}`)
      if (ratesRes.ok) {
        const ratesData = await ratesRes.json()
        setRates(ratesData.rates || [])
      }

      setEditingRate(null)
      toast.success('Rate updated successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update rate')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRate = async (rateId: string) => {
    if (!confirm('Are you sure you want to delete this rate?')) return

    try {
      const res = await fetch('/api/instructor-charge-rates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rateId }),
      })

      if (!res.ok) {
        throw new Error('Failed to delete rate')
      }

      // Refresh rates
      const ratesRes = await fetch(`/api/instructor-charge-rates?instructor_id=${instructorId}`)
      if (ratesRes.ok) {
        const ratesData = await ratesRes.json()
        setRates(ratesData.rates || [])
      }
      toast.success('Rate deleted successfully')
    } catch {
      toast.error('Failed to delete rate')
    }
  }

  const isEditing = (rateId: string) => editingRate?.id === rateId
  const isAddingNew = () => addingNewRate && editingRate?.id === 'new'

  const calculateTaxExclusive = (taxInclusiveAmount: number): number => {
    return taxInclusiveAmount / (1 + defaultTaxRate)
  }

  const calculateTaxInclusive = (taxExclusiveAmount: number): number => {
    return taxExclusiveAmount * (1 + defaultTaxRate)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-48"></div>
          </div>
          <div className="h-9 bg-gray-200 rounded animate-pulse w-24"></div>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="grid grid-cols-4 gap-4 items-center">
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
                <div className="flex gap-2 justify-end">
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const availableFlightTypes = flightTypes.filter(ft => {
    const isCurrentFlightType = editingRate?.flight_type_id === ft.id
    const isAlreadyAssigned = rates.some(rate => rate.flight_type_id === ft.id && rate.id !== editingRate?.id)
    return isCurrentFlightType || !isAlreadyAssigned
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 text-gray-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
          <Info className="w-4 h-4 text-indigo-500" />
          <p className="text-sm">
            Rates include <span className="font-semibold text-indigo-700">{Math.round(defaultTaxRate * 100)}% tax</span>
          </p>
        </div>
        <Button
          type="button"
          onClick={handleAddRate}
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm w-full sm:w-auto transition-all"
          disabled={addingNewRate || !!editingRate}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Rate
        </Button>
      </div>

      {rates.length === 0 && !addingNewRate ? (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center bg-gray-50/50">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
              <Plus className="w-8 h-8 text-indigo-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">No rates configured</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-[240px] mx-auto">Set up your first flight type rate to begin tracking charges.</p>
            </div>
            <Button
              type="button"
              onClick={handleAddRate}
              variant="outline"
              size="sm"
              className="mt-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            >
              Add First Rate
            </Button>
          </div>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
          {/* Mobile View: Cards (matches AircraftChargeRatesTable pattern) */}
          <div className="block sm:hidden divide-y divide-gray-100">
            {rates.map((rate) => (
              <div key={rate.id} className={`p-4 ${isEditing(rate.id) ? 'bg-indigo-50/50' : ''}`}>
                {isEditing(rate.id) ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500">Rate (Inc. Tax)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={editingRate?.rate_per_hour}
                          onChange={(e) => setEditingRate(prev => prev ? { ...prev, rate_per_hour: e.target.value } : null)}
                          className="pl-7 bg-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500">Effective From</label>
                      <Input
                        type="date"
                        value={editingRate?.effective_from}
                        onChange={(e) => setEditingRate(prev => prev ? { ...prev, effective_from: e.target.value } : null)}
                        className="bg-white"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1 bg-indigo-600"
                        onClick={handleSaveRate}
                        disabled={saving}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={handleCancelEdit}
                        disabled={saving}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                        <span className="font-semibold text-gray-900">
                          {flightTypes.find(ft => ft.id === rate.flight_type_id)?.name || 'Unknown'}
                        </span>
                      </div>
                      <span className="text-lg font-bold text-indigo-600">
                        ${calculateTaxInclusive(parseFloat(rate.rate_per_hour)).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        Effective {rate.effective_from ? new Date(rate.effective_from).toLocaleDateString() : 'Immediate'}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500"
                          onClick={() => handleEditRate(rate)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500"
                          onClick={() => handleDeleteRate(rate.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* New Rate Mobile Form */}
            {isAddingNew() && (
              <div className="p-4 bg-blue-50/50 space-y-4 border-t border-blue-100">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-blue-600">Flight Type</label>
                  <Select
                    value={editingRate?.flight_type_id}
                    onValueChange={(value) => setEditingRate(prev => prev ? { ...prev, flight_type_id: value } : null)}
                  >
                    <SelectTrigger className="w-full bg-white border-blue-200">
                      <SelectValue placeholder="Select flight type" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFlightTypes.map((ft) => (
                        <SelectItem key={ft.id} value={ft.id}>{ft.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-blue-600">Rate (Inc. Tax)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={editingRate?.rate_per_hour}
                      onChange={(e) => setEditingRate(prev => prev ? { ...prev, rate_per_hour: e.target.value } : null)}
                      className="pl-7 bg-white border-blue-200"
                      placeholder="0.00"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-blue-600">Effective From</label>
                  <Input
                    type="date"
                    value={editingRate?.effective_from}
                    onChange={(e) => setEditingRate(prev => prev ? { ...prev, effective_from: e.target.value } : null)}
                    className="bg-white border-blue-200"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 bg-blue-600"
                    onClick={handleSaveNewRate}
                    disabled={saving}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 border-blue-200"
                    onClick={handleCancelNewRate}
                    disabled={saving}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-gray-900 py-4 px-6">Flight Type</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-4 px-6">Rate (Inc. Tax)</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-4 px-6">Effective From</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-4 px-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((rate) => (
                  <TableRow
                    key={rate.id}
                    className={`group border-b border-gray-100 transition-colors ${
                      isEditing(rate.id) ? 'bg-indigo-50/50' : 'hover:bg-gray-50/50'
                    }`}
                  >
                    <TableCell className="py-4 px-6">
                      <span className="font-medium text-gray-900">
                        {flightTypes.find(ft => ft.id === rate.flight_type_id)?.name || 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      {isEditing(rate.id) ? (
                        <div className="relative max-w-[140px]">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={editingRate?.rate_per_hour}
                            onChange={(e) => setEditingRate(prev => prev ? { ...prev, rate_per_hour: e.target.value } : null)}
                            className="pl-7 bg-white"
                          />
                        </div>
                      ) : (
                        <span className="font-semibold text-gray-900">
                          ${calculateTaxInclusive(parseFloat(rate.rate_per_hour)).toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      {isEditing(rate.id) ? (
                        <Input
                          type="date"
                          value={editingRate?.effective_from}
                          onChange={(e) => setEditingRate(prev => prev ? { ...prev, effective_from: e.target.value } : null)}
                          className="bg-white max-w-[180px]"
                        />
                      ) : (
                        <span className="text-gray-600">
                          {rate.effective_from ? new Date(rate.effective_from).toLocaleDateString() : 'Immediate'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      {isEditing(rate.id) ? (
                        <div className="flex gap-2 justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleSaveRate}
                            disabled={saving}
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelEdit}
                            disabled={saving}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRate(rate)}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRate(rate.id)}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {isAddingNew() && (
                  <TableRow className="bg-blue-50/30 border-b border-blue-100">
                    <TableCell className="py-4 px-6">
                      <Select
                        value={editingRate?.flight_type_id}
                        onValueChange={(value) => setEditingRate(prev => prev ? { ...prev, flight_type_id: value } : null)}
                      >
                        <SelectTrigger className="w-full bg-white border-blue-200">
                          <SelectValue placeholder="Select flight type" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFlightTypes.map((ft) => (
                            <SelectItem key={ft.id} value={ft.id}>{ft.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <div className="relative max-w-[140px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={editingRate?.rate_per_hour}
                          onChange={(e) => setEditingRate(prev => prev ? { ...prev, rate_per_hour: e.target.value } : null)}
                          className="pl-7 bg-white border-blue-200"
                          placeholder="0.00"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <Input
                        type="date"
                        value={editingRate?.effective_from}
                        onChange={(e) => setEditingRate(prev => prev ? { ...prev, effective_from: e.target.value } : null)}
                        className="bg-white border-blue-200 max-w-[180px]"
                      />
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <div className="flex gap-2 justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleSaveNewRate}
                          disabled={saving}
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelNewRate}
                          disabled={saving}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}

