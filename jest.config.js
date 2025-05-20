const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  reporters: [
    "default", // Default reporter for standard output
    ["summary", { summaryThreshold: 1 }], // Always show a failure summary, even for a single failed test
  ],
};