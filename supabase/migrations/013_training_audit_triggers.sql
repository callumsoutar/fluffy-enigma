-- Add audit + updated_at triggers for training tables
-- Ensures syllabus enrollment actions and exam result changes are auditable under RLS.

-- Keep updated_at consistent
DROP TRIGGER IF EXISTS set_updated_at_exam_results ON public.exam_results;
CREATE TRIGGER set_updated_at_exam_results
BEFORE UPDATE ON public.exam_results
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_student_syllabus_enrollment ON public.student_syllabus_enrollment;
CREATE TRIGGER set_updated_at_student_syllabus_enrollment
BEFORE UPDATE ON public.student_syllabus_enrollment
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_updated_at();

-- Audit trails (writes into public.audit_logs via SECURITY DEFINER function public.log_table_audit())
DROP TRIGGER IF EXISTS exam_results_audit_trigger ON public.exam_results;
CREATE TRIGGER exam_results_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.exam_results
FOR EACH ROW
EXECUTE FUNCTION public.log_table_audit();

DROP TRIGGER IF EXISTS student_syllabus_enrollment_audit_trigger ON public.student_syllabus_enrollment;
CREATE TRIGGER student_syllabus_enrollment_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.student_syllabus_enrollment
FOR EACH ROW
EXECUTE FUNCTION public.log_table_audit();


