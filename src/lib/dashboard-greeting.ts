export function dashboardTimeGreeting(firstName: string): string {
  const hour = new Date().getHours();
  const period =
    hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  return firstName ? `${period}, ${firstName}` : period;
}
