export type CallOutcome = "link_sent" | "message_taken" | "hung_up";

export type MockCallHistoryRow = {
  id: string;
  dateTimeLabel: string;
  callerId: string;
  durationLabel: string;
  outcome: CallOutcome;
  transcript: string;
};

export const MOCK_CALL_HISTORY: MockCallHistoryRow[] = [
  {
    id: "call-1",
    dateTimeLabel: "Mar 28, 10:15 AM",
    callerId: "+353 87 123 4567",
    durationLabel: "2m 14s",
    outcome: "link_sent",
    transcript: `AI: Thanks for calling — how can I help today?

Caller: Hiya, I need to book a cut for next week.

AI: No bother — I can text you our Cliste booking link now so you can pick a time that suits.

Caller: Yeah, perfect, send it.

AI: Grand — I’ve sent the SMS to this number. Anything else I can help with?

Caller: No, that’s grand. Cheers.

AI: Lovely — you’ll have the link in a moment. Slán go fóill.`,
  },
  {
    id: "call-2",
    dateTimeLabel: "Mar 28, 09:30 AM",
    callerId: "+353 85 987 6543",
    durationLabel: "4m 02s",
    outcome: "message_taken",
    transcript: `AI: Good morning — you’ve reached the salon. How can I help?

Caller: I’m looking at going lighter — do I need a patch test before colour?

AI: For colour services we usually need a patch test at least 48 hours beforehand. I can leave a detailed note for the team to call you back and book that in.

Caller: OK — can someone ring me after twelve?

AI: Absolutely. I’ve logged that you need a patch test consult before colour, and a callback after midday. Is this the best number to reach you on?

Caller: Yes, this one’s fine.

AI: Perfect — the team will see it in the Action Inbox. Thanks for calling.`,
  },
  {
    id: "call-3",
    dateTimeLabel: "Mar 27, 4:50 PM",
    callerId: "+353 86 444 2211",
    durationLabel: "0m 42s",
    outcome: "hung_up",
    transcript: `AI: Hi there — you’ve reached us outside business hours. I can still help with quick questions or take a message.

Caller: …

AI: If you’d like to book, I can text our link when we’re—

[Caller disconnected]`,
  },
  {
    id: "call-4",
    dateTimeLabel: "Mar 27, 2:05 PM",
    callerId: "+353 83 222 8899",
    durationLabel: "3m 18s",
    outcome: "link_sent",
    transcript: `AI: Hello — what can I do for you today?

Caller: Do ye do beard trims only, no haircut?

AI: We do — barbering includes beard tidy-ups. The fastest way to grab a slot is through our booking link.

Caller: Send it over so.

AI: Done — SMS away. Let me know if you need directions.

Caller: Sound, thanks.`,
  },
  {
    id: "call-5",
    dateTimeLabel: "Mar 27, 11:20 AM",
    callerId: "+353 89 600 3344",
    durationLabel: "5m 01s",
    outcome: "message_taken",
    transcript: `AI: You’re through to the salon — how can I help?

Caller: I had a reaction to a product last time — I want to speak to a stylist before I rebook.

AI: Sorry to hear that — I’ll make sure this is flagged for a senior stylist. They’ll review your file and call you back with safe options.

Caller: Can you say it’s about the toner from last visit?

AI: I’ve noted “previous reaction — toner” and that you want a stylist callback before rebooking. Anything else?

Caller: No, that’s everything.

AI: Thanks — the team will pick it up from the Action Inbox.`,
  },
];

export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  link_sent: "Link Sent",
  message_taken: "Message Taken",
  hung_up: "Hung Up",
};
