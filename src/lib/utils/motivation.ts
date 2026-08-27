export function getMotivationMessage(percent: number): string {
  if (percent >= 100) return "Profile complete — you're all set!";
  if (percent >= 50) return "You're halfway there!";
  if (percent >= 20) return "Great start! Keep going.";
  return "Let's get your profile started.";
}