// Unit tests for greetings.js
import {
  getFirstName,
  getGreetingPool,
  getGreeting,
  MORNING_GREETINGS,
  AFTERNOON_GREETINGS,
  EVENING_GREETINGS,
  NIGHT_GREETINGS,
  GENERAL_GREETINGS,
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

// 1. First name extraction
check("First name from 'Saim Khan'", getFirstName("Saim Khan") === "Saim");
check("First name from 'saim'", getFirstName("saim") === "Saim");
check("First name from 'Alice Bob Charlie'", getFirstName("Alice Bob Charlie") === "Alice");
check("First name from null", getFirstName(null) === "");
check("First name from undefined", getFirstName(undefined) === "");
check("First name from empty string", getFirstName("   ") === "");

// Helper to create date with specific hour
function makeDate(hour) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

// 2. Time-of-day pools
// Morning: 5am to 10am (5, 6, 7, 8, 9)
for (let h of [5, 6, 7, 8, 9]) {
  check(`Hour ${h} is MORNING_GREETINGS`, getGreetingPool(makeDate(h)) === MORNING_GREETINGS);
}

// Afternoon: 1pm to 3pm (13, 14)
for (let h of [13, 14]) {
  check(`Hour ${h} is AFTERNOON_GREETINGS`, getGreetingPool(makeDate(h)) === AFTERNOON_GREETINGS);
}

// Evening: 5pm to 7pm (17, 18)
for (let h of [17, 18]) {
  check(`Hour ${h} is EVENING_GREETINGS`, getGreetingPool(makeDate(h)) === EVENING_GREETINGS);
}

// Night: 8pm to 1am (20, 21, 22, 23, 0)
for (let h of [20, 21, 22, 23, 0]) {
  check(`Hour ${h} is NIGHT_GREETINGS`, getGreetingPool(makeDate(h)) === NIGHT_GREETINGS);
}

// General / other hours: 1, 2, 3, 4, 10, 11, 12, 15, 16, 19
for (let h of [1, 2, 3, 4, 10, 11, 12, 15, 16, 19]) {
  check(`Hour ${h} is GENERAL_GREETINGS`, getGreetingPool(makeDate(h)) === GENERAL_GREETINGS);
}

// 3. Output formats
const morningMsg = getGreeting("Saim Khan", makeDate(8));
check("Morning greeting contains Saim", morningMsg.includes("Saim"));

const guestMorning = getGreeting("", makeDate(8));
check("Guest morning greeting does not have trailing comma", !guestMorning.includes(","));

const nightMsg = getGreeting("Saim", makeDate(22));
check("Night greeting contains Saim", nightMsg.includes("Saim"));

const afternoonMsg = getGreeting("Saim", makeDate(14));
check("Afternoon greeting contains Saim", afternoonMsg.includes("Saim"));

const eveningMsg = getGreeting("Saim", makeDate(17));
check("Evening greeting contains Saim", eveningMsg.includes("Saim"));

console.log(`\nGreetings tests completed: ${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`);
if (failures > 0) process.exit(1);
