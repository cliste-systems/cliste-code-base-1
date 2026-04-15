export type CaraChatRole = "cara" | "user";

export type CaraChatMessage = {
  id: string;
  role: CaraChatRole;
  text: string;
};

export const CARA_WELCOME_MESSAGE: CaraChatMessage = {
  id: "welcome",
  role: "cara",
  text: "Hey there 👋 I’m Cara — your salon manager sidekick. What are we sorting first today?",
};
