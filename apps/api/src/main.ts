import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { getApiEnv } from "./config/env.js";

async function bootstrap() {
  const env = getApiEnv();
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: env.WEB_ORIGIN,
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  const config = new DocumentBuilder()
    .setTitle("ProofPilot API")
    .setDescription("REST API for ProofPilot case packet automation.")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  await app.listen(env.PORT);
}

void bootstrap();
