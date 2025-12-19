import { useQuery } from '@tanstack/react-query'

interface TaxRate {
  id: string
  rate: string
  name: string | null
  is_default: boolean
  created_at: string
}

interface TaxRatesResponse {
  tax_rates: TaxRate[]
}

/**
 * Hook to fetch the organization's default tax rate
 * @returns The default tax rate as a number (e.g., 0.15 for 15%)
 */
export function useOrganizationTaxRate() {
  const { data, isLoading, error } = useQuery<TaxRatesResponse>({
    queryKey: ['tax-rate', 'default'],
    queryFn: async () => {
      const response = await fetch('/api/tax-rates?is_default=true')
      if (!response.ok) {
        throw new Error('Failed to fetch tax rate')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  })

  // Extract the rate from the first tax rate (should be the default)
  const taxRate = data?.tax_rates?.[0]?.rate 
    ? parseFloat(data.tax_rates[0].rate) 
    : 0.15 // Default to 15% if not found

  return {
    taxRate,
    isLoading,
    error,
  }
}
