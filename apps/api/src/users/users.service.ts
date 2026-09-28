import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../auth/supabase.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        isActive: true,
        role: { select: { id: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async register(data: {
    email: string;
    fullName: string;
    password: string;
  }) {
    const email = data.email.trim().toLowerCase();
    const fullName = data.fullName.trim();
    const existingRequest = await this.prisma.userRegistrationRequest.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });

    if (existingRequest?.status === 'PENDING') {
      throw new ConflictException('Email này đã có yêu cầu đang chờ Admin duyệt');
    }

    const existingAuthUser = await this.supabase.getUserByEmail(email);
    if (existingAuthUser) {
      const existingUser = await this.prisma.user.findUnique({
        where: { authUserId: existingAuthUser.id },
        select: { id: true },
      });
      if (existingUser) {
        throw new ConflictException('Email này đã được cấp tài khoản');
      }
      if (!existingRequest || existingRequest.status !== 'REJECTED') {
        throw new ConflictException('Email này đã tồn tại trong hệ thống');
      }
    }

    const authUser = existingAuthUser
      ? await this.supabase.resetPendingUser(
          existingAuthUser.id,
          fullName,
          data.password,
        )
      : await this.supabase.createUser(email, fullName, data.password);
    if (!authUser) {
      throw new BadRequestException('Không thể tạo tài khoản đăng nhập');
    }

    const request = existingRequest
      ? await this.prisma.userRegistrationRequest.update({
          where: { id: existingRequest.id },
          data: {
            authUserId: authUser.id,
            email,
            fullName,
            status: 'PENDING',
            reviewedBy: null,
            reviewedAt: null,
            rejectionReason: null,
          },
        })
      : await this.prisma.userRegistrationRequest.create({
          data: {
            authUserId: authUser.id,
            email,
            fullName,
          },
        });

    return {
      id: request.id,
      email: request.email,
      fullName: request.fullName,
      status: request.status,
      message: 'Đăng ký thành công. Vui lòng chờ Admin duyệt tài khoản.',
    };
  }

  async findRegistrationRequests() {
    return this.prisma.userRegistrationRequest.findMany({
      include: {
        reviewer: { select: { id: true, fullName: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async approveRegistrationRequest(
    id: string,
    data: { roleId: string; departmentId?: string },
    reviewedBy: string,
  ) {
    const request = await this.prisma.userRegistrationRequest.findUnique({
      where: { id },
    });
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu đăng ký');
    if (request.status !== 'PENDING') {
      throw new ConflictException('Yêu cầu đăng ký đã được xử lý');
    }

    const role = await this.prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');

    let departmentId: string | null = null;
    if (role.name === 'DEPARTMENT_EDITOR') {
      if (!data.departmentId) {
        throw new BadRequestException('Phải chọn phòng ban cho tài khoản phòng ban');
      }
      const department = await this.prisma.department.findUnique({
        where: { id: data.departmentId },
      });
      if (!department || !department.isActive) {
        throw new BadRequestException('Phòng ban không tồn tại hoặc đã ngừng hoạt động');
      }
      departmentId = department.id;
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { authUserId: request.authUserId },
    });
    if (existingUser) {
      throw new ConflictException('Tài khoản này đã được cấp quyền');
    }

    await this.supabase.activateUser(request.authUserId);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          authUserId: request.authUserId,
          fullName: request.fullName,
          roleId: role.id,
          departmentId,
        },
        include: { role: true, department: true },
      });

      await tx.userRegistrationRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedBy,
          reviewedAt: new Date(),
          rejectionReason: null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: reviewedBy,
          action: 'APPROVE_REGISTRATION',
          entityType: 'USER_REGISTRATION_REQUEST',
          entityId: id,
        },
      });

      return user;
    });
  }

  async rejectRegistrationRequest(
    id: string,
    reason: string | undefined,
    reviewedBy: string,
  ) {
    const request = await this.prisma.userRegistrationRequest.findUnique({
      where: { id },
    });
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu đăng ký');
    if (request.status !== 'PENDING') {
      throw new ConflictException('Yêu cầu đăng ký đã được xử lý');
    }

    return this.prisma.$transaction(async (tx) => {
      const rejected = await tx.userRegistrationRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedBy,
          reviewedAt: new Date(),
          rejectionReason: reason?.trim() || null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: reviewedBy,
          action: 'REJECT_REGISTRATION',
          entityType: 'USER_REGISTRATION_REQUEST',
          entityId: id,
        },
      });

      return rejected;
    });
  }
}
