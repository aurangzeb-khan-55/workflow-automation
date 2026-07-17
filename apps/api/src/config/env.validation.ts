import { plainToInstance } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min, validateSync } from "class-validator";

enum Environment {
  Development = "development",
  Test = "test",
  Production = "production",
}

class EnvironmentVariables {
  @IsIn(Object.values(Environment))
  NODE_ENV!: Environment;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_HOST!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT!: number;

  @IsIn(["stub", "clerk"])
  AUTH_PROVIDER!: string;

  // "gmail" is a TEMPORARY testing option — see gmail-smtp-email.provider.ts.
  @IsIn(["stub", "mailhippo", "gmail"])
  EMAIL_PROVIDER!: string;

  @IsIn(["s3"])
  STORAGE_PROVIDER!: string;

  @IsString()
  STORAGE_BUCKET!: string;

  @IsIn(["db_generated", "anthropic"])
  AI_PROVIDER!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT!: number;

  @IsOptional()
  @IsString()
  WEB_URL?: string;
}

/**
 * Fails fast on boot if required config is missing/malformed, rather than
 * surfacing as a confusing runtime error later (e.g. mid-intake-submission).
 */
export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n${errors.toString()}`);
  }

  return validated;
}
