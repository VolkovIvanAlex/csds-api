export type Csds = {
  "version": "0.1.0",
  "name": "csds",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [],
      "args": []
    },
    {
      "name": "createReport",
      "accounts": [
        {
          "name": "reportCollection",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reportData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metadataAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "collection",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "ownerNft",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "updateAuthority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "creator",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "mplTokenMetadataProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mplCoreProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "reportId",
          "type": "u64"
        },
        {
          "name": "reportName",
          "type": "string"
        },
        {
          "name": "contentUri",
          "type": "string"
        },
        {
          "name": "collectionName",
          "type": "string"
        },
        {
          "name": "collectionUri",
          "type": "string"
        },
        {
          "name": "organizationName",
          "type": "string"
        }
      ]
    },
    {
      "name": "shareReport",
      "accounts": [
        {
          "name": "reportCollection",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "shareData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "collection",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "shareNft",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "creator",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "sharedOrg",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mplCoreProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "reportId",
          "type": "u64"
        },
        {
          "name": "reportName",
          "type": "string"
        },
        {
          "name": "shareIndex",
          "type": "u64"
        },
        {
          "name": "contentUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "revokeShare",
      "accounts": [
        {
          "name": "reportCollection",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "shareData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "collection",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "shareNft",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "creator",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "sharedOrg",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mplCoreProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "reportId",
          "type": "u64"
        },
        {
          "name": "shareIndex",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "reportCollection",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "reportId",
            "type": "u64"
          },
          {
            "name": "collectionKey",
            "type": "publicKey"
          },
          {
            "name": "ownerNft",
            "type": "publicKey"
          },
          {
            "name": "creator",
            "type": "publicKey"
          }
        ]
      }
    },
    {
      "name": "reportData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "reportId",
            "type": "u64"
          },
          {
            "name": "contentUri",
            "type": "string"
          },
          {
            "name": "isOwnerNft",
            "type": "bool"
          },
          {
            "name": "sharedWith",
            "type": {
              "option": "publicKey"
            }
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "Unauthorized",
      "msg": "Unauthorized: Only the creator can perform this action"
    },
    {
      "code": 6001,
      "name": "InvalidReportId",
      "msg": "Invalid report ID"
    },
    {
      "code": 6002,
      "name": "NotShareNFT",
      "msg": "NFT is not a share NFT"
    },
    {
      "code": 6003,
      "name": "ShareNFTNotFound",
      "msg": "Share NFT not found for organization"
    },
    {
      "code": 6004,
      "name": "Overflow",
      "msg": "Arithmetic overflow occurred"
    },
    {
      "code": 6005,
      "name": "OrgNameTooLong",
      "msg": "Organization name exceeds maximum length"
    },
    {
      "code": 6006,
      "name": "ReportNameTooLong",
      "msg": "Report name exceeds maximum length"
    }
  ]
};

export const IDL: Csds = {
  "version": "0.1.0",
  "name": "csds",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [],
      "args": []
    },
    {
      "name": "createReport",
      "accounts": [
        {
          "name": "reportCollection",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reportData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metadataAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "collection",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "ownerNft",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "updateAuthority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "creator",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "mplTokenMetadataProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mplCoreProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "reportId",
          "type": "u64"
        },
        {
          "name": "reportName",
          "type": "string"
        },
        {
          "name": "contentUri",
          "type": "string"
        },
        {
          "name": "collectionName",
          "type": "string"
        },
        {
          "name": "collectionUri",
          "type": "string"
        },
        {
          "name": "organizationName",
          "type": "string"
        }
      ]
    },
    {
      "name": "shareReport",
      "accounts": [
        {
          "name": "reportCollection",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "shareData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "collection",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "shareNft",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "creator",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "sharedOrg",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mplCoreProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "reportId",
          "type": "u64"
        },
        {
          "name": "reportName",
          "type": "string"
        },
        {
          "name": "shareIndex",
          "type": "u64"
        },
        {
          "name": "contentUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "revokeShare",
      "accounts": [
        {
          "name": "reportCollection",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "shareData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "collection",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "shareNft",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "creator",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "sharedOrg",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mplCoreProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "reportId",
          "type": "u64"
        },
        {
          "name": "shareIndex",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "reportCollection",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "reportId",
            "type": "u64"
          },
          {
            "name": "collectionKey",
            "type": "publicKey"
          },
          {
            "name": "ownerNft",
            "type": "publicKey"
          },
          {
            "name": "creator",
            "type": "publicKey"
          }
        ]
      }
    },
    {
      "name": "reportData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "reportId",
            "type": "u64"
          },
          {
            "name": "contentUri",
            "type": "string"
          },
          {
            "name": "isOwnerNft",
            "type": "bool"
          },
          {
            "name": "sharedWith",
            "type": {
              "option": "publicKey"
            }
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "Unauthorized",
      "msg": "Unauthorized: Only the creator can perform this action"
    },
    {
      "code": 6001,
      "name": "InvalidReportId",
      "msg": "Invalid report ID"
    },
    {
      "code": 6002,
      "name": "NotShareNFT",
      "msg": "NFT is not a share NFT"
    },
    {
      "code": 6003,
      "name": "ShareNFTNotFound",
      "msg": "Share NFT not found for organization"
    },
    {
      "code": 6004,
      "name": "Overflow",
      "msg": "Arithmetic overflow occurred"
    },
    {
      "code": 6005,
      "name": "OrgNameTooLong",
      "msg": "Organization name exceeds maximum length"
    },
    {
      "code": 6006,
      "name": "ReportNameTooLong",
      "msg": "Report name exceeds maximum length"
    }
  ]
};
