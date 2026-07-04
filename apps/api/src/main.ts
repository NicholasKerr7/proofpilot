import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter.js";
import { getApiEnv } from "./config/env.js";
import { ErrorMonitoringService } from "./monitoring/error-monitoring.service.js";

async function bootstrap() {
  const env = getApiEnv();
  const app = await NestFactory.create(AppModule);

  if (env.TRUST_PROXY) {
    const expressInstance = app.getHttpAdapter().getInstance() as {
      set?: (setting: string, value: unknown) => void;
    };
    expressInstance.set?.("trust proxy", 1);
  }

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
  app.useGlobalFilters(new HttpExceptionFilter(app.get(ErrorMonitoringService)));

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
