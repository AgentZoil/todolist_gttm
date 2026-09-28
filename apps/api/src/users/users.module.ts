import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { RegistrationController } from './registration.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UsersController, RegistrationController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
