import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { BookingWithRelations } from '@/lib/types/bookings';

// Compact design to fit on one page
const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 9,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  
  // Header
  header: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 3,
  },
  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  headerText: {
    fontSize: 8,
    color: '#6b7280',
  },

  // Two column layout
  contentRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 10,
  },
  column: {
    flex: 1,
  },

  // Section
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 5,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    marginBottom: 5,
    alignItems: 'baseline',
  },
  label: {
    fontSize: 7,
    color: '#6b7280',
    width: 90,
  },
  value: {
    fontSize: 9,
    color: '#111827',
    fontWeight: 'bold',
    flex: 1,
  },
  underline: {
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingBottom: 1,
    minHeight: 12,
  },

  // Grid for ATIS and times
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: '30%',
  },
  gridLabel: {
    fontSize: 6,
    color: '#6b7280',
    marginBottom: 2,
  },
  gridValue: {
    fontSize: 8,
    color: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingBottom: 1,
    minHeight: 10,
  },

  // Fuel table
  fuelTable: {
    marginBottom: 8,
  },
  fuelTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#d1d5db',
  },
  tableHeaderText: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#374151',
    flex: 1,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableCell: {
    flex: 1,
    fontSize: 8,
    color: '#6b7280',
    textAlign: 'center',
  },

  // Equipment
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  equipmentItem: {
    width: '31%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkbox: {
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: '#9ca3af',
  },
  equipmentLabel: {
    fontSize: 7,
    color: '#374151',
  },

  // Notes box
  notesBox: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 6,
    minHeight: 40,
    backgroundColor: '#fafafa',
  },
  notesPlaceholder: {
    fontSize: 7,
    color: '#9ca3af',
    fontStyle: 'italic',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 20,
    right: 20,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 6,
    color: '#9ca3af',
  },
});

interface CheckOutSheetProps {
  booking: BookingWithRelations;
}

