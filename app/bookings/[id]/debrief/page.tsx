import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import DebriefViewClient from "./debrief-view-client";
import type { BookingWithRelations } from "@/lib/types/bookings";
import type { LessonProgressWithInstructor } from "@/lib/types/lesson_progress";
import type { FlightExperienceEntryWithType } from "@/lib/types/flight-experience";

interface DebriefPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function DebriefPage({ params }: DebriefPageProps) {
  const { id: bookingId } = await params;
  const supabase = await createClient();

  // 1. Fetch booking with all necessary relations
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      *,
      aircraft:aircraft_id (*),
      student:user_id (id, first_name, last_name, email),
      instructor:instructor_id (id, first_name, last_name, user:user_id (id, email)),
      flight_type:flight_type_id (*),
      lesson:lesson_id (
        *,
        syllabus:syllabus_id (*)
      ),
      checked_out_aircraft:checked_out_aircraft_id (*),
      checked_out_instructor:checked_out_instructor_id (
        id, 
        first_name, 
        last_name, 
        user_id, 
        user:user_id (id, first_name, last_name, email)
      )
    `)
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    console.error('Error fetching booking:', bookingError);
    return notFound();
  }

  // 2. Fetch lesson progress for this booking
  // We order by created_at desc and take the latest one in case multiple records exist
  const { data: lessonProgress, error: lpError } = await supabase
    .from('lesson_progress')
    .select(`
      *,
      instructor:instructor_id (
        id,
        user:user_id (id, first_name, last_name, email)
      )
    `)
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lpError) {
    console.error('Error fetching lesson progress:', lpError);
  }

  // 3. Fetch flight experiences associated with this lesson progress
  let flightExperiences: FlightExperienceEntryWithType[] = [];
  if (lessonProgress) {
    const { data: feData, error: feError } = await supabase
      .from('flight_experience')
      .select(`
        *,
        experience_type:experience_type_id (id, name)
      `)
      .eq('lesson_progress_id', lessonProgress.id);

    if (feError) {
      console.error('Error fetching flight experiences:', feError);
    } else {
      flightExperiences = feData || [];
    }
  }

  // 4. Fetch all experience types for context (if needed)
  const { data: experienceTypes, error: etError } = await supabase
    .from('experience_types')
    .select('*')
    .eq('is_active', true);

  if (etError) {
    console.error('Error fetching experience types:', etError);
  }

  return (
    <DebriefViewClient 
      booking={booking as unknown as BookingWithRelations}
      lessonProgress={lessonProgress as unknown as LessonProgressWithInstructor}
      flightExperiences={flightExperiences}
      experienceTypes={experienceTypes || []}
    />
  );
}
