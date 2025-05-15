import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infrastracture/prisma/prisma.service';
import { OrganizationCreateDto, OrganizationUpdateDto } from './dto/organization.dto';
import { PrivyService } from 'src/infrastracture/privy/privy.service';

@Injectable()
export class OrganizationService {
  constructor() {}
  @Inject()
  private readonly prisma: PrismaService;
  @Inject()
  private privyService: PrivyService;

  async create(data: OrganizationCreateDto, userId: string) {
    // Step 1: Create the organization with the founder and connect the user
    const organization = await this.prisma.organization.create({
      data: {
        name: data.name,
        founderId: userId,
        users: {
          create: {
            user: {
              connect: { id: userId },
            },
          },
        },
      },
      include: {
        users: {
          include: {
            user: true,
          },
        },
        founder: true,
      },
    });

    // Step 2: Check if the organization already has a wallet
    if (organization.wallet) {
      return {
        ...organization,
        wallet: organization.wallet,
      };
    }

    // Step 3: Fetch the founder's privyId
    const founder = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { privyId: true },
    });

    if (!founder?.privyId) {
      throw new NotFoundException('Founder Privy ID not found');
    }

    // Step 4: Create a Solana wallet using Privy's client
    const walletResponse = await this.privyService.client.createWallets({
      userId: founder.privyId,
      createEthereumWallet: false,
      createSolanaWallet: true,
      createEthereumSmartWallet: false,
    });

    // Step 5: Extract the Solana wallet address
    // const solanaWallet = walletResponse.wallet..find(
    //   (wallet) => wallet.chain === 'solana',
    // );

    // if (!solanaWallet) {
    //   throw new Error('Failed to create Solana wallet');
    // }

    const walletAddress = walletResponse.wallet?.address;

    // Step 6: Update the organization with the wallet address
    const updatedOrganization = await this.prisma.organization.update({
      where: { id: organization.id },
      data: {
        wallet: walletAddress,
      },
      include: {
        users: {
          include: {
            user: true,
          },
        },
        founder: true,
      },
    });

    return updatedOrganization;
  }

  async update(id: string, data: OrganizationUpdateDto, userId: string) {
    console.log(data);
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: { users: true }, // includes UserOrganization[]
    });
  
    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }
  
    const updateData: any = {
      ...(data.name && { name: data.name }),
    };

    if (userId !== organization.founderId) {
      throw new BadRequestException('Only founder can update organization.');
    }
  
    if (!data.userIds || data.userIds.length === 0) {
      throw new BadRequestException('At least one user must be assigned to the organization.');
    }
  
    // Validate that all provided user IDs exist
    const validUsers = await this.prisma.user.findMany({
      where: { id: { in: data.userIds } },
      select: { id: true },
    });
  
    if (validUsers.length !== data.userIds.length) {
      throw new BadRequestException('One or more user IDs are invalid.');
    }
  
    // Ensure founder is always included
    if (!data.userIds.includes(organization.founderId)) {
      data.userIds.push(organization.founderId);
    }
  
    return this.prisma.$transaction(async (prisma) => {
      if (!data.userIds || data.userIds.length === 0) {
        throw new BadRequestException('At least one user must be assigned to the organization.');
      }

      // Remove all existing UserOrganization connections for this org
      await prisma.userOrganization.deleteMany({
        where: { organizationId: id },
      });

      // Re-create all connections
      await prisma.userOrganization.createMany({
        data: data.userIds.map((userId) => ({
          userId,
          organizationId: id,
        })),
        skipDuplicates: true,
      });
  
      const organization = await prisma.organization.update({
        where: { id },
        data: updateData,
        include: {
          users: {
            include: {
              user: true,
            },
          },
        },
      });

      // Transform organizations to include only user objects in users array
    const organizationWithUsers = {
      ...organization,
      users: organization.users.map(uo => uo.user)
    };

    return organizationWithUsers;
    });
  }

  async remove(id: string) {
    console.log(id);
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: { reports: true }, // Include reports to check if any exist
    });

    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }

    if (organization.reports.length > 0) {
      throw new BadRequestException('Cannot delete organization with associated reports.');
    }

    // Delete all UserOrganization records associated with this organization
    await this.prisma.userOrganization.deleteMany({
      where: { organizationId: id },
    });

    return this.prisma.organization.delete({
      where: { id },
    });
  }

  async findAll() {
    return this.prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        founderId: true,
        founder: true,
      },
    });
  }

  async findOne(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }

    return organization;
  }
}