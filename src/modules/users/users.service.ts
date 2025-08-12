
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infrastracture/prisma/prisma.service';
import { UserCreateDto, UserUpdateDto } from './dto/users.dto';
import { User } from '@prisma/client';
import { FileService } from '../../infrastracture/file-manager/file.service';
import { nanoid } from 'nanoid';
import { PrivyService } from 'src/infrastracture/privy/privy.service';
import { OrganizationService } from '../organization/organization.service';

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
    @Inject()
    private organizationService: OrganizationService;

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
  
    const newUser = await this.prisma.user.create({
      data: {
        privyId: userId,
        email: email || `${nanoid()}@example.com`,
        name: data.name || 'New User',
        role: data.role,
        submissionQuatity: 0,
        jobTitle: data.jobTitle,
        photo: data.photo,
        // organizationId is initially null and will be updated if needed
      },
    });

    if (data.role === 'DataConsumer') {
      // Create a default organization for this data consumer
      const newOrganization = await this.organizationService.create(
        {
          name: `${newUser.name}'s Data Consumer Organization.`,
          sphere: 'Analytics',
        },
        newUser.id, // Use the new user's ID as the founder
      );
      // Update the user to link them to their new organization
      await this.prisma.user.update({
        where: { id: newUser.id },
        data: { organizationId: newOrganization.id },
      });
    }

    if (data.role === 'GovBody') {
      // Create a default organization for this government user
      const newOrganization = await this.organizationService.create(
        {
          name: `${newUser.name}'s Government Department`,
          sphere: 'Government',
        },
        newUser.id, // Use the new user's ID as the founder
      );

      // Update the user to link them to their new organization
      await this.prisma.user.update({
        where: { id: newUser.id },
        data: { organizationId: newOrganization.id },
      });

      // --- Step 4: Share all existing reports with this new GovBody organization ---
      const allReports = await this.prisma.report.findMany({
        select: { id: true, organizationId: true },
      });

      if (allReports.length > 0) {
        const sharesToCreate = allReports.map(report => ({
          reportId: report.id,
          sourceOrgId: report.organizationId,
          targetOrgId: newOrganization.id,
          sharedAt: new Date(),
          acceptedShare: true, // Auto-accepted for government bodies
        }));

        await this.prisma.sharedReportsWithOrganizations.createMany({
          data: sharesToCreate,
          skipDuplicates: true,
        });
      }
    }

    // Return the newly created user
    return this.prisma.user.findUniqueOrThrow({ where: { id: newUser.id } });
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