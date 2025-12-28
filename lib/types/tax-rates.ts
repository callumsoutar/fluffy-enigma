export interface TaxRate {
  id: string;
  country_code: string;
  region_code: string | null;
  rate: number;
  description: string | null;
  is_active: boolean;
  tax_name: string;
  is_default: boolean;
  effective_from: string;
  created_at: string;
  updated_at: string;
}

export interface TaxRatesResponse {
  tax_rates: TaxRate[];
}

