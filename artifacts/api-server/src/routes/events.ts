import { Router, type IRouter } from "express";
import { CreateEventBody, CreateEventResponse, UpdateEventBody, UpdateEventResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/events", async (req, res) => {
  const supabase = req.supabase!;
  const userId = req.user!.id;
  const courseId = typeof req.query.courseId === "string" ? req.query.courseId : null;

  let query = supabase
    .from("course_events")
    .select("id, course_id, type, title, event_date, description, source, courses(name, status)")
    .eq("user_id", userId)
    .order("event_date", { ascending: true });

  if (courseId) {
    query = query.eq("course_id", courseId);
  } else {
    query = query.gte("event_date", new Date().toISOString().slice(0, 10)).limit(10);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    course_id: string;
    type: string;
    title: string;
    event_date: string;
    description: string | null;
    source: string;
    courses: { name: string; status: string } | null;
  }>;

  const visible = courseId ? rows : rows.filter((row) => row.courses?.status === "active");

  return res.json(
    visible.map((row) => ({
      id: row.id,
      courseId: row.course_id,
      courseName: row.courses?.name ?? "",
      type: row.type,
      title: row.title,
      eventDate: row.event_date,
      description: row.description,
      source: row.source,
    })),
  );
});

router.post("/events", async (req, res) => {
  const supabase = req.supabase!;
  const userId = req.user!.id;
  const input = CreateEventBody.parse(req.body);
  const title = input.title.trim();
  if (!title) return res.status(400).json({ error: "Event title can't be blank." });

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, name")
    .eq("id", input.courseId)
    .maybeSingle();
  if (courseError || !course) return res.status(404).json({ error: "Course not found" });

  const { data, error } = await supabase
    .from("course_events")
    .insert({
      user_id: userId,
      course_id: input.courseId,
      type: input.type,
      title,
      event_date: input.eventDate,
      description: input.description ?? null,
    })
    .select("id, type, title, event_date, description, source")
    .single();
  if (error) return res.status(500).json({ error: error.message });

  return res.status(201).json(
    CreateEventResponse.parse({
      id: data.id,
      courseId: course.id,
      courseName: course.name,
      type: data.type,
      title: data.title,
      eventDate: data.event_date,
      description: data.description,
      source: data.source,
    }),
  );
});

router.patch("/events/:eventId", async (req, res) => {
  const supabase = req.supabase!;
  const input = UpdateEventBody.parse(req.body);
  if (input.title !== undefined && !input.title.trim()) {
    return res.status(400).json({ error: "Event title can't be blank." });
  }

  const { data, error } = await supabase
    .from("course_events")
    .update({
      type: input.type,
      title: input.title?.trim(),
      event_date: input.eventDate,
      description: input.description ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.params.eventId)
    .select("id, course_id, type, title, event_date, description, source, courses(name)")
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Event not found" });

  const course = (data as unknown as { courses: { name: string } | null }).courses;

  return res.json(
    UpdateEventResponse.parse({
      id: data.id,
      courseId: data.course_id,
      courseName: course?.name ?? "",
      type: data.type,
      title: data.title,
      eventDate: data.event_date,
      description: data.description,
      source: data.source,
    }),
  );
});

router.delete("/events/:eventId", async (req, res) => {
  const supabase = req.supabase!;
  const { error } = await supabase.from("course_events").delete().eq("id", req.params.eventId);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).send();
});

export default router;
