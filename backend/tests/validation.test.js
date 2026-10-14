const test = require("node:test");
const assert = require("node:assert/strict");

const allowedStatuses = ["On Duty", "Break", "On Mission", "Offline", "Inspecting", "Available"];

test("accepts all supported agent statuses", () => {
  for (const status of allowedStatuses) {
    assert.equal(allowedStatuses.includes(status), true);
  }
});

test("rejects an unsupported agent status", () => {
  assert.equal(allowedStatuses.includes("Flying"), false);
});

test("accepts a positive integer agent ID", () => {
  const id = Number("1");
  assert.equal(Number.isInteger(id) && id >= 1, true);
});

test("rejects invalid agent IDs", () => {
  for (const value of ["abc", "0", "-1", "1.5"]) {
    const id = Number(value);
    assert.equal(Number.isInteger(id) && id >= 1, false);
  }
});
