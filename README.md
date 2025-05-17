# CSDS

A scalable NestJS backend for managing cybersecurity reports on Solana, using Prisma ORM, Privy authentication, and JWT guards.


### Description

This backend powers the CSDS (Cybersecurity Data Sharing) ecosystem, integrating with Solana smart contracts to manage cybersecurity reports. Built with NestJS, it employs Prisma ORM for database operations, Privy for user authentication, and JWT guards for secure API endpoints. The ReportService handles core functionality, interacting with the CSDS smart contracts via Anchor, storing metadata on Pinata IPFS, and encrypting sensitive data.

### Main Functionality

[Main service responsible for smart contract invocation](src/modules/reports/reports.service.ts)


Each cybersecurity report is represented by a **dedicated NFT collection** on Solana, consisting of:

1. **Main NFT** – Contains the original report's metadata.
2. **Share NFT** – Represents a shared copy of the report, tied to the recipient organization (there may be multiple).

This design clearly distinguishes the original report from its shared instances.


- submitReport

After submission we store public/private (with encryptPrivateKey) keys of NFT collection/NFT in DB, to avoid creating duplicate collection/nfts for the report.

Method submits a report to the Solana blockchain by creating owner nft 

```
const ownerNft = Keypair.generate();
```

calling the create_report instruction, minting an owner NFT with a FreezeDelegate plugin for soulbound status. It uploads metadata to Pinata IPFS, derives PDAs for report tracking, and updates the report in Prisma with a blockchain hash and submission timestamp.

metadata sample : 

```
attributes: [
      { trait_type: 'ReportId', value: id },
      { trait_type: 'Creator', value: report.organization.wallet },
      { trait_type: 'Author Organization', value: report.organization.name },
      { trait_type: 'Type of Threat', value: report.typeOfThreat },
      { trait_type: 'Severity', value: report.severity },
      { trait_type: 'Status', value: report.status },
      { trait_type: 'Submitted At', value: report.submittedAt?.toISOString() || new Date().toISOString() },
]
```

- shareReport


Shares a report with another organization by generating shareNft : 
```
const shareNft = Keypair.generate();
```
invoking the share_report instruction, minting a share NFT, and recording the share in Prisma with a blockchain hash, to avoid duplicate nfts. It verifies user permissions via Privy and JWT, uploads updated metadata to IPFS, and manages collection accounts.

metadata sample : 

```
attributes: [
        { trait_type: 'ReportId', value: reportId },
        { trait_type: 'Creator', value: report.organization.wallet || this.provider.wallet.publicKey.toBase58() },
        { trait_type: 'Shared With', value: targetOrg.name },
        { trait_type: 'Author Organization', value: report.organization.name },
        { trait_type: 'Type of Threat', value: report.typeOfThreat },
        { trait_type: 'Severity', value: report.severity },
        { trait_type: 'Status', value: report.status },
        { trait_type: 'Shared At', value: new Date().toISOString() },
      ]
```



- revokeShare

We derive reportCollectionPda by report id, shareNftPda by report id and share index. I also use decryptPrivateKey method to retrieve encrypted private key of nft to use Keypair of that nft and pass it to smart contract revoke_share method. 

By calling the revoke_share instruction, burning the associated share NFT, and deleting the share record from Prisma. It validates user authorization, derives PDAs, and ensures the operation is restricted to the report’s organization.