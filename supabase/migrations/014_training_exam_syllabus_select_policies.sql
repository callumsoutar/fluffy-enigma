-- Allow authenticated users to read active, non-voided training reference data.
-- Needed so exam_results and enrollments can safely embed related exam/syllabus rows under RLS.

-- Syllabus: allow SELECT for authenticated users, limited to active + non-voided
DROP POLICY IF EXISTS syllabus_select_active ON public.syllabus;
CREATE POLICY syllabus_select_active
  ON public.syllabus
  FOR SELECT
  TO public
  USING (
    auth.uid() IS NOT NULL
    AND is_active = true
    AND voided_at IS NULL
  );

-- Exam: allow SELECT for authenticated users, limited to active + non-voided
DROP POLICY IF EXISTS exam_select_active ON public.exam;
CREATE POLICY exam_select_active
  ON public.exam
  FOR SELECT
  TO public
  USING (
    auth.uid() IS NOT NULL
    AND is_active = true
    AND voided_at IS NULL
  );


