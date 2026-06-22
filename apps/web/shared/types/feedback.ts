export type FeedbackState =
  | { tone: "idle" }
  | { tone: "error" | "success"; message: string };
