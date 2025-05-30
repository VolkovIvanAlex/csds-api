
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infrastracture/prisma/prisma.service';
import { UserCreateDto, UserUpdateDto } from './dto/users.dto';
import { User } from '@prisma/client';
import { FileService } from '../../infrastracture/file-manager/file.service';
import { nanoid } from 'nanoid';
import { PrivyService } from 'src/infrastracture/privy/privy.service';

@Injectable()
export class UserService {
  constructor(
    ) {}
    @Inject()
    private prisma: PrismaService;
    @Inject()
    private fileService: FileService;
    @Inject()
    private privyService: PrivyService;

  async findMany(): Promise<User[]> {
    return this.prisma.user.findMany();
  }

  async userExists(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { 
        OR: [
          {email: email},
        ] 
      },
    });

    return user != null;
  }

  // async findOne(options: FindUserDto): Promise<User> {
  //   const user = await this.prisma.user.findFirst({
  //     where: options,
  //     include: {
  //       reports: true,
  //       session: true,
  //       organization: true,
  //     },
  //   });
  //   if (!user) {
  //     throw new NotFoundException('The user with such id was not found.');
  //   }
  //   return user;
  // }

  async create(userCreateDto: UserCreateDto): Promise<User> {
    const { privyAccessToken, ...data } = userCreateDto;
  
    const { userId } = await this.privyService.client.verifyAuthToken(privyAccessToken);
    console.log("userId - ", userId);
    const { linkedAccounts } = await this.privyService.client.getUserById(userId);
  
    const accountWithName: any = linkedAccounts?.find((account: any) =>
      account?.name?.trim(),
    );
  
    const accountWithEmail: any = linkedAccounts?.find(
      (account: any) => account?.email?.trim()
    ) || linkedAccounts?.find(
      (account: any) => account?.type === 'email' && account?.address?.trim()
    );
  
    const [privyFirstName, privyLastName] = (accountWithName?.name || '').split(' ');
    const email = accountWithEmail?.email || accountWithEmail?.address;
  
    const userData = {
      privyId: userId,
      email: email || `${nanoid()}@example.com`,
      name: data.name || [privyFirstName, privyLastName].filter(Boolean).join(' ') || 'Name',
      role: data.role,
      submissionQuatity: data.submissionQuatity ?? 0,
      organizationId: data.organizationId || null, // Safe for optional org
      photo: data.photo,
      jobTitle: data.jobTitle,
    };
  
    return this.prisma.user.create({ data: userData });
  }

  async update(id: string, data: UserUpdateDto, files?: Express.Multer.File[]): Promise<User> {
    // Verify user exists
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('The user with such id was not found.');
    }
  
    const updateData: any = { ...data };
  
    // Handle avatar upload via file
    if (files && files.length > 0) {
      const link = await this.fileService.uploadPhotoToPinata(files);
      updateData.photo = link.hash;
    } else if (data.photo === '' || data.photo === undefined) {
      updateData.photo = ''; // Remove avatar if explicitly requested
    }
  
    return this.prisma.user.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('The user with such id was not found.');
    }
    return this.prisma.user.delete({ where: { id } });
  }

  async getUserOrganizations(userId: string){
    const organizations = await this.prisma.organization.findMany({
        where: {
            users: {
                some: {
                    userId: userId
                }
            }
        },
        include: {
            founder: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    jobTitle: true,
                    photo: true
                }
            },
            reports: true,
            users: {
                include: {
                    user: true
                }
            }
        }
    });

    // Transform organizations to include only user objects in users array
    const organizationsWithUsers = organizations.map(org => ({
      ...org,
      users: org.users.map(uo => uo.user)
    }));

    return organizationsWithUsers;
  };
}