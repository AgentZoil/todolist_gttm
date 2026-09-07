import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { SupabaseService } from './supabase.service';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [SupabaseService, AuthGuard, RolesGuard],
  exports: [SupabaseService, AuthGuard, RolesGuard],
})
export class AuthModule {}
