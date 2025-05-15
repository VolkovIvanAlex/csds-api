import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { PrivyModule } from './infrastracture/privy/privy.module';
import { PrivyModuleOptions } from './infrastracture/privy/types/privy.types';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organization/organization.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ReportsModule,
    PrivyModule.registerAsync({
      useFactory: async (
        configService: ConfigService,
      ): Promise<PrivyModuleOptions> => ({
        applicationId: configService.get<string>('PRIVY_APP_ID') || '',
        secret: configService.get<string>('PRIVY_SECRET') || '',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
