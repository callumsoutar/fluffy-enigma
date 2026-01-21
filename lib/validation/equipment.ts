import { z } from 'zod';

/**
 * Validation schema for creating equipment
 */
export const equipmentCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  label: z.string().max(255).optional().nullable(),
  type: z.enum([
    'AIP',
    'Stationery',
    'Headset',
    'Technology',
    'Maps',
    'Radio',
    'Transponder',
    'ELT',
    'Lifejacket',
    'FirstAidKit',
    'FireExtinguisher',
    'Other',
  ] as const),
  status: z.enum(['active', 'lost', 'maintenance', 'retired'] as const).optional(),
  serial_number: z.string().max(255).optional().nullable(),
  purchase_date: z.string().datetime().optional().nullable(),
  warranty_expiry: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  year_purchased: z.number().int().min(1900).max(2100).optional().nullable(),
})

/**
 * Validation schema for updating equipment
 */
export const equipmentUpdateSchema = equipmentCreateSchema.partial();

/**
 * Validation schema for issuing equipment
 */
export const equipmentIssuanceSchema = z.object({
  equipment_id: z.string().uuid(),
  user_id: z.string().uuid(),
  expected_return: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * Validation schema for returning equipment
 */
export const equipmentReturnSchema = z.object({
  issuance_id: z.string().uuid(),
  notes: z.string().optional().nullable(),
});

/**
 * Validation schema for logging equipment update
 */
export const equipmentUpdateLogSchema = z.object({
  equipment_id: z.string().uuid(),
  next_due_at: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type EquipmentCreateInput = z.infer<typeof equipmentCreateSchema>;
export type EquipmentUpdateInput = z.infer<typeof equipmentUpdateSchema>;
export type EquipmentIssuanceInput = z.infer<typeof equipmentIssuanceSchema>;
export type EquipmentReturnInput = z.infer<typeof equipmentReturnSchema>;
export type EquipmentUpdateLogInput = z.infer<typeof equipmentUpdateLogSchema>;

