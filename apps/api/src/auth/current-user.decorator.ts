import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUser as CurrentUserType } from './current-user.middleware';

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserType | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: CurrentUserType | undefined = request.currentUser;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
