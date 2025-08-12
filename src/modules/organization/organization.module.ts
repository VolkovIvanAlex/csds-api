import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from 'src/infrastracture/prisma/prisma.module';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { AuthModule } from 'src/modules/auth/auth.module';
import { FileModule } from '../../infrastracture/file-manager/file.module';
import { PrivyModule } from 'src/infrastracture/privy/privy.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    PrismaModule, 
    FileModule, 
    PrivyModule
  ],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationsModule {}
