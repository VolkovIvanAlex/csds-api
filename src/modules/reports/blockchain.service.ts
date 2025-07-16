import { Injectable } from '@nestjs/common';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey, Keypair, SystemProgram, ComputeBudgetProgram } from '@solana/web3.js';
import { PinataSDK } from 'pinata-web3';
import { Csds } from 'src/core/types/csds';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
const IV_LENGTH = 16;

@Injectable()
export class BlockchainService {
  private readonly pinata: PinataSDK;
  private readonly program: anchor.Program<Csds>;
  private readonly provider: anchor.AnchorProvider;
  private readonly adminWalletKeypair: Keypair;

  constructor() {
    this.pinata = new PinataSDK({
      pinataJwt: process.env.PINATA_JWT || '',
      pinataGateway: process.env.PINATA_GATEWAY || '',
    });

    const connection = new anchor.web3.Connection(process.env.SOLANA_CONNECTION || '');
    this.adminWalletKeypair = Keypair.fromSecretKey(Buffer.from(JSON.parse(process.env.SOLANA_WALLET_SECRET_KEY || '[]')));
    const wallet = new anchor.Wallet(this.adminWalletKeypair);
    this.provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    anchor.setProvider(this.provider);
    const idl = require('../../../csds_contracts/target/idl/csds.json');
    this.program = new anchor.Program(idl, new PublicKey(process.env.SMART_CONTRACT_ADDRESS || ''), this.provider);

    if (!this.adminWalletKeypair) throw new Error('Provider wallet payer is undefined');
  }

