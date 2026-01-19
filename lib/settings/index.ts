/**
 * Settings Module
 * 
 * FLAT STRUCTURE - Simplified settings management with:
 * - Type-safe defaults defined in code
 * - JSONB overrides stored per tenant (flat, not nested)
 * - Simple spread merge at runtime
 * - Zod validation
 * - UI grouping via constants
 */

export {
  DEFAULT_SETTINGS,
  getDefaultValue,
  getEffectiveSettings,
  extractOverrides,
} from './defaults';

export * from './types';