export default function CheckOutSheet({ booking }: CheckOutSheetProps) {
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('en-NZ', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const formatTime = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleTimeString('en-NZ', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    const date = formatDate(dateString);
    const time = formatTime(dateString);
    return date && time ? `${date} ${time}` : date || time || '';
  };

  const currentDate = new Date().toLocaleDateString('en-NZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Extract booking data
  const aircraftRegistration = booking.checked_out_aircraft?.registration || 
                               booking.aircraft?.registration || 
                               'N/A';
  
  const memberName = booking.student
    ? [booking.student.first_name, booking.student.last_name].filter(Boolean).join(' ') || booking.student.email
    : 'N/A';
  
  const instructorName = booking.checked_out_instructor
    ? (() => {
        // Use user names as the source of truth (fallback to instructor table for backward compatibility)
        const firstName = booking.checked_out_instructor.user?.first_name ?? booking.checked_out_instructor.first_name
        const lastName = booking.checked_out_instructor.user?.last_name ?? booking.checked_out_instructor.last_name
        return [firstName, lastName].filter(Boolean).join(' ') || 
          booking.checked_out_instructor.user?.email || 
          'N/A'
      })()
    : booking.instructor
    ? (() => {
        // Use user names as the source of truth (fallback to instructor table for backward compatibility)
        const firstName = booking.instructor.user?.first_name ?? booking.instructor.first_name
        const lastName = booking.instructor.user?.last_name ?? booking.instructor.last_name
        return [firstName, lastName].filter(Boolean).join(' ') || 
          booking.instructor.user?.email || 
          'N/A'
      })()
    : null;

  const bookingType = booking.booking_type || 'Flight';
  const purpose = booking.purpose || null;

  // Flight log data
  const flightLog = {
    hobbs_start: booking.hobbs_start,
    hobbs_end: booking.hobbs_end,
    tach_start: booking.tach_start,
    tach_end: booking.tach_end,
    flight_time: booking.flight_time,
    circuits: null, // Not in booking schema
    landings: null, // Not in booking schema
    sar_time: null, // Not in booking schema
    ssr_code: null, // Not in booking schema
    eta: booking.eta,
  };

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Flight Check Out Sheet</Text>
          <View style={styles.headerInfo}>
            <Text style={styles.headerText}>Kapiti Aero Club</Text>
            <Text style={styles.headerText}>{currentDate}</Text>
          </View>
        </View>

        {/* Flight Details */}
        <View style={styles.contentRow}>
          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Flight Details</Text>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Aircraft</Text>
                <Text style={styles.value}>{aircraftRegistration}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Member</Text>
                <Text style={styles.value}>{memberName}</Text>
              </View>
              {instructorName && (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Instructor</Text>
                  <Text style={styles.value}>{instructorName}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.label}>Type</Text>
                <Text style={styles.value}>{bookingType}</Text>
              </View>
              {purpose && (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Purpose</Text>
                  <Text style={styles.value}>{purpose}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.label}>Flight Date / Time</Text>
                <View style={[styles.value, styles.underline]}>
                  <Text>{booking.start_time ? formatDateTime(booking.start_time) : ''}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>ETA</Text>
                <View style={[styles.value, styles.underline]}>
                  <Text>{flightLog.eta ? formatDateTime(flightLog.eta) : ''}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Flight Recordings</Text>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Hobbs Start</Text>
                <View style={[styles.value, styles.underline]}>
                  <Text>{flightLog.hobbs_start?.toFixed(1) || ''}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Hobbs End</Text>
                <View style={[styles.value, styles.underline]}>
                  <Text>{flightLog.hobbs_end?.toFixed(1) || ''}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Tacho Start</Text>
                <View style={[styles.value, styles.underline]}>
                  <Text>{flightLog.tach_start?.toFixed(1) || ''}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Tacho End</Text>
                <View style={[styles.value, styles.underline]}>
                  <Text>{flightLog.tach_end?.toFixed(1) || ''}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Flight Time</Text>
                <View style={[styles.value, styles.underline]}>
                  <Text>{flightLog.flight_time ? `${flightLog.flight_time.toFixed(1)} hrs` : ''}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ATIS and Flight Info */}
        <View style={styles.contentRow}>
          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Airport Information (ATIS)</Text>
              <View style={styles.grid}>
                {['Runway', 'Wind', 'Visibility', 'Cloud', 'Temp/DP', 'QNH', '2000FT Wind'].map((item) => (
                  <View key={item} style={styles.gridItem}>
                    <Text style={styles.gridLabel}>{item}</Text>
                    <View style={styles.gridValue}>
                      <Text> </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Additional Information</Text>
              <View style={styles.grid}>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Circuits</Text>
                  <View style={styles.gridValue}>
                    <Text>{flightLog.circuits || ''}</Text>
                  </View>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Landings</Text>
                  <View style={styles.gridValue}>
                    <Text>{flightLog.landings || ''}</Text>
                  </View>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>SAR Time</Text>
                  <View style={styles.gridValue}>
                    <Text>{flightLog.sar_time || ''}</Text>
                  </View>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>SSR Code</Text>
                  <View style={styles.gridValue}>
                    <Text>{flightLog.ssr_code || ''}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Fuel and Equipment */}
        <View style={styles.contentRow}>
          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Fuel Log</Text>
              
              <View style={styles.fuelTable}>
                <Text style={styles.fuelTitle}>Left Tank</Text>
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderText}>Time</Text>
                  <Text style={styles.tableHeaderText}>Fuel (L)</Text>
                </View>
                {[1, 2].map((i) => (
                  <View key={`left-${i}`} style={styles.tableRow}>
                    <Text style={styles.tableCell}> </Text>
                    <Text style={styles.tableCell}> </Text>
                  </View>
                ))}
              </View>

              <View style={styles.fuelTable}>
                <Text style={styles.fuelTitle}>Right Tank</Text>
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderText}>Time</Text>
                  <Text style={styles.tableHeaderText}>Fuel (L)</Text>
                </View>
                {[1, 2].map((i) => (
                  <View key={`right-${i}`} style={styles.tableRow}>
                    <Text style={styles.tableCell}> </Text>
                    <Text style={styles.tableCell}> </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Equipment Check</Text>
              <View style={styles.equipmentGrid}>
                {['Life Jackets', 'Headsets', 'Pickets', 'Maps', 'AIP', 'Cushions'].map((item) => (
                  <View key={item} style={styles.equipmentItem}>
                    <View style={styles.checkbox} />
                    <View style={styles.checkbox} />
                    <Text style={styles.equipmentLabel}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Other Charges</Text>
              <View style={styles.notesBox}>
                <Text style={styles.notesPlaceholder}>Landing fees, parking, etc...</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Kapiti Aero Club</Text>
          <Text style={styles.footerText}>Flight Check Out Sheet</Text>
        </View>
      </Page>
    </Document>
  );
}
