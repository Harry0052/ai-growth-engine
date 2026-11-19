const RULES = [
  { category: "billing", priority: "high", words: ["refund", "charged", "billing", "payment", "invoice"] },
  { category: "bug", priority: "high", words: ["crash", "bug", "error", "broken", "won't", "cannot", "can't"] },
  { category: "how-to", priority: "normal", words: ["how do", "help me", "where do", "what is"] },
  { category: "praise", priority: "low", words: ["love", "great", "thank", "awesome"] },
];

export function triageMessage(text: string) {
  const hay = text.toLowerCase();
  for (const rule of RULES) {
    if (rule.words.some((word) => hay.includes(word))) {
      return { category: rule.category, priority: rule.priority, triage: "rules" as const };
    }
  }
  return { category: "general", priority: "normal", triage: "rules" as const };
}
