import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../auth/supabase.service';

@Injectable()
export class UsersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UsersService.name);
  private authCleanupTimer?: NodeJS.Timeout;
  private retryingAuthCleanup = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  onModuleInit() {
    this.authCleanupTimer = setInterval(() => {
      void this.retryPendingAuthDeletions();
    }, 60_000);
    this.authCleanupTimer.unref();
    void this.retryPendingAuthDeletions();
  }

  onModuleDestroy() {
    if (this.authCleanupTimer) clearInterval(this.authCleanupTimer);
  }

  private async tryAuthDeletion(authUserId: string): Promise<boolean> {
    try {
      await this.supabase.deleteUser(authUserId);
      await this.prisma.pendingAuthDeletion.deleteMany({ where: { authUserId } });
      return true;
    } catch (error) {
      await this.prisma.pendingAuthDeletion.updateMany({
        where: { authUserId },
        data: { attempts: { increment: 1 }, lastAttemptAt: new Date() },
      }).catch(() => undefined);
      this.logger.error(
        'Supabase Auth deletion is pending and will be retried automatically',
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  private async retryPendingAuthDeletions() {
    if (this.retryingAuthCleanup) return;
    this.retryingAuthCleanup = true;
    try {
      const pending = await this.prisma.pendingAuthDeletion.findMany({
        orderBy: { createdAt: 'asc' },
        take: 50,
        select: { authUserId: true },
      });
      for (const deletion of pending) {
        await this.tryAuthDeletion(deletion.authUserId);
      }
    } catch (error) {
      this.logger.error(
        'Could not process pending Supabase Auth deletions',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.retryingAuthCleanup = false;
    }
  }

  private passwordResetRedirectUrl() {
    const configuredFrontendUrl = process.env.FRONTEND_URL?.trim();
    const frontendUrlValue =
      configuredFrontendUrl ||
      (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');
    if (!frontendUrlValue) {
      this.logger.error(
        'Password reset approval blocked: FRONTEND_URL is missing',
      );
      throw new InternalServerErrorException(
        'Chưa thể tạo liên kết đặt lại mật khẩu. Vui lòng báo quản trị viên kiểm tra cấu hình ứng dụng.',
      );
    }

    let frontendUrl: URL;
    try {
      frontendUrl = new URL(frontendUrlValue);
    } catch {
      this.logger.error(
        'Password reset approval blocked: FRONTEND_URL is invalid',
      );
      throw new InternalServerErrorException(
        'Chưa thể tạo liên kết đặt lại mật khẩu. Vui lòng báo quản trị viên kiểm tra cấu hình ứng dụng.',
      );
    }
    if (
      process.env.NODE_ENV === 'production' &&
      frontendUrl.protocol !== 'https:'
    ) {
      this.logger.error(
        'Password reset approval blocked: production FRONTEND_URL must use HTTPS',
      );
      throw new InternalServerErrorException(
        'Chưa thể tạo liên kết đặt lại mật khẩu. Vui lòng báo quản trị viên kiểm tra cấu hình ứng dụng.',
      );
    }

    return new URL('/reset-password', frontendUrl).toString();
  }

  private auditValue(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value) ?? null;
      } catch {
        return null;
      }
    }
    if (typeof value === 'string') return value;
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return value.toString();
    }
    if (typeof value === 'symbol') return value.description ?? null;
    return null;
  }

  private async auditDiff(
    tx: Prisma.TransactionClient,
    data: {
      userId: string;
      entityId: string;
      oldUser: {
        roleId: string;
        departmentId: string | null;
      };
      newUser: {
        roleId: string;
        departmentId: string | null;
      };
    },
  ) {
    for (const fieldName of ['roleId', 'departmentId'] as const) {
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
    data: { roleId?: string; departmentId?: string | null },
    updatedBy: string,
  ) {
    if (data.roleId === undefined && data.departmentId === undefined) {
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

        let departmentId: string | null = null;
        if (role.name === 'DEPARTMENT_EDITOR') {
          departmentId =
            data.departmentId === undefined
              ? oldUser.departmentId
              : data.departmentId;
          if (!departmentId) {
            throw new BadRequestException(
              'Phải gắn phòng ban cho tài khoản phòng ban',
            );
          }
          if (
            data.departmentId !== undefined ||
            oldUser.role.name !== role.name
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

        const remainsAdmin = role.name === 'ADMIN' && oldUser.isActive;
        if (
          oldUser.role.name === 'ADMIN' &&
          oldUser.isActive &&
          !remainsAdmin
        ) {
          const activeAdmins = await tx.user.count({
            where: { isActive: true, role: { name: 'ADMIN' } },
          });
          if (activeAdmins <= 1) {
            throw new ConflictException(
              'Không thể hạ quyền Admin cuối cùng',
            );
          }
        }

        if (
          role.id === oldUser.roleId &&
          departmentId === oldUser.departmentId
        ) {
          return oldUser;
        }

        const user = await tx.user.update({
          where: { id },
          data: { roleId: role.id, departmentId },
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
          },
        });

        return user;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async deleteUser(id: string, deletedBy: string) {
    if (id === deletedBy) {
      throw new BadRequestException(
        'Không thể xóa tài khoản Admin đang đăng nhập. Hãy nhờ Admin khác thực hiện.',
      );
    }

    const deletedUser = await this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({
          where: { id },
          include: { role: true },
        });
        if (!user) throw new NotFoundException('Không tìm thấy người dùng');

        if (user.role.name === 'ADMIN' && user.isActive) {
          const activeAdmins = await tx.user.count({
            where: { isActive: true, role: { name: 'ADMIN' } },
          });
          if (activeAdmins <= 1) {
            throw new BadRequestException(
              'Không thể xóa Admin cuối cùng đang hoạt động.',
            );
          }
        }

        const [relatedTasks, authoredFeedbacks, lockedPeriods] =
          await Promise.all([
            tx.task.count({
              where: {
                OR: [
                  { createdBy: id },
                  { updatedBy: id },
                  { assignedBy: id },
                  { cancelledBy: id },
                  { approvedBy: id },
                  { finalizedBy: id },
                ],
              },
            }),
            tx.taskFeedback.count({ where: { authorId: id } }),
            tx.periodLock.count({ where: { lockedBy: id } }),
          ]);

        await tx.userRegistrationRequest.deleteMany({
          where: {
            OR: [
              { authUserId: user.authUserId },
              ...(user.email ? [{ email: user.email }] : []),
            ],
          },
        });

        await tx.auditLog.create({
          data: {
            userId: deletedBy,
            action: 'DELETE_USER',
            entityType: 'USER',
            entityId: user.id,
            fieldName: 'account',
            oldValue: JSON.stringify({
              id: user.id,
              authUserId: user.authUserId,
              relatedRecords: {
                tasks: relatedTasks,
                feedbacks: authoredFeedbacks,
                periodLocks: lockedPeriods,
              },
              fullName: user.fullName,
              role: user.role.name,
            }),
            newValue: null,
          },
        });

        await tx.pendingAuthDeletion.upsert({
          where: { authUserId: user.authUserId },
          update: {},
          create: { authUserId: user.authUserId },
        });

        await tx.user.delete({ where: { id } });
        return {
          id: user.id,
          authUserId: user.authUserId,
          fullName: user.fullName,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const authCleanupPending = !(await this.tryAuthDeletion(deletedUser.authUserId));
    return { id: deletedUser.id, fullName: deletedUser.fullName, authCleanupPending };
  }

  async register(data: {
    email: string;
    fullName: string;
    password: string;
    confirmPassword: string;
  }) {
    const email = data.email.trim().toLowerCase();
    const fullName = data.fullName.trim();
    if (!fullName) throw new BadRequestException('Họ tên không được để trống');
    if (data.password !== data.confirmPassword) {
      throw new BadRequestException('Hai mật khẩu không khớp');
    }

    const genericResponse = {
      accepted: true,
      message: 'Yêu cầu đã gửi. Tài khoản chỉ hoạt động sau khi Admin duyệt.',
    };
    let createdAuthUserId: string | undefined;

    try {
      const existingRequest =
        await this.prisma.userRegistrationRequest.findUnique({
          where: { email },
        });
      if (
        existingRequest?.status === 'PENDING' ||
        existingRequest?.status === 'APPROVED'
      ) {
        throw new ConflictException(
          'Email này đã được đăng ký hoặc đang có yêu cầu chờ duyệt.',
        );
      }
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existingUser) {
        throw new ConflictException(
          'Email này đã có tài khoản. Hãy đăng nhập hoặc gửi yêu cầu đặt lại mật khẩu.',
        );
      }

      if (existingRequest?.status === 'REJECTED') {
        return await this.prisma
          .$transaction(
            async (tx) => {
              const request = await tx.userRegistrationRequest.findUnique({
                where: { id: existingRequest.id },
              });
              if (!request || request.status !== 'REJECTED') {
                throw new ConflictException(
                  'Yêu cầu đăng ký đã thay đổi. Hãy tải lại trang.',
                );
              }

              const claim = await tx.userRegistrationRequest.updateMany({
                where: { id: request.id, status: 'REJECTED' },
                data: {
                  status: 'PENDING',
                  reviewedBy: null,
                  reviewedAt: null,
                  rejectionReason: null,
                  fullName,
                },
              });
              if (claim.count !== 1) {
                throw new ConflictException(
                  'Yêu cầu đăng ký đã thay đổi. Hãy tải lại trang.',
                );
              }

              let authUserId = request.authUserId;
              if (authUserId) {
                await this.supabase.updatePendingUser(
                  authUserId,
                  email,
                  fullName,
                  data.password,
                );
              } else {
                const authUser = await this.supabase.createPendingUser(
                  email,
                  fullName,
                  data.password,
                );
                authUserId = authUser.id;
                createdAuthUserId = authUser.id;
              }

              await tx.userRegistrationRequest.update({
                where: { id: request.id },
                data: { authUserId },
              });
              await tx.auditLog.create({
                data: {
                  userId: null,
                  action: 'SUBMIT_REGISTRATION',
                  entityType: 'USER_REGISTRATION_REQUEST',
                  entityId: request.id,
                  fieldName: 'request',
                  oldValue: 'REJECTED',
                  newValue: JSON.stringify({
                    email,
                    fullName,
                    status: 'PENDING',
                  }),
                },
              });
              return genericResponse;
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          )
          .then((result) => {
            createdAuthUserId = undefined;
            return result;
          });
      }

      const authUser = await this.supabase.createPendingUser(
        email,
        fullName,
        data.password,
      );
      createdAuthUserId = authUser.id;

      const result = await this.prisma.$transaction(
        async (tx) => {
          const savedRequest = await tx.userRegistrationRequest.create({
            data: { authUserId: authUser.id, email, fullName },
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
      createdAuthUserId = undefined;
      return result;
    } catch (error) {
      if (createdAuthUserId) {
        await this.supabase
          .deleteUser(createdAuthUserId)
          .catch((cleanupError) => {
            this.logger.error(
              'Could not clean up unlinked pending Auth user after registration failure',
              cleanupError instanceof Error ? cleanupError.stack : undefined,
            );
          });
      }
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const authError = error as { code?: string; message?: string };
      if (
        authError.code === 'user_already_exists' ||
        authError.code === 'email_exists' ||
        authError.message?.toLowerCase().includes('already registered')
      ) {
        throw new ConflictException(
          'Email này đã có tài khoản. Hãy đăng nhập hoặc gửi yêu cầu đặt lại mật khẩu.',
        );
      }
      const code = (error as { code?: string })?.code;
      if (code === 'P2002' || code === 'P2034') {
        const existingRequest =
          await this.prisma.userRegistrationRequest.findUnique({
            where: { email },
          });
        if (
          existingRequest?.status === 'PENDING' ||
          existingRequest?.status === 'APPROVED'
        ) {
          throw new ConflictException(
            'Email này đã được đăng ký hoặc đang có yêu cầu chờ duyệt.',
          );
        }
        const existingUser = await this.prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (existingUser) {
          throw new ConflictException(
            'Email này đã có tài khoản. Hãy đăng nhập hoặc gửi yêu cầu đặt lại mật khẩu.',
          );
        }
      }
      this.logger.error('Registration request could not be completed');
      throw new InternalServerErrorException(
        'Chưa gửi được yêu cầu đăng ký. Vui lòng thử lại sau.',
      );
    }
  }

  async findRegistrationRequests() {
    const requests = await this.prisma.userRegistrationRequest.findMany({
      select: {
        id: true,
        authUserId: true,
        email: true,
        fullName: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
        reviewer: { select: { id: true, fullName: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    return requests.map(({ authUserId, ...request }) => ({
      ...request,
      passwordReady: Boolean(authUserId),
    }));
  }

  async approveRegistrationRequest(
    id: string,
    data: { roleId: string; departmentId?: string },
    reviewedBy: string,
  ) {
    const initialRequest = await this.prisma.userRegistrationRequest.findUnique(
      {
        where: { id },
      },
    );
    if (!initialRequest) {
      throw new NotFoundException('Không tìm thấy yêu cầu đăng ký');
    }
    if (initialRequest.status !== 'PENDING') {
      throw new ConflictException('Yêu cầu đăng ký đã được xử lý');
    }
    if (!initialRequest.authUserId) {
      throw new BadRequestException(
        'Yêu cầu cũ chưa có mật khẩu. Hãy từ chối yêu cầu này và nhờ người đăng ký gửi lại.',
      );
    }
    const approvedAuthUserId = initialRequest.authUserId;

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

        try {
          await this.supabase.approvePendingUser(
            approvedAuthUserId,
            request.email,
            request.fullName,
          );
        } catch {
          this.logger.error('Could not activate approved Auth account');
          throw new InternalServerErrorException(
            'Chưa kích hoạt được tài khoản. Vui lòng thử lại sau.',
          );
        }

        const user = await tx.user.create({
          data: {
            authUserId: approvedAuthUserId,
            email: request.email,
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

  async requestPasswordReset(emailInput: string) {
    const email = emailInput.trim().toLowerCase();
    const acceptedResponse = {
      accepted: true,
      message:
        'Nếu email thuộc tài khoản đang hoạt động, yêu cầu sẽ được quản trị viên xem xét.',
    };
    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
      select: { id: true },
    });
    if (!user) return acceptedResponse;

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.userPasswordResetRequest.findUnique({
            where: { userId: user.id },
          });
          if (existing?.status === 'PENDING') return;

          let requestId: string;
          let oldStatus: string | null;
          if (existing) {
            const claim = await tx.userPasswordResetRequest.updateMany({
              where: { id: existing.id, status: existing.status },
              data: {
                status: 'PENDING',
                reviewedBy: null,
                reviewedAt: null,
                createdAt: new Date(),
              },
            });
            if (claim.count !== 1) return;
            requestId = existing.id;
            oldStatus = existing.status;
          } else {
            const request = await tx.userPasswordResetRequest.create({
              data: { userId: user.id },
            });
            requestId = request.id;
            oldStatus = null;
          }

          await tx.auditLog.create({
            data: {
              userId: null,
              action: 'REQUEST_PASSWORD_RESET',
              entityType: 'USER_PASSWORD_RESET_REQUEST',
              entityId: requestId,
              fieldName: 'status',
              oldValue: oldStatus,
              newValue: 'PENDING',
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== 'P2002' && code !== 'P2034') throw error;
    }

    return acceptedResponse;
  }

  async findPasswordResetRequests() {
    return this.prisma.userPasswordResetRequest.findMany({
      include: {
        user: { select: { fullName: true, email: true, isActive: true } },
        reviewer: { select: { id: true, fullName: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async approvePasswordResetRequest(id: string, reviewedBy: string) {
    const redirectTo = this.passwordResetRedirectUrl();
    return this.prisma.$transaction(
      async (tx) => {
        const request = await tx.userPasswordResetRequest.findUnique({
          where: { id },
          include: { user: true },
        });
        if (!request) {
          throw new NotFoundException(
            'Không tìm thấy yêu cầu đặt lại mật khẩu',
          );
        }
        if (request.status !== 'PENDING') {
          throw new ConflictException('Yêu cầu đặt lại mật khẩu đã được xử lý');
        }
        if (!request.user.isActive) {
          throw new BadRequestException(
            'Tài khoản đã ngừng hoạt động, không thể đặt lại mật khẩu.',
          );
        }
        if (!request.user.email) {
          throw new InternalServerErrorException(
            'Tài khoản thiếu email. Vui lòng báo quản trị viên kiểm tra.',
          );
        }

        const claim = await tx.userPasswordResetRequest.updateMany({
          where: { id, status: 'PENDING' },
          data: { status: 'APPROVED', reviewedBy, reviewedAt: new Date() },
        });
        if (claim.count !== 1) {
          throw new ConflictException('Yêu cầu đặt lại mật khẩu đã được xử lý');
        }

        let passwordResetLink: string;
        try {
          passwordResetLink = await this.supabase.generatePasswordResetLink(
            request.user.email,
            redirectTo,
          );
        } catch {
          this.logger.error('Could not generate password reset link');
          throw new InternalServerErrorException(
            'Chưa tạo được liên kết đặt lại mật khẩu. Vui lòng thử lại sau.',
          );
        }
        await tx.auditLog.create({
          data: {
            userId: reviewedBy,
            action: 'APPROVE_PASSWORD_RESET',
            entityType: 'USER_PASSWORD_RESET_REQUEST',
            entityId: id,
            fieldName: 'status',
            oldValue: 'PENDING',
            newValue: 'APPROVED',
          },
        });

        return {
          email: request.user.email,
          fullName: request.user.fullName,
          passwordResetLink,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      },
    );
  }

  async rejectPasswordResetRequest(id: string, reviewedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.userPasswordResetRequest.findUnique({
        where: { id },
      });
      if (!request) {
        throw new NotFoundException('Không tìm thấy yêu cầu đặt lại mật khẩu');
      }
      if (request.status !== 'PENDING') {
        throw new ConflictException('Yêu cầu đặt lại mật khẩu đã được xử lý');
      }

      const claim = await tx.userPasswordResetRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'REJECTED', reviewedBy, reviewedAt: new Date() },
      });
      if (claim.count !== 1) {
        throw new ConflictException('Yêu cầu đặt lại mật khẩu đã được xử lý');
      }

      await tx.auditLog.create({
        data: {
          userId: reviewedBy,
          action: 'REJECT_PASSWORD_RESET',
          entityType: 'USER_PASSWORD_RESET_REQUEST',
          entityId: id,
          fieldName: 'status',
          oldValue: 'PENDING',
          newValue: 'REJECTED',
        },
      });

      return tx.userPasswordResetRequest.findUniqueOrThrow({ where: { id } });
    });
  }
}
