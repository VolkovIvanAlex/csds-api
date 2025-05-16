import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from 'src/infrastracture/prisma/prisma.module';
import { UsersController } from './users.controller';
import { UserService } from './users.service';
import { AuthModule } from 'src/modules/auth/auth.module';
import { FileModule } from '../../infrastracture/file-manager/file.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    PrismaModule,
    FileModule
  ],
  controllers: [UsersController],
  providers: [UserService],
  exports: [UserService],
})
export class UsersModule {}
