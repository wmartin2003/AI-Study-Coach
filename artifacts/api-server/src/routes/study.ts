import { Router, type IRouter } from "express";
import {
  CreateCourseBody,
  GetDashboardResponse,
  GetQuizResponse,
  ListCoursesResponse,
  SendTutorMessageBody,
  SendTutorMessageResponse,
  SubmitQuizAnswerBody,
  SubmitQuizAnswerResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const courses = [
  {
    id: 1,
    name: "Computer Networks",
    examDate: "October 12",
    level: "Intermediate",
    progress: 72,
    topics: ["TCP vs UDP", "Congestion control", "Routing", "Transport layer"],
  },
];

const dashboard = {
  greeting: "Good evening, Wilhelm",
  courseName: "Computer Networks",
  courseProgress: 72,
  strongestTopic: "Routing",
  focusTopic: "Congestion control",
  tasks: [
    { label: "Review: TCP vs UDP", duration: "10 min", kind: "review", completed: true },
    { label: "Learn: Congestion control", duration: "15 min", kind: "learn", completed: false },
    { label: "Practice: 10 questions", duration: "15 min", kind: "practice", completed: false },
    { label: "Review mistakes", duration: "5 min", kind: "mistakes", completed: false },
  ],
  xp: 1240,
  streak: 6,
};

const question = {
  id: 1,
  number: 1,
  total: 10,
  topic: "Transport layer",
  question: "Which protocol provides reliable, ordered delivery of data between applications?",
  options: ["UDP", "IP", "TCP", "ICMP"],
  difficulty: "Adaptive · Warm-up",
};

router.get("/dashboard", (_req, res) => {
  res.json(GetDashboardResponse.parse(dashboard));
});

router.get("/courses", (_req, res) => {
  res.json(ListCoursesResponse.parse(courses));
});

router.post("/courses", (req, res) => {
  const input = CreateCourseBody.parse(req.body);
  const created = {
    id: courses.length + 1,
    ...input,
    progress: 0,
    topics: [],
  };
  courses.push(created);
  res.status(201).json(created);
});

router.post("/tutor/messages", (req, res) => {
  const input = SendTutorMessageBody.parse(req.body);
  const response = {
    role: "assistant",
    message:
      "Let's break it down. Think of a network where several senders share one road. What might happen if everyone sends at full speed at the same time?",
    prompt: "What signal would tell the senders to slow down?",
  };
  void input;
  res.json(SendTutorMessageResponse.parse(response));
});

router.get("/quiz", (_req, res) => {
  res.json(GetQuizResponse.parse(question));
});

router.post("/quiz/answers", (req, res) => {
  const input = SubmitQuizAnswerBody.parse(req.body);
  const correct = input.answer === "TCP";
  const response = {
    correct,
    explanation: correct
      ? "TCP establishes a connection and acknowledges data so delivery is reliable and ordered."
      : "TCP is the protocol that establishes a connection and acknowledges data for reliable, ordered delivery.",
    xp: correct ? 10 : 4,
    nextTopic: correct ? "Congestion control" : "Transport layer foundations",
  };
  res.json(SubmitQuizAnswerResponse.parse(response));
});

export default router;