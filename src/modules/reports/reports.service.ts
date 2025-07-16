import { Injectable, ForbiddenException, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from 'src/infrastracture/prisma/prisma.service';
import { ReportCreateDto, ReportUpdateDto } from './dto/report.dto';
import { Report } from 'src/core/types/all.types';
import { NGSIService } from '../ngsi/ngsi.service';
import { BlockchainService } from './blockchain.service';

@Injectable()
export class ReportService {
  @Inject()
  private readonly prisma: PrismaService;
  @Inject()
  private readonly ngsiService: NGSIService;
  @Inject()
  private readonly blockchainService: BlockchainService;

  constructor() {}

  async create(dto: ReportCreateDto, userId: string) {
    const created = await this.prisma.report.create({
      data: { ...dto, authorId: userId },
    });
    const reportId = `urn:ngsi-ld:Report:${created.id}`;
    const ngsiPayload = {
      id: reportId,
      type: 'Report',
      title: { type: 'Property', value: created.title },
      description: { type: 'Property', value: created.description },
      typeOfThreat: { type: 'Property', value: created.typeOfThreat },
      status: { type: 'Property', value: created.status },
      severity: { type: 'Property', value: created.severity },
      stix: { type: 'Property', value: created.stix },
      riskScore: created.riskScore ? { type: 'Property', value: created.riskScore } : undefined,
      organization: { type: 'Relationship', object: `urn:ngsi-ld:Organization:${created.organizationId}` },
      author: { type: 'Relationship', object: `urn:ngsi-ld:User:${userId}` },
      ...(created.blockchainHash && { blockchainHash: { type: 'Property', value: created.blockchainHash } }),
    };
    // Remove undefined values
    Object.keys(ngsiPayload).forEach(key => ngsiPayload[key] === undefined && delete ngsiPayload[key]);
    await this.ngsiService.createEntity(ngsiPayload).toPromise();
    return created;
  }

  async update(id: string, userId: string, dto: ReportUpdateDto) {
    const existing = await this.prisma.report.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Report not found');

    const reportId = `urn:ngsi-ld:Report:${id}`;
    // Check if report exists
    const reportExists = await this.ngsiService.checkEntityExists(reportId);
    if (!reportExists) {
      throw new NotFoundException(`Report with id ${id} not found`);
    }

    const isAuthor = existing.authorId === userId;
    if (!isAuthor) throw new ForbiddenException('Access denied');

    const updated = await this.prisma.report.update({
      where: { id },
      data: dto,
    });

    const attrs: any = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        attrs[key] = { type: 'Property', value };
      }
    }

    if (dto.organizationId) {
      attrs.organization = { type: 'Relationship', object: `urn:ngsi-ld:Organization:${dto.organizationId}` };
    }
    if (dto.authorId) {
      attrs.author = { type: 'Relationship', object: `urn:ngsi-ld:User:${dto.authorId}` };
    }

    await this.ngsiService.updateEntity(`urn:ngsi-ld:Report:${id}`, attrs);
    return updated;
  }

  async remove(id: string, userId: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    const reportId = `urn:ngsi-ld:Report:${id}`;
    // Check if report exists
    const reportExists = await this.ngsiService.checkEntityExists(reportId);
    if (!reportExists) {
      throw new NotFoundException(`Report with id ${id} not found`);
    }
    if (report.authorId !== userId) throw new ForbiddenException('Only author can delete');
    // Delete the report and associated records in a transaction
    await this.prisma.$transaction([
      // Delete related SharedReportsWithOrganizations records
      this.prisma.sharedReportsWithOrganizations.deleteMany({
        where: { reportId: id },
      }),
      // Delete related NotificationReport records
      this.prisma.notificationReport.deleteMany({
        where: { reportId: id },
      }),
      // Delete the report itself
      this.prisma.report.delete({
        where: { id },
      }),
    ]);
    // Delete the report entity from context broker
    await this.ngsiService.deleteEntity(reportId);
    return report;
  }

  async getUserReports(userId: string): Promise<Report[]> {
    // Find all organizations the user is part of
    const userOrganizations = await this.prisma.userOrganization.findMany({
      where: { userId },
      select: { organizationId: true },
    });

    const organizationIds = userOrganizations.map((uo) => uo.organizationId);
    // Initialize reports array
    let reports: Report[] = [];
    // Fetch reports from user's organizations (if any)
    if (organizationIds.length > 0) {
      const ownReports = await this.prisma.report.findMany({
        where: {
          organizationId: {
            in: organizationIds,
          },
        },
        select: {
          id: true, title: true, description: true, attachments: true, typeOfThreat: true,
          status: true, severity: true, submittedAt: true, submitted: true,
          stix: true, blockchainHash: true,riskScore: true, emailsToShare: true,
          author: {
            select: { id: true, name: true, email: true,},
          },
          organization: {
            select: { id: true, name: true, },
          },
          sharedReports: {
            select: { sourceOrgId: true, blockchainHash: true, targetOrgId: true, acceptedShare: true,
            },
          },
        },
      });
      // Map to include sharedWith
      reports = ownReports.map((report) => ({
        ...report,
        sharedWith: report.sharedReports.map((share) => ({
          sourceOrgId: share.sourceOrgId,
          targetOrgId: share.targetOrgId,
          acceptedShare: share.acceptedShare,
          blockchainHash: share.blockchainHash,
        })),
      }));
    }
    // Fetch reports shared with the user's organizations
    const sharedReports = await this.prisma.sharedReportsWithOrganizations.findMany({
      where: {
        targetOrgId: {
          in: organizationIds,
        },
        // Include all shares (accepted or not) for completeness
      },
      select: { 
        sourceOrgId: true, targetOrgId: true, acceptedShare: true, blockchainHash: true,
        report: {
          select: {
            id: true, title: true, description: true, attachments: true, typeOfThreat: true, 
            status: true, severity: true, submittedAt: true, submitted: true, stix: true, 
            blockchainHash: true, riskScore: true, emailsToShare: true,
            author: {
              select: { id: true, name: true, email: true, },
            },
            organization: {
              select: { id: true, name: true, },
            },
            sharedReports: {
              select: { sourceOrgId: true, targetOrgId: true, acceptedShare: true, blockchainHash: true },
            },
          },
        },
      },
    });
    // Combine own reports and shared reports
    const allReports = [
      ...reports,
      ...sharedReports.map((shared) => ({
        ...shared.report,
        sharedWith: shared.report.sharedReports.map((share) => ({
          sourceOrgId: share.sourceOrgId,
          targetOrgId: share.targetOrgId,
          acceptedShare: share.acceptedShare,
          blockchainHash: share.blockchainHash
        })),
      })),
    ];
    // Remove duplicates (in case a report is both owned and shared)
    const uniqueReports = Array.from(
      new Map(allReports.map((report) => [report.id, report])).values()
    );
    // Sort by submittedAt (descending)
    uniqueReports.sort((a, b) => {
      const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return dateB - dateA;
    });

    return uniqueReports;
  }

  async shareReport(reportId: string, sourceOrgId: string, targetOrgId: string, userId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { authorId: true,
        organizationId: true,
        title: true, 
        description: true, 
        organization: true,
        typeOfThreat: true, 
        severity: true, 
        status: true, 
        collectionAddress: true,
        collectionPrivateKey: true
      },
    });
    if (!report) throw new NotFoundException('Report not found');
    if (!report.collectionPrivateKey || !report.collectionAddress) throw new NotFoundException('Report was not submitted.');
    // Fetch the user's organizations
    const userOrganizations = await this.prisma.userOrganization.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    // Check if the report's organizationId is in the user's organizations
    const userOrgIds = userOrganizations.map((uo) => uo.organizationId);
    if (!userOrgIds.includes(report.organizationId)) {
      throw new ForbiddenException('User is not a member of the report’s organization');
    }
    // Verify sourceOrgId matches report's organization
    if (report.organizationId !== sourceOrgId) {
      throw new ForbiddenException('Source organization does not match the report’s organization');
    }
    // Verify target organization exists
    const targetOrg = await this.prisma.organization.findUnique({ where: { id: targetOrgId } });
    if (!targetOrg) throw new NotFoundException('Target organization not found');
    if (!report.organization.wallet || !targetOrg.wallet) throw new Error('Organization wallet not found');
    // Generate share index (increment based on existing shares)
    const existingShares = await this.prisma.sharedReportsWithOrganizations.findMany({
      where: { reportId },
    });
    const shareIndex = existingShares.length + 1;

    const { isNewCollection, blockchainHash, collectionAddress, collectionPrivateKey, nftPrivateKey } = await this.blockchainService.shareReportOnBlockchain(
      reportId,
      shareIndex,
      report.title,
      report.description,
      report.organization.wallet,
      targetOrg.wallet,
      report.collectionPrivateKey,
      report.collectionAddress,
      report.organization.name,
      targetOrg.name,
      report.typeOfThreat,
      report.severity,
      report.status
    );

    // If new collection was generated, update report with collectionAddress and collectionPrivateKey
    if (isNewCollection) {
      await this.prisma.report.update({
        where: { id: reportId },
        data: { collectionAddress, collectionPrivateKey },
      });
    }

    // Create share record with blockchainHash
    await this.prisma.sharedReportsWithOrganizations.create({
      data: {
        reportId,
        sourceOrgId,
        targetOrgId,
        sharedAt: new Date(),
        acceptedShare: false,
        blockchainHash,
        nftPrivateKey,
      },
    });
    // Fetch updated report
  const updatedReport = await this.prisma.report.findUnique({
    where: { id: reportId },
    include: {
      author: {
        select: { id: true, privyId: true, role: true, name: true, 
        email: true, submissionQuatity: true, organizationId: true, 
        photo: true, jobTitle: true,
        },
      },
      organization: {
        select: { id: true, name: true, wallet: true, founderId: true, },
      },
      sharedReports: {
        select: { sourceOrgId: true, targetOrgId: true, acceptedShare: true, blockchainHash: true, },
      },
    },
  })
  const reportWithShared = {
    ...updatedReport,
    sharedWith: updatedReport?.sharedReports.map((share) => ({
      sourceOrgId: share.sourceOrgId,
      targetOrgId: share.targetOrgId,
      acceptedShare: share.acceptedShare,
      blockchainHash: share.blockchainHash,
    })),
  };

  return reportWithShared;
  }

  async revokeShare(reportId: string, sourceOrgId: string, targetOrgId: string, userId: string) {
    // Check if the report exists and get its authorId and organizationId
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { authorId: true, organizationId: true, collectionAddress: true,collectionPrivateKey: true  },
    });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    if (!report.collectionPrivateKey || !report.collectionAddress) throw new NotFoundException('Report was not submitted.');
    // Verify sourceOrgId matches the report's organizationId
    if (report.organizationId !== sourceOrgId) {
      throw new ForbiddenException('Source organization does not match the report’s organization');
    }
    // Fetch the user's organizations
    const userOrganizations = await this.prisma.userOrganization.findMany({
      where: { userId },
      select: { organizationId: true},
    });
    // Check if the report's organizationId is in the user's organizations
    const userOrgIds = userOrganizations.map((uo) => uo.organizationId);
    if (!userOrgIds.includes(report.organizationId)) {
      throw new ForbiddenException('User is not a member of the report’s organization');
    }
    // Check if the share exists
    const share = await this.prisma.sharedReportsWithOrganizations.findUnique({
      where: {
        sourceOrgId_targetOrgId_reportId: {
          reportId,
          sourceOrgId,
          targetOrgId,
        },
      },
    });
    if (!share) {
      throw new NotFoundException('Share not found');
    }
    if (!share.nftPrivateKey || !share.blockchainHash) {
      throw new NotFoundException('Report share was not submitted');
    }
    // Verify target organization
    const targetOrg = await this.prisma.organization.findUnique({
      where: { id: targetOrgId },
    });
    if (!targetOrg) throw new NotFoundException('Target organization not found');
    if (!targetOrg.wallet) throw new Error('Target organization wallet not found');
    // Get share index (assume sequential from 1, or derive from share order)
    const existingShares = await this.prisma.sharedReportsWithOrganizations.findMany({
      where: { reportId },
      orderBy: { sharedAt: 'asc' },
    });
    const shareIndex = existingShares.findIndex(
      (s) => s.sourceOrgId === sourceOrgId && s.targetOrgId === targetOrgId && s.reportId === reportId
    ) + 1;

    if (shareIndex === 0) {
      throw new NotFoundException('Share index not found');
    }

    await this.blockchainService.revokeShareOnBlockchain(
      reportId,
      shareIndex,
      report.collectionPrivateKey,
      report.collectionAddress,
      share.nftPrivateKey,
      share.blockchainHash,
      targetOrg.wallet
    );

    // Delete the share record
    await this.prisma.sharedReportsWithOrganizations.delete({
      where: {
        sourceOrgId_targetOrgId_reportId: {
          reportId,
          sourceOrgId,
          targetOrgId,
        },
      },
    });

     // Fetch updated report
      const updatedReport = await this.prisma.report.findUnique({
        where: { id: reportId },
        include: {
          author: {
            select: { id: true, privyId: true, role: true, name: true, email: true, 
            submissionQuatity: true, organizationId: true, photo: true, jobTitle: true,
            },
          },
          organization: {
            select: { id: true, name: true, wallet: true, founderId: true, },
          },
          sharedReports: {
            select: { sourceOrgId: true, targetOrgId: true, acceptedShare: true, blockchainHash: true, },
          },
        },
      })

      const reportWithShared = {
        ...updatedReport,
        sharedWith: updatedReport?.sharedReports.map((share) => ({
          sourceOrgId: share.sourceOrgId,
          targetOrgId: share.targetOrgId,
          acceptedShare: share.acceptedShare,
          blockchainHash: share.blockchainHash,
        })),
      };

      return reportWithShared;
  }

  async acceptShare(reportId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.organizationId) {
      throw new NotFoundException('User or organization not found');
    }
    const sharedRecord = await this.prisma.sharedReportsWithOrganizations.findUnique({
      where: {
        sourceOrgId_targetOrgId_reportId: {
          reportId,
          targetOrgId: user.organizationId,
          sourceOrgId: undefined as any, // We'll find it below
        },
      },
    });
    if (!sharedRecord) {
      throw new NotFoundException('Shared report not found for your organization');
    }
    // Use composite key with proper sourceOrgId
    return this.prisma.sharedReportsWithOrganizations.update({
      where: {
        sourceOrgId_targetOrgId_reportId: {
          reportId,
          targetOrgId: user.organizationId,
          sourceOrgId: sharedRecord.sourceOrgId,
        },
      },
      data: {
        acceptedShare: true,
      },
    });
  }

  async submitReport(id: string, userId: string) {
   // Fetch report and verify existence
   const report = await this.prisma.report.findUniqueOrThrow({
    where: { id },
    include: {
      author: true,
      organization: true,
      sharedReports: {
        select: { sourceOrgId: true, targetOrgId: true, acceptedShare: true, blockchainHash: true, },
      },
    },
  });
  if (!report) {
    throw new NotFoundException('Report not found.');
  }
  // Verify user permissions
  const userOrganizations = await this.prisma.userOrganization.findMany({
    where: { userId },
    select: { organizationId: true },
  });
  const userOrgIds = userOrganizations.map((uo) => uo.organizationId);
  if (!userOrgIds.includes(report.organizationId)) {
    throw new ForbiddenException('User is not a member of the report’s organization');
  }
  // Verify organization wallet
  if (!report.organization.wallet) {
    throw new Error('Organization wallet not found');
  }

  const { isNewCollection, collectionAddress, collectionPrivateKey, blockchainHash } = await this.blockchainService.createReportOnBlockchain(
    id,
    report.title,
    report.description,
    report.organization.wallet,
    report.collectionPrivateKey ?? undefined,
    report.collectionAddress ?? undefined,
    report.organization.name,
    report.typeOfThreat,
    report.severity,
    report.status
  );

  // If new collection was generated, update report with collectionAddress and collectionPrivateKey
  if (isNewCollection) {
    await this.prisma.report.update({
      where: { id },
      data: {
        collectionAddress: collectionAddress,
        collectionPrivateKey: collectionPrivateKey,
      },
    });
  }

  // Step 7: Update report in Prisma
  const updatedReport = await this.prisma.report.update({
    where: { id },
    data: {
      blockchainHash: blockchainHash,
      submittedAt: new Date(),
      submitted: true,
    },
    include: {
      author: {
        select: { 
          id: true, privyId: true, role: true, name: true, email: true, 
          submissionQuatity: true, organizationId: true, photo: true, jobTitle: true,
        },
      },
      organization: {
        select: { id: true, name: true, wallet: true, founderId: true, },
      },
      sharedReports: {
        select: { sourceOrgId: true, targetOrgId: true, acceptedShare: true, blockchainHash: true, },
      },
    },
  });

  // Map sharedReports to sharedWith
  const reportWithShared = {
    ...updatedReport,
    sharedWith: updatedReport.sharedReports.map((share) => ({
      sourceOrgId: share.sourceOrgId,
      targetOrgId: share.targetOrgId,
      acceptedShare: share.acceptedShare,
      blockchainHash: share.blockchainHash,
    })),
  };

  return reportWithShared;
  }
}