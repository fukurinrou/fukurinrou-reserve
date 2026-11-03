import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";
import { courseEvent } from "../src/calendar.js";

const db = { prepare() { return {
  bind() { return this; },
  async run() { return {}; },
  async all() { return { results: [{ name: "date" }] }; },
  async first() { return null; },
}; } };
const futureDate = () => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
function application(time, rtype = "お席のみ") {
  return worker.fetch(new Request("https://example.invalid/api/reservations", {
    method: "POST",
    body: JSON.stringify({ name: "テスト", email: "test@example.invalid", tel: "000", people: 2,
      date: futureDate(), time, rtype }),
  }), { DB: db });
}
test("closed-hours bookings are rejected before a reservation is saved", async () => {
  assert.equal((await application("14:00")).status, 400);
  assert.equal((await application("22:00")).status, 400);
  const lateCourse = await application("21:00", "コース料理");
  assert.equal(lateCourse.status, 400);
  assert.match((await lateCourse.json()).error, /20:00/);
});
test("calendar event ends at closing for a late seat booking", () => {
  const event = courseEvent({ id: 1, public_ref: "C-TEST", reservation_date: "2026-12-01",
    reservation_time: "21:30", reservation_type: "お席のみ", customer_name: "試験", people: 2, status: "new" });
  assert.equal(event.end, new Date("2026-12-01T22:00:00+09:00").toISOString());
});
