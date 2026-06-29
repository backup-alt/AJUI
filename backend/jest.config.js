module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js"],
  testTimeout: 30000,
  setupFilesAfterEach: ["<rootDir>/__tests__/setup.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.test.ts"],
  coveragePathIgnorePatterns: ["/node_modules/", "/dist/", "/__tests__/"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
};
