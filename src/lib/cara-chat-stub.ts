export type CaraChatRole = "cara" | "user";

export type CaraChatMessage = {
  id: string;
  role: CaraChatRole;
  text: string;
};

export const CARA_WELCOME_MESSAGE: CaraChatMessage = {
  id: "welcome",
  role: "cara",
  text: "Hi! I’m Cara. Ask me about your calls, bookings, open follow-ups, or menu—I’m reading your live Cliste data when you send a message. On native Cliste, you can drop a full booking in one line (name, 08… mobile, service, day & time like 1pm Monday) and I’ll try to save it. I keep the conversation on your salon and the dashboard, not unrelated topics.",
};
