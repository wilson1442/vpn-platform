import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// BigInt values from Prisma (bytesReceived/bytesSent) must be serializable to JSON
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3100', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT || 3000);
  console.log(`API running on port ${process.env.PORT || 3000}`);
}
bootstrap();
