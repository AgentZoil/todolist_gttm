import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../auth/supabase.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  private auditValue(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value) ?? String(value);
    return String(value);
  }

  private async auditDiff(
    tx: Prisma.TransactionClient,
    data: {
      userId: string;
      entityId: string;
      oldUser: { roleId: string; departmentId: string | null; isActive: boolean };
      newUser: { roleId: string; departmentId: string | null; isActive: boolean };
    },
  ) {
    for (const fieldName of ['roleId', 'departmentId', 'isActive'] as const) {
      const oldValue = this.auditValue(data.oldUser[fieldName]);
      const newValue = this.auditValue(data.newUser[fieldName]);
      if (oldValue === newValue) continue;

      await tx.auditLog.create({
        data: {
          userId: data.userId,
          action: 'UPDATE_USER',
          entityType: 'USER',
          entityId: data.entityId,
          fieldName,
          oldValue,
          newValue,
        },
      });
    }
  }

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

  async updateUser(
    id: string,
    data: { roleId?: string; departmentId?: string | null; isActive?: boolean },
    updatedBy: string,
  ) {
    if (
      data.roleId === undefined &&
      data.departmentId === undefined &&
      data.isActive === undefined
    ) {
      throw new BadRequestException('Cần cung cấp thay đổi tài khoản');
    }
    return this.prisma.$transaction(
      async (tx) => {
        const oldUser = await tx.user.findUnique({
          where: { id },
          include: {
            role: true,
            department: { select: { id: true, code: true, name: true } },
          },
        });
        if (!oldUser) throw new NotFoundException('Không tìm thấy người dùng');

        const role = data.roleId
          ? await tx.role.findUnique({ where: { id: data.roleId } })
          : oldUser.role;
        if (!role) throw new NotFoundException('Không tìm thấy vai trò');

        const isActive = data.isActive ?? oldUser.isActive;
        let departmentId: string | null = null;
        if (role.name === 'DEPARTMENT_EDITOR') {
          departmentId = data.departmentId === undefined
            ? oldUser.departmentId
            : data.departmentId;
          if (!departmentId) {
            throw new BadRequestException(
              'Phải gắn phòng ban cho tài khoản phòng ban',
            );
          }
          if (
            data.departmentId !== undefined ||
            oldUser.role.name !== role.name ||
            isActive
          ) {
            const department = await tx.department.findUnique({
              where: { id: departmentId },
            });
            if (!department || !department.isActive) {
              throw new BadRequestException(
                'Phòng ban không tồn tại hoặc đã ngừng hoạt động',
              );
            }
          }
        }

        const remainsAdmin = role.name === 'ADMIN' && isActive;
        if (oldUser.role.name === 'ADMIN' && oldUser.isActive && !remainsAdmin) {
          const activeAdmins = await tx.user.count({
            where: { isActive: true, role: { name: 'ADMIN' } },
          });
          if (activeAdmins <= 1) {
            throw new ConflictException(
              'Không thể vô hiệu hóa hoặc hạ quyền Admin cuối cùng',
            );
          }
        }

        if (
          role.id === oldUser.roleId &&
          departmentId === oldUser.departmentId &&
          isActive === oldUser.isActive
        ) {
          return oldUser;
        }

        const user = await tx.user.update({
          where: { id },
          data: { roleId: role.id, departmentId, isActive },
          include: {
            role: true,
            department: { select: { id: true, code: true, name: true } },
          },
        });

        await this.auditDiff(tx, {
          userId: updatedBy,
          entityId: id,
          oldUser,
          newUser: {
            roleId: user.roleId,
            departmentId: user.departmentId,
            isActive: user.isActive,
          },
        });

        return user;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async register(data: { email: string; fullName: string }) {
    const email = data.email.trim().toLowerCase();
    const fullName = data.fullName.trim();
    if (!fullName) throw new BadRequestException('Họ tên không được để trống');
    const genericResponse = {
      accepted: true,
      message:
        'Nếu thông tin đủ điều kiện, yêu cầu sẽ được Admin xem xét qua email đã đăng ký.',
    };

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existingRequest = await tx.userRegistrationRequest.findUnique({
            where: { email },
          });
          if (
            existingRequest?.status === 'PENDING' ||
            existingRequest?.status === 'APPROVED'
          ) {
            return genericResponse;
          }

          if (existingRequest?.status === 'REJECTED') {
            const claim = await tx.userRegistrationRequest.updateMany({
              where: { id: existingRequest.id, status: 'REJECTED' },
              data: {
                status: 'PENDING',
                reviewedBy: null,
                reviewedAt: null,
                rejectionReason: null,
                fullName,
              },
            });
            if (claim.count !== 1) return genericResponse;

            await tx.auditLog.create({
              data: {
                userId: null,
                action: 'SUBMIT_REGISTRATION',
                entityType: 'USER_REGISTRATION_REQUEST',
                entityId: existingRequest.id,
                fieldName: 'request',
                oldValue: 'REJECTED',
                newValue: JSON.stringify({ email, fullName, status: 'PENDING' }),
              },
            });
            return genericResponse;
          }

          const savedRequest = await tx.userRegistrationRequest.create({
            data: { email, fullName },
          });
          await tx.auditLog.create({
            data: {
              userId: null,
              action: 'SUBMIT_REGISTRATION',
              entityType: 'USER_REGISTRATION_REQUEST',
              entityId: savedRequest.id,
              fieldName: 'request',
              oldValue: null,
              newValue: JSON.stringify({ email, fullName, status: 'PENDING' }),
            },
          });
          return genericResponse;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const code = (error as { code?: string })?.code;
      // The unique email constraint makes concurrent duplicate submissions safe.
      if (code === 'P2002') return genericResponse;
      if (code === 'P2034') {
        const existingRequest = await this.prisma.userRegistrationRequest.findUnique({
          where: { email },
        });
        if (existingRequest) return genericResponse;
      }
      throw error;
    }
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
    const initialRequest = await this.prisma.userRegistrationRequest.findUnique({
      where: { id },
    });
    if (!initialRequest) {
      throw new NotFoundException('Không tìm thấy yêu cầu đăng ký');
    }
    if (initialRequest.status !== 'PENDING') {
      throw new ConflictException('Yêu cầu đăng ký đã được xử lý');
    }

    let authUserId = initialRequest.authUserId;
    if (!authUserId) {
      let authUser: Awaited<ReturnType<SupabaseService['createPendingUser']>>;
      try {
        authUser = await this.supabase.createPendingUser(
          initialRequest.email,
          initialRequest.fullName,
        );
      } catch (error) {
        const authError = error as { code?: string; message?: string };
        if (
          authError.code === 'user_already_exists' ||
          authError.message?.toLowerCase().includes('already registered')
        ) {
          throw new ConflictException(
            'Email này đã có tài khoản Supabase; không thể tự gắn để tránh cấp nhầm tài khoản.',
          );
        }
        throw error;
      }

      try {
        const claim = await this.prisma.userRegistrationRequest.updateMany({
          where: { id, status: 'PENDING', authUserId: null },
          data: { authUserId: authUser.id },
        });
        if (claim.count !== 1) {
          throw new ConflictException('Yêu cầu đăng ký đã được xử lý');
        }
        authUserId = authUser.id;
      } catch (error) {
        // Do not leave an unlinked Auth identity if persisting the link fails.
        await this.supabase.deleteUser(authUser.id).catch(() => undefined);
        throw error;
      }
    }
    if (!authUserId) {
      throw new InternalServerErrorException(
        'Không tạo được tài khoản xác thực cho yêu cầu đăng ký',
      );
    }
    const approvedAuthUserId = authUserId;

    return this.prisma.$transaction(
      async (tx) => {
        const request = await tx.userRegistrationRequest.findUnique({
          where: { id },
        });
        if (!request) {
          throw new NotFoundException('Không tìm thấy yêu cầu đăng ký');
        }
        if (request.status !== 'PENDING') {
          throw new ConflictException('Yêu cầu đăng ký đã được xử lý');
        }

        const role = await tx.role.findUnique({ where: { id: data.roleId } });
        if (!role) throw new NotFoundException('Không tìm thấy vai trò');

        let departmentId: string | null = null;
        if (role.name === 'DEPARTMENT_EDITOR') {
          if (!data.departmentId) {
            throw new BadRequestException(
              'Phải chọn phòng ban cho tài khoản phòng ban',
            );
          }
          const department = await tx.department.findUnique({
            where: { id: data.departmentId },
          });
          if (!department || !department.isActive) {
            throw new BadRequestException(
              'Phòng ban không tồn tại hoặc đã ngừng hoạt động',
            );
          }
          departmentId = department.id;
        }

        const claim = await tx.userRegistrationRequest.updateMany({
          where: { id, status: 'PENDING' },
          data: {
            status: 'APPROVED',
            reviewedBy,
            reviewedAt: new Date(),
            rejectionReason: null,
          },
        });
        if (claim.count !== 1) {
          throw new ConflictException('Yêu cầu đăng ký đã được xử lý');
        }

        const existingUser = await tx.user.findUnique({
          where: { authUserId: approvedAuthUserId },
        });
        if (existingUser) {
          throw new ConflictException('Tài khoản này đã được cấp quyền');
        }

        const configuredFrontendUrl = process.env.FRONTEND_URL?.trim();
        if (!configuredFrontendUrl) {
          throw new InternalServerErrorException('FRONTEND_URL chưa được cấu hình');
        }
        let frontendUrl: URL;
        try {
          frontendUrl = new URL(configuredFrontendUrl);
        } catch {
          throw new InternalServerErrorException('FRONTEND_URL không hợp lệ');
        }
        if (
          process.env.NODE_ENV === 'production' &&
          frontendUrl.protocol !== 'https:'
        ) {
          throw new InternalServerErrorException('FRONTEND_URL production phải dùng HTTPS');
        }
        await this.supabase.activateUserAndSendPasswordSetup(
          approvedAuthUserId,
          request.email,
          request.fullName,
          new URL('/reset-password', frontendUrl).toString(),
        );

        const user = await tx.user.create({
          data: {
            authUserId: approvedAuthUserId,
            fullName: request.fullName,
            roleId: role.id,
            departmentId,
          },
          include: { role: true, department: true },
        });

        await tx.auditLog.createMany({
          data: [
            {
              userId: reviewedBy,
              action: 'APPROVE_REGISTRATION',
              entityType: 'USER_REGISTRATION_REQUEST',
              entityId: id,
              fieldName: 'status',
              oldValue: 'PENDING',
              newValue: 'APPROVED',
            },
            {
              userId: reviewedBy,
              action: 'CREATE_USER',
              entityType: 'USER',
              entityId: user.id,
              fieldName: 'account',
              oldValue: null,
              newValue: JSON.stringify({
                fullName: user.fullName,
                role: role.name,
                departmentId,
                isActive: user.isActive,
              }),
            },
          ],
        });

        return user;
      },
      { timeout: 15000 },
    );
  }

  async rejectRegistrationRequest(
    id: string,
    reason: string | undefined,
    reviewedBy: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.userRegistrationRequest.findUnique({
        where: { id },
      });
      if (!request) {
        throw new NotFoundException('Không tìm thấy yêu cầu đăng ký');
      }
      if (request.status !== 'PENDING') {
        throw new ConflictException('Yêu cầu đăng ký đã được xử lý');
      }

      const rejectionReason = reason?.trim() || null;
      const claim = await tx.userRegistrationRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          reviewedBy,
          reviewedAt: new Date(),
          rejectionReason,
        },
      });
      if (claim.count !== 1) {
        throw new ConflictException('Yêu cầu đăng ký đã được xử lý');
      }

      await tx.auditLog.create({
        data: {
          userId: reviewedBy,
          action: 'REJECT_REGISTRATION',
          entityType: 'USER_REGISTRATION_REQUEST',
          entityId: id,
          fieldName: 'status/rejectionReason',
          oldValue: JSON.stringify({ status: 'PENDING' }),
          newValue: JSON.stringify({ status: 'REJECTED', rejectionReason }),
        },
      });

      return tx.userRegistrationRequest.findUniqueOrThrow({ where: { id } });
    });
  }
}
