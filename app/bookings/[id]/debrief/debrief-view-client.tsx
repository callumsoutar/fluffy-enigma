'use client';

import { Button } from "@/components/ui/button";
import { 
  Printer, 
  ChevronLeft, 
  Download, 
  Loader2,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { BookingWithRelations } from "@/lib/types/bookings";
import type { LessonProgressWithInstructor } from "@/lib/types/lesson_progress";
import type { FlightExperienceEntryWithType } from "@/lib/types/flight-experience";
import type { ExperienceType } from "@/lib/types/experience-types";
import DebriefReportContent from "@/components/debrief/debrief-report-content";
import { format, parseISO } from "date-fns";
import { pdf } from "@react-pdf/renderer";
import DebriefReportPDF from "@/components/debrief/debrief-report-pdf";
import { Card } from "@/components/ui/card";

interface DebriefViewClientProps {
  booking: BookingWithRelations;
  lessonProgress: LessonProgressWithInstructor | null;
  flightExperiences: FlightExperienceEntryWithType[];
  experienceTypes: ExperienceType[];
}

export default function DebriefViewClient({
  booking,
  lessonProgress,
  flightExperiences,
  experienceTypes,
}: DebriefViewClientProps) {
  const router = useRouter();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const doc = (
        <DebriefReportPDF 
          booking={booking} 
          lessonProgress={lessonProgress} 
          flightExperiences={flightExperiences} 
        />
      );
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
      } else {
        window.print();
      }
    } catch (error) {
      console.error('Error printing:', error);
      toast.error('Failed to generate print report');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const doc = (
        <DebriefReportPDF 
          booking={booking} 
          lessonProgress={lessonProgress} 
          flightExperiences={flightExperiences} 
        />
      );
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const date = booking.start_time ? format(parseISO(booking.start_time), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
      const studentName = booking.student 
        ? `${booking.student.first_name || ''} ${booking.student.last_name || ''}`.trim() || booking.student.email
        : 'Student';
      const name = studentName.replace(/\s+/g, '-').toLowerCase();
      link.download = `Debrief-${name}-${date}.pdf`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Debrief report downloaded');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-muted/10 pb-20">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Navigation & Actions */}
        <div className="flex items-center justify-between mb-8 print:hidden">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm"
              className="gap-2 shadow-sm h-9"
              onClick={handleDownloadPDF} 
              disabled={isDownloading}
            >
              {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              PDF
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="gap-2 shadow-sm h-9"
              onClick={handlePrint} 
              disabled={isPrinting}
            >
              {isPrinting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              Print
            </Button>
          </div>
        </div>

        {/* Main Report Card */}
        <Card className="shadow-xl shadow-slate-200/50 dark:shadow-none border-border/40 overflow-hidden min-h-[800px] flex flex-col bg-white dark:bg-card">
          <DebriefReportContent
            booking={booking}
            lessonProgress={lessonProgress}
            flightExperiences={flightExperiences}
            experienceTypes={experienceTypes}
          />
        </Card>

        {/* Print Only Footer */}
        <div className="hidden print:flex mt-12 justify-between items-end border-t border-border/40 pt-8">
          <div className="space-y-4">
            <div className="h-px w-48 bg-border" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Instructor Signature</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Generated By</p>
            <p className="text-xs font-bold text-foreground">Flight Desk Pro</p>
            <p className="text-[10px] text-muted-foreground">{format(new Date(), "d MMM yyyy HH:mm")}</p>
          </div>
          <div className="space-y-4">
            <div className="h-px w-48 bg-border" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Student Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
}
