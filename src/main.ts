import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import ValidationPipes from './core/pipes/validation.pipes';
import { AllExceptionFilter } from './core/filters/exceptions.filter';
import { ConfigService } from '@nestjs/config';
import session from 'express-session';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  app.useGlobalPipes(ValidationPipes.validationPipe);
  app.useGlobalFilters(new AllExceptionFilter(app.get(HttpAdapterHost)));

  const configService = app.get(ConfigService);

  const port = configService.get<number>('BACKEND_PORT', 8000);
  app.use(cookieParser());

  app.enableCors({
    origin: true, //'http://localhost:3000'
    credentials: true,
  });

  app.use(
    session({
      resave: false,
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET || '',
      cookie: {
        httpOnly: true,
        maxAge: Number(process.env.SESSION_MAX_AGE || 24 * 60 * 60 * 1000),
      },
    }),
  );

  //app.useGlobalPipes(new ValidationPipe());
  await app.listen(port, '0.0.0.0');
  console.log(`Application started on port ${port}!`);
}
bootstrap();
