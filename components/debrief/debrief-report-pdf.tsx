import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { BookingWithRelations } from '@/lib/types/bookings';
import type { LessonProgressWithInstructor } from '@/lib/types/lesson_progress';
import type { FlightExperienceEntryWithType } from '@/lib/types/flight-experience';

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 7,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    borderWidth: 1,
    borderStyle: 'solid',
  },
  badgePass: {
    backgroundColor: '#ecfdf5',
    color: '#059669',
    borderColor: '#d1fae5',
  },
  badgeNYC: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    borderColor: '#fee2e2',
  },
  officialLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#2563eb',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#f9fafb',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  infoColumn: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 15,
  },
  content: {
    fontSize: 10,
    lineHeight: 1.6,
    color: '#374151',
  },
  separator: {
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#f3f4f6',
    marginVertical: 30,
  },
  grid: {
    flexDirection: 'row',
    gap: 40,
  },
  gridColumn: {
    flex: 1,
  },
  gridItem: {
    marginBottom: 25,
  },
  focusBox: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#dbeafe',
  },
  focusLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#2563eb',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 50,
    right: 50,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: '#f3f4f6',
    paddingTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  signatureLineContainer: {
    width: 150,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: '#d1d5db',
    paddingTop: 5,
  },
  signatureLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
  },
  footerCenter: {
    textAlign: 'center',
  },
  footerText: {
    fontSize: 7,
    color: '#9ca3af',
    marginBottom: 2,
  },
  footerBrand: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#6b7280',
  }
});

interface DebriefReportPDFProps {
  booking: BookingWithRelations;
  lessonProgress: LessonProgressWithInstructor | null;
  flightExperiences: FlightExperienceEntryWithType[];
}

export default function DebriefReportPDF({
  booking,
  lessonProgress,
  flightExperiences,
}: DebriefReportPDFProps) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-NZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const studentName = booking.student
    ? `${booking.student.first_name || ''} ${booking.student.last_name || ''}`.trim() || booking.student.email
    : 'Unknown Student';

  const instructorName = lessonProgress?.instructor?.user
    ? `${lessonProgress.instructor.user.first_name || ''} ${lessonProgress.instructor.user.last_name || ''}`.trim() || lessonProgress.instructor.user.email
    : booking.instructor?.first_name 
      ? `${booking.instructor.first_name} ${booking.instructor.last_name || ''}`.trim()
      : 'Not assigned';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.officialLabel}>Official Flight Debrief</Text>
              <Text style={styles.title}>{booking.lesson?.name || 'Training Flight'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.date}>{formatDate(booking.start_time)}</Text>
                {booking.lesson?.syllabus?.name && (
                  <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', backgroundColor: '#f3f4f6', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 }}>
                    Syllabus: {booking.lesson.syllabus.name}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.infoBar}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              {lessonProgress?.status && (
                <View style={[
                  styles.badge, 
                  lessonProgress.status === 'pass' ? styles.badgePass : styles.badgeNYC
                ]}>
                  <Text>{lessonProgress.status === 'pass' ? 'Pass' : 'NYC'}</Text>
                </View>
              )}
              {lessonProgress?.attempt != null && (
                <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' }}>
                  Attempt #{lessonProgress.attempt}
                </Text>
              )}
            </View>
            <View style={{ flexDirection: 'row' }}>
              <View style={styles.infoColumn}>
                <Text style={styles.infoLabel}>Student</Text>
                <Text style={styles.infoValue}>{studentName}</Text>
              </View>
              <View style={styles.infoColumn}>
                <Text style={styles.infoLabel}>Instructor</Text>
                <Text style={styles.infoValue}>{instructorName}</Text>
              </View>
              <View style={styles.infoColumn}>
                <Text style={styles.infoLabel}>Aircraft</Text>
                <Text style={styles.infoValue}>{booking.checked_out_aircraft?.registration || booking.aircraft?.registration || 'N/A'}</Text>
              </View>
              <View style={styles.infoColumn}>
                <Text style={styles.infoLabel}>Flight Time</Text>
                <Text style={styles.infoValue}>{booking.flight_time?.toFixed(1) || '0.0'}h</Text>
              </View>
            </View>
          </View>
        </View>

        <View>
          <Text style={styles.sectionTitle}>Instructor Feedback</Text>
          <Text style={styles.content}>
            {lessonProgress?.instructor_comments?.replace(/<[^>]*>/g, '') || 'No comments recorded.'}
          </Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.grid}>
          <View style={styles.gridColumn}>
            <View style={styles.gridItem}>
              <Text style={styles.sectionTitle}>Lesson Highlights</Text>
              <Text style={styles.content}>{lessonProgress?.lesson_highlights || 'No highlights recorded.'}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.sectionTitle}>General Airmanship</Text>
              <Text style={styles.content}>{lessonProgress?.airmanship || 'No airmanship notes recorded.'}</Text>
            </View>
          </View>
          <View style={styles.gridColumn}>
            <View style={styles.gridItem}>
              <Text style={styles.sectionTitle}>Areas for Improvement</Text>
              <Text style={styles.content}>{lessonProgress?.areas_for_improvement || 'No areas for improvement recorded.'}</Text>
            </View>
            <View style={styles.focusBox}>
              <Text style={styles.focusLabel}>Focus for Next Lesson</Text>
              <Text style={[styles.content, { fontWeight: 'bold' }]}>{lessonProgress?.focus_next_lesson || "Standard progress to next lesson."}</Text>
            </View>
          </View>
        </View>

        {flightExperiences.length > 0 && (
          <>
            <View style={styles.separator} />
            <View>
              <Text style={styles.sectionTitle}>Flight Experience Logged</Text>
              <View style={{ marginTop: 5 }}>
                {flightExperiences.map((exp, i) => (
                  <View key={i} style={{ flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: '#f3f4f6' }}>
                    <Text style={{ flex: 1, fontSize: 9 }}>{exp.experience_type?.name || 'Experience'}</Text>
                    <Text style={{ width: 100, textAlign: 'right', fontSize: 9, fontWeight: 'bold' }}>{exp.value} {exp.unit}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        <View style={styles.footer}>
          <View style={styles.signatureLineContainer}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Instructor Signature</Text>
          </View>
          <View style={styles.footerCenter}>
            <Text style={styles.footerText}>Generated on {new Date().toLocaleString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
            <Text style={styles.footerBrand}>Flight Desk Pro</Text>
          </View>
          <View style={styles.signatureLineContainer}>
            <View style={[styles.signatureLine, { alignItems: 'flex-end' }]} />
            <Text style={[styles.signatureLabel, { textAlign: 'right' }]}>Student Signature</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
