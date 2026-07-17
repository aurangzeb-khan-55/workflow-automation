import { validateEnv } from "./env.validation";

const validConfig = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  REDIS_HOST: "localhost",
  REDIS_PORT: "6379",
  AUTH_PROVIDER: "stub",
  EMAIL_PROVIDER: "stub",
  STORAGE_PROVIDER: "s3",
  STORAGE_BUCKET: "test-bucket",
  AI_PROVIDER: "db_generated",
  API_PORT: "4000",
};

describe("validateEnv", () => {
  it("passes with a fully valid config", () => {
    expect(() => validateEnv(validConfig)).not.toThrow();
  });

  it("throws when a required var is missing", () => {
    const { DATABASE_URL, ...rest } = validConfig;
    expect(() => validateEnv(rest)).toThrow(/Invalid environment configuration/);
  });

  it("throws when AUTH_PROVIDER is not a recognized value", () => {
    expect(() => validateEnv({ ...validConfig, AUTH_PROVIDER: "okta" })).toThrow();
  });

  it("throws when REDIS_PORT is out of range", () => {
    expect(() => validateEnv({ ...validConfig, REDIS_PORT: "99999" })).toThrow();
  });
});
