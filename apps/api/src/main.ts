import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Never log incoming request bodies at the framework level — PHI risk.
    logger: ["error", "warn", "log"],
  });
  const config = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({
    origin: config.get<string>("webUrl"),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix("api/v1");

  // Dev/QA convenience for exercising endpoints without a UI — not a
  // documented public contract. No PHI-bearing example payloads here.
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Atria Wellness Intake API")
    .setDescription(
      "Multi-tenant patient intake platform API. Authenticate with the " +
        '"Authorize" button using a bearer token — in AUTH_PROVIDER=stub ' +
        "mode any string works and is matched directly against a seeded " +
        "User.clerkUserId.",
    )
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, swaggerDocument);

  const port = config.get<number>("port") ?? 4000;
  await app.listen(port);
}

bootstrap();