  private encryptKey(key: Uint8Array): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(Buffer.from(key));
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return JSON.stringify({ iv: iv.toString('hex'), data: encrypted.toString('hex') });
  }

  private decryptKey(encryptedKey: string): Uint8Array {
    const { iv, data } = JSON.parse(encryptedKey);
    const decipher = createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(Buffer.from(data, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return new Uint8Array(decrypted);
  }

  private hashUuid(uuid: string): number {
    let hash = 0;
    for (let i = 0; i < uuid.length; i++) {
      hash = (hash << 5) - hash + uuid.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  async createReportOnBlockchain(
    reportId: string,
    title: string,
    description: string,
    organizationWallet: string,
    collectionPrivateKey?: string,
    collectionAddress?: string,
    organizationName?: string,
    typeOfThreat?: string,
    severity?: string,
    status?: string
  ): Promise<{ isNewCollection: boolean, collectionAddress: string; collectionPrivateKey: string | null; blockchainHash: string }> {
    let collection: Keypair;
    let collectionPubkey: PublicKey;
    let isNewCollection = false;

    if (collectionPrivateKey && collectionAddress) {
      const privateKey = this.decryptKey(collectionPrivateKey);
      collection = Keypair.fromSecretKey(privateKey);
      collectionPubkey = new PublicKey(collectionAddress);
      if (!collection.publicKey.equals(collectionPubkey)) throw new Error('Collection public key does not match collection address');
    } else {
      collection = Keypair.generate();
      collectionPubkey = collection.publicKey;
      isNewCollection = true;
    }

    const metadata = {
      name: title,
      symbol: 'RPT',
      description,
      image: process.env.REPORT_IMAGE_URL || 'https://bafybeid2v2un5eziph75p4h2l3pykxnlrgde5gu6blzxs2nun5sryutmpe.ipfs.dweb.link/',
      animation_url: 'https://bafybeihvydpbj2h7qabs6fbklwnbt2ltbrekvjpqupquvizubm4xeb5nam.ipfs.dweb.link/',
      external_url: 'https://csds.com',
      attributes: [
        { trait_type: 'ReportId', value: reportId },
        { trait_type: 'Creator', value: organizationWallet },
        ...(organizationName ? [{ trait_type: 'Author Organization', value: organizationName }] : []),
        ...(typeOfThreat ? [{ trait_type: 'Type of Threat', value: typeOfThreat }] : []),
        ...(severity ? [{ trait_type: 'Severity', value: severity }] : []),
        ...(status ? [{ trait_type: 'Status', value: status }] : []),
        { trait_type: 'Submitted At', value: new Date().toISOString() },
      ],
      properties: {
        files: [
          { uri: 'https://bafybeid2v2un5eziph75p4h2l3pykxnlrgde5gu6blzxs2nun5sryutmpe.ipfs.dweb.link/', type: 'image/png' },
          { uri: 'https://bafybeihvydpbj2h7qabs6fbklwnbt2ltbrekvjpqupquvizubm4xeb5nam.ipfs.dweb.link/', type: 'video/mp4' },
        ],
        category: 'image',
      },
    };

    const metadataUpload = await this.pinata.upload.json(metadata);
    const metadataUri = `https://${metadataUpload.IpfsHash}.ipfs.dweb.link/`;

    const reportIdNum = this.hashUuid(reportId);
    const ownerNft = Keypair.generate();
    const [reportCollectionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('report_collection'), 
        this.provider.wallet.publicKey.toBuffer(), 
        new anchor.BN(reportIdNum).toArrayLike(Buffer, 'le', 8)
    ],
      this.program.programId
    );
    const [reportDataPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('report_data'), 
        this.provider.wallet.publicKey.toBuffer(), 
        new anchor.BN(reportIdNum).toArrayLike(Buffer, 'le', 8)
    ],
      this.program.programId
    );
    const [metadataAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'), 
        new PublicKey(process.env.MPL_TOKEN_METADATA_PROGRAM_ID || '').toBytes(), 
        this.provider.wallet.publicKey.toBytes()
    ],
      new PublicKey(process.env.MPL_TOKEN_METADATA_PROGRAM_ID || '')
    );

    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 });
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 });

    try {
        const tx = await this.program.methods
        .createReport(
            new anchor.BN(reportIdNum),
            title,
            metadataUri,
            'Report Collection',
            'https://example.com/collection.json',
            organizationName || 'Unknown Organization'
        )
        .accounts({
            reportCollection: reportCollectionPda,
            reportData: reportDataPda,
            metadataAccount,
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

    return {
      isNewCollection,
      collectionAddress: collectionPubkey.toBase58(),
      collectionPrivateKey: isNewCollection ? this.encryptKey(collection.secretKey) : null,
      blockchainHash: ownerNft.publicKey.toBase58(),
    };
  }

  async shareReportOnBlockchain(
    reportId: string,
    shareIndex: number,
    title: string,
    description: string,
    organizationWallet: string,
    targetOrgWallet: string,
    collectionPrivateKey: string | undefined,
    collectionAddress: string | undefined,
    sourceOrgName: string,
    targetOrgName: string,
    typeOfThreat: string,
    severity: string,
    status: string
  ): Promise<{ isNewCollection: boolean, blockchainHash: string; collectionAddress: string; collectionPrivateKey: string | null; nftPrivateKey: string }> {
    let collection: Keypair;
    let collectionPubkey: PublicKey;
    let isNewCollection = false;

    if (collectionPrivateKey && collectionAddress) {
      const privateKey = this.decryptKey(collectionPrivateKey);
      collection = Keypair.fromSecretKey(privateKey);
      collectionPubkey = new PublicKey(collectionAddress);
      if (!collection.publicKey.equals(collectionPubkey)) throw new Error('Collection public key does not match collection address');
    } else {
      collection = Keypair.generate();
      collectionPubkey = collection.publicKey;
      isNewCollection = true;
    }

    const metadata = {
      name: title,
      symbol: 'RPT_SHARE',
      description: `Shared report: ${description}`,
      image: process.env.REPORT_IMAGE_URL || 'https://bafybeid2v2un5eziph75p4h2l3pykxnlrgde5gu6blzxs2nun5sryutmpe.ipfs.dweb.link/',
      animation_url: 'https://bafybeihvydpbj2h7qabs6fbklwnbt2ltbrekvjpqupquvizubm4xeb5nam.ipfs.dweb.link/',
      external_url: 'https://csds.com',
      attributes: [
        { trait_type: 'ReportId', value: reportId },
        { trait_type: 'Creator', value: organizationWallet || this.provider.wallet.publicKey.toBase58() },
        { trait_type: 'Shared With', value: targetOrgName },
        { trait_type: 'Author Organization', value: sourceOrgName },
        { trait_type: 'Type of Threat', value: typeOfThreat },
        { trait_type: 'Severity', value: severity },
        { trait_type: 'Status', value: status },
        { trait_type: 'Shared At', value: new Date().toISOString() },
      ],
      properties: {
        files: [
          { uri: 'https://bafybeid2v2un5eziph75p4h2l3pykxnlrgde5gu6blzxs2nun5sryutmpe.ipfs.dweb.link/', type: 'image/png' },
          { uri: 'https://bafybeihvydpbj2h7qabs6fbklwnbt2ltbrekvjpqupquvizubm4xeb5nam.ipfs.dweb.link/', type: 'video/mp4' },
        ],
        category: 'image',
      },
    };

    // Upload metadata to IPFS
    const metadataUpload = await this.pinata.upload.json(metadata);
    const metadataUri = `https://${metadataUpload.IpfsHash}.ipfs.dweb.link/`;

    const reportIdNum = this.hashUuid(reportId);
    const shareNft = Keypair.generate();
    const [reportCollectionPda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('report_collection'), 
            this.provider.wallet.publicKey.toBuffer(),
            new anchor.BN(reportIdNum).toArrayLike(Buffer, 'le', 8)
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

    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 });
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 });

    try {
          const tx = await this.program.methods
            .shareReport(
              new anchor.BN(reportIdNum),
              title,
              new anchor.BN(shareIndex),
              metadataUri
            )
            .accounts({
              reportCollection: reportCollectionPda,
              shareData: shareNftPda,
              collection: collectionPubkey,
              shareNft: shareNft.publicKey,
              creator: this.provider.wallet.publicKey,
              sharedOrg: new PublicKey(targetOrgWallet),
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

    return {
      isNewCollection,
      blockchainHash: shareNft.publicKey.toBase58(),
      collectionAddress: collectionPubkey.toBase58(),
      collectionPrivateKey: isNewCollection ? this.encryptKey(collection.secretKey) : null,
      nftPrivateKey: this.encryptKey(shareNft.secretKey),
    };
  }

  async revokeShareOnBlockchain(
    reportId: string,
    shareIndex: number,
    collectionPrivateKey: string,
    collectionAddress: string,
    shareNftPrivateKey: string,
    shareNftAddress: string,
    targetOrgWallet: string
  ): Promise<void> {
    const collectionPrivateKeyDecrypted = this.decryptKey(collectionPrivateKey);
    const collection = Keypair.fromSecretKey(collectionPrivateKeyDecrypted);
    const collectionPubkey = new PublicKey(collectionAddress);
    if (!collection.publicKey.equals(collectionPubkey)) throw new Error('Collection public key does not match collection address');

    const shareNftPrivateKeyDecrypted = this.decryptKey(shareNftPrivateKey);
    const shareNft = Keypair.fromSecretKey(shareNftPrivateKeyDecrypted);
    const shareNftPubkey = new PublicKey(shareNftAddress);
    if (!shareNft.publicKey.equals(shareNftPubkey)) throw new Error('Share NFT public key does not match share NFT address');

    const reportIdNum = this.hashUuid(reportId);
    const [reportCollectionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('report_collection'),
        this.provider.wallet.publicKey.toBuffer(), 
        new anchor.BN(reportIdNum).toArrayLike(Buffer, 'le', 8)
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

    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 });
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 });

    try {
    const tx = await this.program.methods
      .revokeShare(new anchor.BN(reportIdNum), new anchor.BN(shareIndex))
      .accounts({
        reportCollection: reportCollectionPda,
        shareData: shareNftPda,
        collection: collectionPubkey,
        shareNft: shareNftPubkey,
        creator: this.provider.wallet.publicKey,
        sharedOrg: new PublicKey(targetOrgWallet),
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
  }
}