// Unit tests for greetings.js
import {
  getFirstName,
  getGreetingPool,
  getGreeting,
  getRandomGreetingTemplate,
  getPageGreetingTemplate,
  resetPageGreetingTemplate,
  MORNING_GREETINGS,
  AFTERNOON_GREETINGS,
  EVENING_GREETINGS,
  NIGHT_GREETINGS,
} from "./js/chat/greetings.js";

let failures = 0;
function check(name, cond, extra = "") {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${name} ${extra}`);
  } else {
    console.log(`ok: ${name}`);
  }
}

// 1. First name extraction (Google, GitHub, and email usernames)
check("First name from 'Saim Khan'", getFirstName("Saim Khan") === "Saim");
check("First name from 'Saim Shafique'", getFirstName("Saim Shafique") === "Saim");
check("First name from 'saim'", getFirstName("saim") === "Saim");
check("First name from 'Alice Bob Charlie'", getFirstName("Alice Bob Charlie") === "Alice");
check("First name from GitHub username 'sx4im'", getFirstName("sx4im") === "Sx4im");
check("First name from GitHub noreply email '123456+sx4im@users.noreply.github.com'", getFirstName("123456+sx4im@users.noreply.github.com") === "Sx4im");
check("First name from email prefix 'john.doe'", getFirstName("john.doe") === "John");
check("First name from username 'jane_smith'", getFirstName("jane_smith") === "Jane");
check("First name from username 'saim-dev'", getFirstName("saim-dev") === "Saim");
check("First name from 'Bimo user' returns empty fallback", getFirstName("Bimo user") === "");
check("First name from 'user' returns empty fallback", getFirstName("user") === "");
check("First name from null", getFirstName(null) === "");
check("First name from undefined", getFirstName(undefined) === "");
check("First name from empty string", getFirstName("   ") === "");

// Helper to create date with specific hour
function makeDate(hour) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

// 2. Time-of-day pools across all 24 hours (0..23)
// Morning: 5am to 12pm (5, 6, 7, 8, 9, 10, 11)
for (let h of [5, 6, 7, 8, 9, 10, 11]) {
  check(`Hour ${h} is MORNING_GREETINGS`, getGreetingPool(makeDate(h)) === MORNING_GREETINGS);
}

// Afternoon: 12pm to 5pm (12, 13, 14, 15, 16)
for (let h of [12, 13, 14, 15, 16]) {
  check(`Hour ${h} is AFTERNOON_GREETINGS`, getGreetingPool(makeDate(h)) === AFTERNOON_GREETINGS);
}

// Evening: 5pm to 10pm (17, 18, 19, 20, 21)
for (let h of [17, 18, 19, 20, 21]) {
  check(`Hour ${h} is EVENING_GREETINGS`, getGreetingPool(makeDate(h)) === EVENING_GREETINGS);
}

// Night: 10pm to 5am (22, 23, 0, 1, 2, 3, 4)
for (let h of [22, 23, 0, 1, 2, 3, 4]) {
  check(`Hour ${h} is NIGHT_GREETINGS`, getGreetingPool(makeDate(h)) === NIGHT_GREETINGS);
}

// 3. Output formats
const morningMsg = getGreeting("Saim Khan", makeDate(8));
check("Morning greeting contains Saim", morningMsg.includes("Saim"));

const guestMorning = getGreeting("", makeDate(8));
check("Guest morning greeting does not have trailing comma", !guestMorning.includes(","));

const afternoonMsg = getGreeting("Saim", makeDate(14));
check("Afternoon greeting contains Saim", afternoonMsg.includes("Saim"));

const eveningMsg = getGreeting("Saim", makeDate(19));
check("Evening greeting at 7pm contains Saim", eveningMsg.includes("Saim"));

const nightMsg = getGreeting("Saim", makeDate(23));
check("Night greeting contains Saim", nightMsg.includes("Saim"));

// 4. Stable template verification (no random reroll / blinking across multiple renders)
resetPageGreetingTemplate();
const pageTpl1 = getPageGreetingTemplate(makeDate(14));
const pageTpl2 = getPageGreetingTemplate(makeDate(14));
check("Page greeting template is stable across repeated calls", pageTpl1 === pageTpl2);

const render1 = getGreeting("", makeDate(14));
const render2 = getGreeting("Saim", makeDate(14));
check("Page greeting template stays identical when user name settles", pageTpl1("") === render1 && pageTpl1("Saim") === render2);

console.log(`\nGreetings tests completed: ${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`);
if (failures > 0) process.exit(1);
