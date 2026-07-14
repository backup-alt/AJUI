process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test_access_secret_minimum_16_chars_long";
process.env.JWT_REFRESH_SECRET = "test_refresh_secret_minimum_16_chars_long";
process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || "mongodb://127.0.0.1:27017/ajui_test";

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js"],
  testTimeout: 30000,
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.test.ts"],
  coveragePathIgnorePatterns: ["/node_modules/", "/dist/", "/__tests__/"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
};