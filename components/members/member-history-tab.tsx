"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconClock, IconRotateClockwise, IconChevronDown } from "@tabler/icons-react";

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  user_id?: string | null;
  created_at: string;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  column_changes?: Record<string, { old: unknown; new: unknown }> | null;
  user?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

interface MemberHistoryTabProps {
  memberId: string;
}

// Field labels for user fields
const FIELD_LABELS: Record<string, string> = {
  first_name: 'First Name',
  last_name: 'Last Name',
  email: 'Email',
  phone: 'Phone',
  date_of_birth: 'Date of Birth',
  gender: 'Gender',
  street_address: 'Street Address',
  city: 'City',
  state: 'State',
  postal_code: 'Postal Code',
  country: 'Country',
  next_of_kin_name: 'Next of Kin',
  next_of_kin_phone: 'Next of Kin Phone',
  emergency_contact_relationship: 'Emergency Contact Relationship',
  medical_certificate_expiry: 'Medical Certificate Expiry',
  pilot_license_number: 'License Number',
  pilot_license_type: 'License Type',
  pilot_license_expiry: 'License Expiry',
  is_active: 'Account Status',
  company_name: 'Company Name',
  occupation: 'Occupation',
  employer: 'Employer',
  notes: 'Notes',
  public_directory_opt_in: 'Public Directory',
  class_1_medical_due: 'Class 1 Medical Due',
  class_2_medical_due: 'Class 2 Medical Due',
  DL9_due: 'DL9 Due',
  BFR_due: 'BFR Due',
};

// Fields to ignore in audit display
const IGNORED_FIELDS = [
  'updated_at', 
  'created_at', 
  'id', 
  'password', 
  'avatar_url', 
  'profile_image_url', 
  'date_of_last_flight',
  'account_balance' // Explicitly removed as per requirement
];

// Priority order for displaying changes
const FIELD_PRIORITY = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'is_active',
  'medical_certificate_expiry',
  'pilot_license_number',
  'pilot_license_expiry',
  'date_of_birth',
];

