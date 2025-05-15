import { Injectable, ExecutionContext, CanActivate, Inject, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../services/auth.service';
import { PrismaService } from 'src/infrastracture/prisma/prisma.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  constructor(
  ) {
    super();
  }
  @Inject()
  private authService: AuthService;
  @Inject()
  private prisma: PrismaService;

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const url = request.url;
    try {
      const result = (await super.canActivate(context)) as boolean;

      if (!result) {
        return false;
      }

      const request = context.switchToHttp().getRequest();
      const user = request.user;
      const token = request.cookies?.['CSDS-Access-Token'];
      if (!user) {
        console.log(`Unauthorized access attempt to ${url} - no user}`);
        return false;
      }
      const session = await this.prisma.session.findUnique({
        where: { userId: user.id },
      });

      if (!session || new Date(session.expiresAt) < new Date()) {
        console.log(`Expired or missing session for user ${user.email} accessing ${url}`);
        await this.authService.logout(user.id);
        return false;
      }

      const tokenIsValid = token && (await this.authService.validateAuthToken(token));

      if (!tokenIsValid) {
        console.log(`Invalid token for user ${user.email} accessing ${url}`);
      }
      return tokenIsValid;
    } catch (error: unknown) {
      console.log(error);
      return false;
    }
  }
}
