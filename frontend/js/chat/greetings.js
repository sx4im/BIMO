// Bimo time-of-day and personalized greeting generator.
// Generates short, elegant, single-line greetings tailored to the user's local time
// and display first name.

export function getFirstName(fullName) {
  if (!fullName || typeof fullName !== "string") return "";
  const cleaned = fullName.trim();
  if (!cleaned || cleaned.toLowerCase() === "bimo user" || cleaned.toLowerCase() === "user") return "";
  const raw = cleaned.split(/[\s._-]+/)[0];
  if (!raw) return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export const MORNING_GREETINGS = [
  (name) => name ? `Good morning, ${name}` : "Good morning",
  (name) => name ? `Ready to begin, ${name}?` : "Ready to begin?",
  (name) => name ? `Morning, ${name}. Let's dive in` : "Morning. Let's dive in",
  (name) => name ? `What are we starting, ${name}?` : "What are we starting?",
];

export const AFTERNOON_GREETINGS = [
  (name) => name ? `Good afternoon, ${name}` : "Good afternoon",
  (name) => name ? `What's next on your mind, ${name}?` : "What's next on your mind?",
  (name) => name ? `How can I assist, ${name}?` : "How can I assist?",
  (name) => name ? `Ready when you are, ${name}` : "Ready when you are",
];

export const EVENING_GREETINGS = [
  (name) => name ? `Good evening, ${name}` : "Good evening",
  (name) => name ? `What can I do for you, ${name}?` : "What can I do for you?",
  (name) => name ? `Wrapping up your day, ${name}?` : "Wrapping up your day?",
  (name) => name ? `How can I help tonight, ${name}?` : "How can I help tonight?",
];

export const NIGHT_GREETINGS = [
  (name) => name ? `Good night, ${name}` : "Good night",
  (name) => name ? `Still working, ${name}?` : "Still working?",
  (name) => name ? `Quiet night, ${name}` : "Quiet night",
  (name) => name ? `Working late, ${name}?` : "Working late?",
];

export const GENERAL_GREETINGS = [
  (name) => name ? `Hey there, ${name}` : "Hey there",
  (name) => name ? `Welcome back, ${name}` : "Welcome back",
  (name) => name ? `What are we building, ${name}?` : "What are we building?",
  (name) => name ? `How can I help today, ${name}?` : "How can I help today?",
  (name) => name ? `What can I do for you, ${name}?` : "What can I do for you?",
];

export function getGreetingPool(date = new Date()) {
  const hour = date.getHours();
  // Morning: 5am to 10am (5 <= hour < 10)
  if (hour >= 5 && hour < 10) {
    return MORNING_GREETINGS;
  }
  // Afternoon: 1pm to 3pm (13 <= hour < 15)
  if (hour >= 13 && hour < 15) {
    return AFTERNOON_GREETINGS;
  }
  // Evening: 5pm to 7pm (17 <= hour < 19)
  if (hour >= 17 && hour < 19) {
    return EVENING_GREETINGS;
  }
  // Night: 8pm to 1am (hour >= 20 || hour < 1)
  if (hour >= 20 || hour < 1) {
    return NIGHT_GREETINGS;
  }
  // Other hours: General clean classics
  return GENERAL_GREETINGS;
}

export function getRandomGreetingTemplate(date = new Date()) {
  const pool = getGreetingPool(date);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getGreeting(userName, date = new Date(), template = null) {
  const firstName = getFirstName(userName);
  const fn = template || getRandomGreetingTemplate(date);
  return fn(firstName);
}