export function MemberHistoryTab({ memberId }: MemberHistoryTabProps) {
  const [showAll, setShowAll] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // Collapsed by default

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["member-audit-logs", memberId],
    queryFn: async () => {
      const res = await fetch(`/api/members/${memberId}/audit`);
      if (!res.ok) {
        throw new Error('Failed to fetch audit logs');
      }
      return res.json() as Promise<{ auditLogs: AuditLog[] }>;
    },
    enabled: isOpen, // Only fetch when uncollapsed
  });

  const logs = data?.auditLogs || [];
  const logsToShow = showAll ? logs : logs.slice(0, 10);

  function formatValue(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'string' && value === '') return '—';
    return String(value);
  }

  function formatDateValue(value: unknown): string {
    if (!value || typeof value !== 'string') return '—';
    try {
      return new Date(value).toLocaleDateString("en-US", { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return String(value);
    }
  }

  function renderDescription(log: AuditLog): string {
    if (log.action === "INSERT") return "Member Account Created";
    if (log.action === "DELETE") return "Member Account Deleted";
    
    if (log.action === "UPDATE" && log.column_changes) {
      const changes: string[] = [];
      
      // Process changes in priority order
      for (const field of FIELD_PRIORITY) {
        if (log.column_changes[field] && !IGNORED_FIELDS.includes(field)) {
          const label = FIELD_LABELS[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          const value = log.column_changes[field];
          
          if (value && typeof value === 'object' && 'old' in value && 'new' in value) {
            let oldDisplay: string;
            let newDisplay: string;
            
            // Special formatting for different field types
            if (field === 'is_active') {
              oldDisplay = value.old ? 'Active' : 'Inactive';
              newDisplay = value.new ? 'Active' : 'Inactive';
            } else if (field === 'public_directory_opt_in') {
              oldDisplay = value.old ? 'Visible' : 'Hidden';
              newDisplay = value.new ? 'Visible' : 'Hidden';
            } else if (field.includes('_date') || field.includes('_expiry') || field.includes('_due') || field === 'date_of_birth') {
              oldDisplay = formatDateValue(value.old);
              newDisplay = formatDateValue(value.new);
            } else {
              oldDisplay = formatValue(value.old);
              newDisplay = formatValue(value.new);
            }
            
            // Skip if no meaningful change
            if (oldDisplay === newDisplay || (oldDisplay === '—' && newDisplay === '—')) {
              continue;
            }
            
            changes.push(`${label}: ${oldDisplay} → ${newDisplay}`);
          }
        }
      }
      
      // If no priority fields changed, check other fields
      if (changes.length === 0) {
        const changedFields = Object.keys(log.column_changes).filter(
          (field) => !IGNORED_FIELDS.includes(field)
        );
        for (const field of changedFields) {
          const label = FIELD_LABELS[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          const value = log.column_changes[field];
          
          if (value && typeof value === 'object' && 'old' in value && 'new' in value) {
            let oldDisplay: string;
            let newDisplay: string;
            
            if (field.includes('_date') || field.includes('_expiry') || field.includes('_due')) {
              oldDisplay = formatDateValue(value.old);
              newDisplay = formatDateValue(value.new);
            } else {
              oldDisplay = formatValue(value.old);
              newDisplay = formatValue(value.new);
            }
            
            if (oldDisplay !== newDisplay && !(oldDisplay === '—' && newDisplay === '—')) {
              changes.push(`${label}: ${oldDisplay} → ${newDisplay}`);
            }
          }
        }
      }
      
      if (changes.length > 0) {
        return changes.join('; ');
      }
      
      return "Member Profile Updated";
    }
    
    return log.action === "UPDATE" ? "Member Profile Updated" : log.action;
  }

  return (
    <Card className="shadow-md border border-border/50 bg-card rounded-xl mt-8">
      <CardHeader className="pb-2 sm:pb-3 border-b border-border/20">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 w-full text-left"
        >
          <IconChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-foreground transition-transform ${isOpen ? '' : '-rotate-90'}`} />
          <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
            Member History
          </CardTitle>
        </button>
      </CardHeader>
      {isOpen && (
        <CardContent className="pt-3 sm:pt-4 px-0 sm:px-6">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading history...</div>
          ) : isError ? (
            <div className="py-8 text-center text-destructive">
              Error loading history: {error instanceof Error ? error.message : "Unknown error"}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-6 sm:py-8 px-4">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">No history available</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Changes to this member will appear here</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Date</th>
                      <th className="text-left py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">User</th>
                      <th className="text-left py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsToShow.map((log, i) => {
                      const userName = log.user
                        ? [log.user.first_name, log.user.last_name].filter(Boolean).join(" ") || log.user.email
                        : "System";
                      const logDate = new Date(log.created_at);
                      const formattedDate = logDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });
                      const formattedTime = logDate.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      });
                      
                      return (
                        <tr key={log.id} className={`border-b border-border/20 last:border-0 hover:bg-slate-100/50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                          <td className="py-2 sm:py-2.5 px-3 sm:px-4 text-xs sm:text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap align-top">
                            <span className="hidden sm:inline">{formattedDate}, {formattedTime}</span>
                            <span className="sm:hidden">{formattedDate}<br />{formattedTime}</span>
                          </td>
                          <td className="py-2 sm:py-2.5 px-3 sm:px-4 text-xs sm:text-sm text-gray-900 dark:text-gray-100 align-top">
                            {userName}
                          </td>
                          <td className="py-2 sm:py-2.5 px-3 sm:px-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 align-top">
                            {renderDescription(log)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {logs.length > 10 && (
                <div className="mt-4 px-4 pb-4 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAll(!showAll)}
                    className="h-8 text-xs font-medium border-gray-300 hover:bg-gray-50 text-gray-700 px-4"
                  >
                    {showAll ? "Show Less" : `View All (${logs.length} total)`}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
