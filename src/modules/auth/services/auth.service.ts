import { Inject, Injectable } from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import {AuthException} from '../../../core/exceptions/auth.exceptions';
import { LoginWithPrivyDto } from '../DTO/auth.dto';
import { UserCreateDto } from 'src/modules/users/dto/users.dto';
import { PrivyService } from 'src/infrastracture/privy/privy.service';
import { PrismaService } from 'src/infrastracture/prisma/prisma.service';
import { UserService } from 'src/modules/users/users.service';

@Injectable()
export class AuthService {
  //private readonly googleOauth2Client: any;
  constructor(
  ) {}
  @Inject()
  private userService: UserService;
  @Inject()
  private prisma: PrismaService;
  @Inject()
  private jwtService: JwtService;
  @Inject()
  private configService: ConfigService;
  @Inject()
  private privyService: PrivyService;

  private async generateJwtTokenPrivy(user: any): Promise<string> {
    const accessToken = this.jwtService.sign({
      iat: Number((Date.now() / 1000).toFixed(0)),
      userId: user.id,

      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    //todo do we need refreshToken
    return accessToken;
  }

  // Validate JWT token
  async validateAuthToken(token: string): Promise<boolean> {
    try {
      jwt.verify(token, process.env.JWT_SECRET!);
      return true;
    } catch {
      return false;
    }
  }

  public async validateUserByPrivyAccessToken(
    privyAccessToken: LoginWithPrivyDto['privyAccessToken'],
  ) {
    try {
      const { userId } = await this.privyService.client.verifyAuthToken(privyAccessToken);

      const user = await this.prisma.user.findFirstOrThrow({
        where: { privyId: userId },
      });

      return user;
    } catch (error: unknown) {
      console.log(error);
      if (error instanceof AuthException) {
        throw error;
      }

      throw new AuthException(
        'The provided credentials are invalid. Please verify your email and password and try again.',
      );
    }
  }

  public async loginWithPrivy(
    loginWithPrivyDto: LoginWithPrivyDto,
    sessionId?: string,
  ) {
    //todo define types Promise<LoginResponse>
    try {
      const { privyAccessToken } = loginWithPrivyDto;
      console.log('logiiin  ' + privyAccessToken);

      const { privyId } = await this.validateUserByPrivyAccessToken(privyAccessToken);
      console.log('privyyy ' + privyId);

      const user = await this.prisma.user.findFirstOrThrow({
        where: { privyId },
        include: {
          reports: true,
          organizations: {
            include: {
              organization: {
                include: {
                  reports: true,
                  users: true,
                }
              },
            },
          },
          session: true
        },
        omit: { privyId: true },
      });

      const accessToken = await this.generateJwtTokenPrivy(user);

      const newSessionId = sessionId || crypto.randomUUID();

      await this.prisma.session.upsert({
        where: { userId: user.id },
        update: {
          sessionId,
          expiresAt: new Date(
            Date.now() +
              Number(this.configService.get('SESSION_MAX_AGE') || 86400000),
          ),
        },
        create: {
          userId: user.id,
          sessionId: newSessionId,
          expiresAt: new Date(
            Date.now() +
              Number(this.configService.get('SESSION_MAX_AGE') || 86400000),
          ),
        },
      });
      return { ...user, accessToken };
    } catch (error) {
      console.log('error');
      if (error instanceof AuthException) {
        throw error;
      }
      throw new AuthException(
        'Cannot authorize the user with provided credentials.',
      );
    }
  }

  public async registerWithPrivy(
    userCreateDto: UserCreateDto,
    sessionId?: string,
  ) {
    //todo add Promise<RegisterResponse>
    try {
      console.log('register  ' + userCreateDto.privyAccessToken);

      const user = await this.userService.create(userCreateDto);

      const newSessionId = sessionId || crypto.randomUUID();

      await this.prisma.session.upsert({
        where: { userId: user.id },
        update: {
          sessionId,
          expiresAt: new Date(
            Date.now() +
              Number(this.configService.get('SESSION_MAX_AGE') || 86400000),
          ),
        },
        create: {
          userId: user.id,
          sessionId: newSessionId,
          expiresAt: new Date(
            Date.now() +
              Number(this.configService.get('SESSION_MAX_AGE') || 86400000),
          ),
        },
      });

      const accessToken = await this.generateJwtTokenPrivy(user);

      return { ...user, accessToken };
    } catch (error) {
      console.log(error);
      if (error instanceof AuthException) {
        throw error;
      }

      throw new AuthException(
        'Cannot register the user via Privy with provided data.',
      );
    }
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId } });
  }

}
