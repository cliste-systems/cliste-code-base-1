/** Universal retail FAQ starters — staff must review before save counts as complete. */
export const RETAIL_FAQ_STARTER_PACK = [
  {
    question: "What are your opening hours today?",
    answer:
      "Use the store opening hours configured in Cara training. Mention bank holiday hours when relevant.",
  },
  {
    question: "Is there parking?",
    answer:
      "Describe parking availability for this store location in the knowledge summary or an FAQ answer.",
  },
  {
    question: "Do you have wheelchair access?",
    answer:
      "Confirm accessibility from store facts — do not guess if not configured.",
  },
  {
    question: "Are there customer toilets?",
    answer:
      "Answer from store facilities if configured; otherwise offer to check with the team.",
  },
  {
    question: "Do you take card and cash?",
    answer: "State accepted payment methods from store facts when known.",
  },
  {
    question: "How does click and collect work?",
    answer:
      "Explain click & collect using the store URL or process from store facts.",
  },
  {
    question: "What is your returns policy?",
    answer:
      "Give the store returns policy from approved FAQ text only — do not invent terms.",
  },
  {
    question: "Do you deliver?",
    answer: "Answer from delivery settings in store facts when configured.",
  },
  {
    question: "Do you have a loyalty card?",
    answer:
      "Describe the loyalty programme from store facts when configured.",
  },
  {
    question: "Do you sell gift vouchers?",
    answer:
      "Confirm voucher availability from store facts; do not promise stock.",
  },
  {
    question: "When is hot food available?",
    answer: "Use deli/hot food department hours when configured.",
  },
  {
    question: "Are you open on Sundays and bank holidays?",
    answer: "Use opening hours and bank holiday rules from Cara training.",
  },
  {
    question: "I lost something in the store — lost property?",
    answer:
      "Direct callers to customer service to log lost property — take name and number.",
  },
  {
    question: "How do I apply for a job?",
    answer:
      "Direct to the store manager or official careers channel — do not promise vacancies.",
  },
] as const;
