import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infrastracture/prisma/prisma.service';
import { ReportCreateDto, ReportUpdateDto } from './dto/report.dto';
import { Report } from 'src/core/types/all.types';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey, Keypair, SystemProgram, ComputeBudgetProgram } from '@solana/web3.js';
import { PinataSDK } from 'pinata-web3';
import { Csds } from 'src/core/types/csds';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Encryption key (store securely in .env or KMS)
const ENCRYPTION_KEY = Buffer.from(
  process.env.ENCRYPTION_KEY || '', // 64 hex chars = 32 bytes
  'hex'
);
const IV_LENGTH = 16; // AES-256-CBC IV length


@Injectable()
export class ReportService {
  private readonly pinata: PinataSDK;
  private readonly program: anchor.Program<Csds>;
  private readonly provider: anchor.AnchorProvider;
  private readonly adminWalletKeypair: Keypair;

  constructor(private readonly prisma: PrismaService) {
    // Initialize Pinata
    this.pinata = new PinataSDK({
      pinataJwt: process.env.PINATA_JWT || '',
      pinataGateway: process.env.PINATA_GATEWAY || '',
    });

    // Initialize Solana provider and program
    const connection = new anchor.web3.Connection(process.env.SOLANA_CONNECTION || '');
    this.adminWalletKeypair = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(process.env.SOLANA_WALLET_SECRET_KEY || '[]'))
    );
    const wallet = new anchor.Wallet(this.adminWalletKeypair);
    this.provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
    anchor.setProvider(this.provider);
    // Load IDL explicitly
    const idl = require('../../../csds_contracts/target/idl/csds.json');
    this.program = new anchor.Program(
      idl,
      new PublicKey(process.env.SMART_CONTRACT_ADDRESS || ''),
      this.provider
    );

    // Verify payer exists
    if (!this.adminWalletKeypair) {
      throw new Error('Provider wallet payer is undefined');
    }
  }

  async create(dto: ReportCreateDto, userId: string) {
    return this.prisma.report.create({
      data: {
        ...dto,
        authorId: userId 
      }
    });
  }

  async update(id: string, userId: string, dto: ReportUpdateDto) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        sharedReports: { include: { targetOrg: true } },
        author: true,
      },
    });

    if (!report) throw new NotFoundException('Report not found');

    const isAuthor = report.authorId === userId;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    // const isSharedWithOrg = report.sharedReports.some(
    //   (s) => s.targetOrg.id === user?.organizationId,
    // );

    if (!isAuthor) throw new ForbiddenException('Access denied');

    return this.prisma.report.update({ where: { id }, data: dto });
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
          id: true,
          title: true,
          description: true,
          attachments: true,
          typeOfThreat: true,
          status: true,
          severity: true,
          submittedAt: true,
          submitted: true,
          stix: true,
          blockchainHash: true,
          riskScore: true,
          emailsToShare: true,
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          sharedReports: {
            select: {
              sourceOrgId: true,
              blockchainHash: true,
              targetOrgId: true,
              acceptedShare: true,
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
        sourceOrgId: true,
        targetOrgId: true,
        acceptedShare: true,
        blockchainHash: true,
        report: {
          select: {
            id: true,
            title: true,
            description: true,
            attachments: true,
            typeOfThreat: true,
            status: true,
            severity: true,
            submittedAt: true,
            submitted: true,
            stix: true,
            blockchainHash: true,
            riskScore: true,
            emailsToShare: true,
            author: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
            sharedReports: {
              select: {
                sourceOrgId: true,
                targetOrgId: true,
                acceptedShare: true,
                blockchainHash: true
              },
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

  async remove(id: string, userId: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
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
    return report;
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
    const targetOrg = await this.prisma.organization.findUnique({
      where: { id: targetOrgId },
    });
    if (!targetOrg) throw new NotFoundException('Target organization not found');

    // Determine collection account
    let collectionPubkey: PublicKey;
    let collection: Keypair;
    let isNewCollection = false;
    if (report.collectionPrivateKey && report.collectionAddress) {
      try {
        const privateKey = this.decryptPrivateKey(report.collectionPrivateKey);
        collection = Keypair.fromSecretKey(privateKey);
        collectionPubkey = new PublicKey(report.collectionAddress);
        if (!collection.publicKey.equals(collectionPubkey)) {
          throw new Error('Collection public key does not match collection address');
        }
      } catch (e) {
        throw new ForbiddenException(`Invalid collection private key: ${e.message}`);
      }
    } else {
      collection = Keypair.generate();
      collectionPubkey = collection.publicKey;
      isNewCollection = true;
    }

    if (!report.organization.wallet) {
      throw new Error('Organization wallet not found');
    }

    // Generate metadata (aligned with submitReport)
    const metadata = {
      name: report.title,
      symbol: 'RPT_SHARE',
      description: `Shared report: ${report.description}`,
      image: process.env.REPORT_IMAGE_URL || 'https://bafybeid2v2un5eziph75p4h2l3pykxnlrgde5gu6blzxs2nun5sryutmpe.ipfs.dweb.link/',
      animation_url: 'https://bafybeihvydpbj2h7qabs6fbklwnbt2ltbrekvjpqupquvizubm4xeb5nam.ipfs.dweb.link/',
      external_url: 'https://csds.com',
      attributes: [
        { trait_type: 'ReportId', value: reportId },
        { trait_type: 'Creator', value: report.organization.wallet || this.provider.wallet.publicKey.toBase58() },
        { trait_type: 'Shared With', value: targetOrg.name },
        { trait_type: 'Author Organization', value: report.organization.name },
        { trait_type: 'Type of Threat', value: report.typeOfThreat },
        { trait_type: 'Severity', value: report.severity },
        { trait_type: 'Status', value: report.status },
        { trait_type: 'Shared At', value: new Date().toISOString() },
      ],
      properties: {
        files: [
          {
            uri: 'https://bafybeid2v2un5eziph75p4h2l3pykxnlrgde5gu6blzxs2nun5sryutmpe.ipfs.dweb.link/',
            type: 'image/png',
          },
          {
            uri: 'https://bafybeihvydpbj2h7qabs6fbklwnbt2ltbrekvjpqupquvizubm4xeb5nam.ipfs.dweb.link/',
            type: 'video/mp4',
          },
        ],
        category: 'image',
      },
    };

    // Upload metadata to IPFS
    const metadataUpload = await this.pinata.upload.json(metadata);
    const metadataUri = `https://${metadataUpload.IpfsHash}.ipfs.dweb.link/`;
    console.log(metadataUri);

    // Hash UUID to numeric ID
    const hashUuid = (uuid: string) => {
      let hash = 0;
      for (let i = 0; i < uuid.length; i++) {
        hash = (hash << 5) - hash + uuid.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash);
    };
    const reportIdNum = hashUuid(reportId);

    // Generate share index (increment based on existing shares)
    const existingShares = await this.prisma.sharedReportsWithOrganizations.findMany({
      where: { reportId },
    });
    const shareIndex = existingShares.length + 1;

    // Derive PDAs
    const [reportCollectionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('report_collection'),
        this.provider.wallet.publicKey.toBuffer(),
        new anchor.BN(reportIdNum).toArrayLike(Buffer, 'le', 8),
      ],
      this.program.programId
    );

    const [shareNftPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('share_nft'),
        this.provider.wallet.publicKey.toBuffer(),
        new anchor.BN(reportIdNum).toArrayLike(Buffer, 'le', 8),
        new anchor.BN(shareIndex).toArrayLike(Buffer, 'le', 8),
      ],
      this.program.programId
    );

    // Generate share NFT keypair
    const shareNft = Keypair.generate();

    // Add priority fee
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 });
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 });

    try {
      const tx = await this.program.methods
        .shareReport(
          new anchor.BN(reportIdNum),
          report.title,
          new anchor.BN(shareIndex),
          metadataUri
        )
        .accounts({
          reportCollection: reportCollectionPda,
          shareData: shareNftPda,
          collection: collectionPubkey,
          shareNft: shareNft.publicKey,
          creator: this.provider.wallet.publicKey,
          sharedOrg: new PublicKey(targetOrg.wallet!),
          systemProgram: SystemProgram.programId,
          mplCoreProgram: new PublicKey(process.env.MPL_CORE_PROGRAM_ID || ''),
        })
        .signers([this.adminWalletKeypair, collection, shareNft])
        .transaction();

      tx.add(modifyComputeUnits);
      tx.add(addPriorityFee);

      const signature = await this.provider.sendAndConfirm(tx, [this.adminWalletKeypair, collection, shareNft], {
        commitment: 'confirmed',
        maxRetries: 3,
      });

      console.log(`Share transaction confirmed: ${signature}`);
    } catch (error) {
      console.error('Share transaction failed:', error);
      throw new Error(`Failed to share report on Solana: ${error.message}`);
    }

    // If new collection was generated, update report with collectionAddress and collectionPrivateKey
    if (isNewCollection) {
      await this.prisma.report.update({
        where: { id: reportId },
        data: {
          collectionAddress: collectionPubkey.toBase58(),
          collectionPrivateKey: this.encryptPrivateKey(collection.secretKey),
        },
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
        blockchainHash: shareNft.publicKey.toBase58(),
        nftPrivateKey: this.encryptPrivateKey(shareNft.secretKey),
      },
    });

    // Fetch updated report
  const updatedReport = await this.prisma.report.findUnique({
    where: { id: reportId },
    include: {
      author: {
        select: {
          id: true,
          privyId: true,
          role: true,
          name: true,
          email: true,
          submissionQuatity: true,
          organizationId: true,
          photo: true,
          jobTitle: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          wallet: true,
          founderId: true,
        },
      },
      sharedReports: {
        select: {
          sourceOrgId: true,
          targetOrgId: true,
          acceptedShare: true,
          blockchainHash: true,
        },
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

    // Verify target organization
    const targetOrg = await this.prisma.organization.findUnique({
      where: { id: targetOrgId },
    });
    if (!targetOrg) throw new NotFoundException('Target organization not found');

    // Hash UUID to numeric ID
    const hashUuid = (uuid: string) => {
      let hash = 0;
      for (let i = 0; i < uuid.length; i++) {
        hash = (hash << 5) - hash + uuid.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash);
    };
    const reportIdNum = hashUuid(reportId);

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

    // Derive PDAs
    const [reportCollectionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('report_collection'),
        this.provider.wallet.publicKey.toBuffer(),
        new anchor.BN(reportIdNum).toArrayLike(Buffer, 'le', 8),
      ],
      this.program.programId
    );

    const [shareNftPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('share_nft'),
        this.provider.wallet.publicKey.toBuffer(),
        new anchor.BN(reportIdNum).toArrayLike(Buffer, 'le', 8),
        new anchor.BN(shareIndex).toArrayLike(Buffer, 'le', 8),
      ],
      this.program.programId
    );

    // Use share.blockchainHash as shareNft public key
    //const shareNftPubkey = new PublicKey(share.blockchainHash || '');

    // Determine collection account
    let collectionPubkey: PublicKey;
    let collection: Keypair;
    if (report.collectionPrivateKey && report.collectionAddress) {
      try {
        const privateKey = this.decryptPrivateKey(report.collectionPrivateKey);
        collection = Keypair.fromSecretKey(privateKey);
        collectionPubkey = new PublicKey(report.collectionAddress);
        if (!collection.publicKey.equals(collectionPubkey)) {
          throw new Error('Collection public key does not match collection address');
        }
      } catch (e) {
        throw new ForbiddenException(`Invalid collection private key: ${e.message}`);
      }
    } else {
      collection = Keypair.generate();
      collectionPubkey = collection.publicKey;
    }

  
    // Determine share nft account
   let shareNftPubkey: PublicKey;
   let shareNft: Keypair;
   if (share.nftPrivateKey && share.blockchainHash) {
     try {
       const privateKey = this.decryptPrivateKey(share.nftPrivateKey);
       shareNft = Keypair.fromSecretKey(privateKey);
       shareNftPubkey = new PublicKey(share.blockchainHash);
       if (!collection.publicKey.equals(collectionPubkey)) {
         throw new Error('Collection public key does not match collection address');
       }
     } catch (e) {
       throw new ForbiddenException(`Invalid collection private key: ${e.message}`);
     }
   } else {
    shareNft = Keypair.generate();
    shareNftPubkey = shareNft.publicKey;
   }

   // Add priority fee
   const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 });
   const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 });

   try {
     const tx = await this.program.methods
       .revokeShare(
         new anchor.BN(reportIdNum),
         new anchor.BN(shareIndex)
       )
       .accounts({
         reportCollection: reportCollectionPda,
         shareData: shareNftPda,
         collection: collectionPubkey,
         shareNft: shareNftPubkey,
         creator: this.provider.wallet.publicKey,
         sharedOrg: new PublicKey(targetOrg.wallet!),
         systemProgram: SystemProgram.programId,
         mplCoreProgram: new PublicKey(process.env.MPL_CORE_PROGRAM_ID || ''),
       })
       .signers([this.adminWalletKeypair, collection, shareNft])
       .transaction();

     tx.add(modifyComputeUnits);
     tx.add(addPriorityFee);

     const signature = await this.provider.sendAndConfirm(tx, [this.adminWalletKeypair, collection, shareNft], {
       commitment: 'confirmed',
       maxRetries: 3,
     });

     console.log(`Revoke transaction confirmed: ${signature}`);
   } catch (error) {
     console.error('Revoke transaction failed:', error);
     throw new Error(`Failed to revoke share on Solana: ${error.message}`);
   }

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
            select: {
              id: true,
              privyId: true,
              role: true,
              name: true,
              email: true,
              submissionQuatity: true,
              organizationId: true,
              photo: true,
              jobTitle: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              wallet: true,
              founderId: true,
            },
          },
          sharedReports: {
            select: {
              sourceOrgId: true,
              targetOrgId: true,
              acceptedShare: true,
              blockchainHash: true,
            },
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
   // Step 1: Fetch report and verify existence
   const report = await this.prisma.report.findUniqueOrThrow({
    where: { id },
    include: {
      author: true,
      organization: true,
      sharedReports: {
        select: {
          sourceOrgId: true,
          targetOrgId: true,
          acceptedShare: true,
          blockchainHash: true,
        },
      },
    },
  });

  if (!report) {
    throw new NotFoundException('Report not found.');
  }

  // Step 2: Verify user permissions
  const userOrganizations = await this.prisma.userOrganization.findMany({
    where: { userId },
    select: { organizationId: true },
  });
  const userOrgIds = userOrganizations.map((uo) => uo.organizationId);
  if (!userOrgIds.includes(report.organizationId)) {
    throw new ForbiddenException('User is not a member of the report’s organization');
  }

  // Step 3: Verify organization wallet
  if (!report.organization.wallet) {
    throw new Error('Organization wallet not found');
  }
  const orgWalletPubkey = new PublicKey(report.organization.wallet);

  // Step 4: Generate metadata (aligned with report.metadata.json)

   // Determine collection account
   let collectionPubkey: PublicKey;
   let collection: Keypair;
   let isNewCollection = false;
   if (report.collectionPrivateKey && report.collectionAddress) {
     try {
       const privateKey = this.decryptPrivateKey(report.collectionPrivateKey);
       collection = Keypair.fromSecretKey(privateKey);
       collectionPubkey = new PublicKey(report.collectionAddress);
       if (!collection.publicKey.equals(collectionPubkey)) {
         throw new Error('Collection public key does not match collection address');
       }
     } catch (e) {
       throw new ForbiddenException(`Invalid collection private key: ${e.message}`);
     }
   } else {
     collection = Keypair.generate();
     collectionPubkey = collection.publicKey;
     isNewCollection = true;
   }

  const metadata = {
    name: report.title,
    symbol: 'RPT',
    description: report.description,
    image: process.env.REPORT_IMAGE_URL || 'https://bafybeid2v2un5eziph75p4h2l3pykxnlrgde5gu6blzxs2nun5sryutmpe.ipfs.dweb.link/',
    animation_url: 'https://bafybeihvydpbj2h7qabs6fbklwnbt2ltbrekvjpqupquvizubm4xeb5nam.ipfs.dweb.link/',
    external_url: 'https://csds.com',
    attributes: [
      { trait_type: 'ReportId', value: id },
      { trait_type: 'Creator', value: report.organization.wallet },
      { trait_type: 'Author Organization', value: report.organization.name },
      { trait_type: 'Type of Threat', value: report.typeOfThreat },
      { trait_type: 'Severity', value: report.severity },
      { trait_type: 'Status', value: report.status },
      { trait_type: 'Submitted At', value: report.submittedAt?.toISOString() || new Date().toISOString() },
    ],
    properties: {
      files: [
        {
          uri: 'https://bafybeid2v2un5eziph75p4h2l3pykxnlrgde5gu6blzxs2nun5sryutmpe.ipfs.dweb.link/',
          type: 'image/png',
        },
        {
          uri: 'https://bafybeihvydpbj2h7qabs6fbklwnbt2ltbrekvjpqupquvizubm4xeb5nam.ipfs.dweb.link/',
          type: 'video/mp4',
        },
      ],
      category: 'image',
    },
  };

  // Step 5: Upload metadata to IPFS
  const metadataUpload = await this.pinata.upload.json(metadata);
  const metadataUri = `https://${metadataUpload.IpfsHash}.ipfs.dweb.link/`;

  // Step 6: Prepare Solana transaction
  // Hash UUID to numeric ID
  const hashUuid = (uuid: string) => {
    let hash = 0;
    for (let i = 0; i < uuid.length; i++) {
      hash = (hash << 5) - hash + uuid.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  };
  const reportIdNum = hashUuid(id);

  const ownerNft = Keypair.generate();

  const [reportCollectionPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('report_collection'),
      this.provider.wallet.publicKey.toBuffer(),
      new anchor.BN(reportIdNum).toArrayLike(Buffer, 'le', 8),
    ],
    this.program.programId
  );

  const [reportDataPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('report_data'),
      this.provider.wallet.publicKey.toBuffer(),
      new anchor.BN(reportIdNum).toArrayLike(Buffer, 'le', 8),
    ],
    this.program.programId
  );

  const [metadataAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      new PublicKey(process.env.MPL_TOKEN_METADATA_PROGRAM_ID || '').toBytes(),
      this.provider.wallet.publicKey.toBytes(),
    ],
    new PublicKey(process.env.MPL_TOKEN_METADATA_PROGRAM_ID || '')
  );

  // Step 6: Call createReport on Solana
  const collectionName = 'Report Collection';
  const collectionUri = 'https://example.com/collection.json';
  const organizationName = report.organization.name;

  console.log("📌 Creator:", this.provider.wallet.publicKey);
  console.log("📌 Report Collection PDA:", reportCollectionPda.toBase58());
  console.log("📌 Report Data PDA:", reportDataPda.toBase58());
  console.log("📌 Collection Key:", collection.publicKey.toBase58());
  console.log("📌 Owner NFT Key:", ownerNft.publicKey.toBase58());

  // Add priority fee
  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 });
  const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 });

  try {
    const tx = await this.program.methods
      .createReport(
        new anchor.BN(reportIdNum),
        report.title,
        metadataUri,
        collectionName,
        collectionUri,
        organizationName
      )
      .accounts({
        reportCollection: reportCollectionPda,
        reportData: reportDataPda,
        metadataAccount: metadataAccount,
        collection: collectionPubkey,
        ownerNft: ownerNft.publicKey,
        updateAuthority: this.provider.wallet.publicKey,
        creator: this.provider.wallet.publicKey,
        mplTokenMetadataProgram: new PublicKey(process.env.MPL_TOKEN_METADATA_PROGRAM_ID || ''),
        systemProgram: SystemProgram.programId,
        mplCoreProgram: new PublicKey(process.env.MPL_CORE_PROGRAM_ID || ''),
      })
      .signers([this.adminWalletKeypair, collection, ownerNft])
      .transaction();

    tx.add(modifyComputeUnits);
    tx.add(addPriorityFee);

    const signature = await this.provider.sendAndConfirm(tx, [this.adminWalletKeypair, collection, ownerNft], {
      commitment: 'confirmed',
      maxRetries: 3,
    });

    console.log(`Submit transaction confirmed: ${signature}`);
  } catch (error) {
    console.error('Submit transaction failed:', error);
    throw new Error(`Failed to submit report on Solana: ${error.message}`);
  }

  // If new collection was generated, update report with collectionAddress and collectionPrivateKey
  if (isNewCollection) {
    await this.prisma.report.update({
      where: { id },
      data: {
        collectionAddress: collectionPubkey.toBase58(),
        collectionPrivateKey: this.encryptPrivateKey(collection.secretKey),
      },
    });
  }

  // Step 7: Update report in Prisma
  const updatedReport = await this.prisma.report.update({
    where: { id },
    data: {
      blockchainHash: ownerNft.publicKey.toBase58(),
      submittedAt: new Date(),
      submitted: true,
    },
    include: {
      author: {
        select: {
          id: true,
          privyId: true,
          role: true,
          name: true,
          email: true,
          submissionQuatity: true,
          organizationId: true,
          photo: true,
          jobTitle: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          wallet: true,
          founderId: true,
        },
      },
      sharedReports: {
        select: {
          sourceOrgId: true,
          targetOrgId: true,
          acceptedShare: true,
          blockchainHash: true,
        },
      },
    },
  });

  // Step 10: Map sharedReports to sharedWith
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
  

  private encryptPrivateKey(privateKey: Uint8Array): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(Buffer.from(privateKey));
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return JSON.stringify({
      iv: iv.toString('hex'),
      data: encrypted.toString('hex'),
    });
  }

  private decryptPrivateKey(encryptedKey: string): Uint8Array {
    const { iv, data } = JSON.parse(encryptedKey);
    const decipher = createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(Buffer.from(data, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return new Uint8Array(decrypted);
  }
}