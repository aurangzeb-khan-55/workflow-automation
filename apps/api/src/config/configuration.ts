export default () => ({
  nodeEnv: process.env.NODE_ENV,
  port: parseInt(process.env.API_PORT ?? "4000", 10),
  webUrl: process.env.WEB_URL ?? "http://localhost:3000",
  intakeLinkBaseUrl: process.env.INTAKE_LINK_BASE_URL ?? "http://localhost:3000/intake",

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST ?? "localhost",
    port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
  },

  auth: {
    provider: process.env.AUTH_PROVIDER ?? "stub",
    clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    clerkSecretKey: process.env.CLERK_SECRET_KEY,
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER ?? "s3",
    endpoint: process.env.STORAGE_ENDPOINT,
    region: process.env.STORAGE_REGION ?? "us-east-1",
    bucket: process.env.STORAGE_BUCKET,
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
    signedUrlTtlSeconds: parseInt(process.env.STORAGE_SIGNED_URL_TTL_SECONDS ?? "900", 10),
  },

  email: {
    provider: process.env.EMAIL_PROVIDER ?? "stub",
    mailhippoApiKey: process.env.MAILHIPPO_API_KEY,
    fromAddress: process.env.EMAIL_FROM_ADDRESS ?? "intake@atriawellness.com",
    // For EMAIL_PROVIDER=smtp only — see smtp-email.provider.ts. Generic:
    // works against any standard mail server, not tied to one host.
    smtpHost: process.env.SMTP_HOST,
    smtpPort: parseInt(process.env.SMTP_PORT ?? "465", 10),
    smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD,
  },

  ai: {
    provider: process.env.AI_PROVIDER ?? "db_generated",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  },
});
