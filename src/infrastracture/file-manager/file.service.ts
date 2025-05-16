import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import { PinataPinOptions } from '@pinata/sdk';
import { FilePinata } from './dto/file.dto';
const pinataSDK = require('@pinata/sdk');

const pinata = new pinataSDK({ pinataJWTKey: process.env.PINATA_JWT });

@Injectable()
export class FileService {
  async uploadFilesToPinata(
    files: Express.Multer.File[],
    milestoneData: any,
  ): Promise<FilePinata[]> {
    const fileLinks: FilePinata[] = [];

    if(!files){
      return fileLinks;
    }
    for (const key of Object.keys(files)) {
      const file = files[key] as Express.Multer.File;
      const fileBuffer = (file as any).buffer ?? (file as any).data;
      if (!fileBuffer) {
        throw new Error(`No valid buffer/data found for file: ${file.originalname}`);
      }
  
      const readableStreamForFile = Readable.from(fileBuffer);

      const options = {
        pinataMetadata: {
          name: `${(file as any).name}`,
          keyvalues: {
            customName: milestoneData.name,
          },
        },
        pinataOptions: {
          cidVersion: 0,
        },
      };

      const pinataResponse = await pinata.pinFileToIPFS(readableStreamForFile, options);

      const filePinata: FilePinata = {
        name: (file as any).name,
        hash: pinataResponse.IpfsHash,
      };
      fileLinks.push(filePinata);
    }
    return fileLinks;
  }

  async uploadPhotoToPinata(files: Express.Multer.File[]): Promise<FilePinata> {
    const fileLinks: FilePinata[] = [];

    for (const key of Object.keys(files)) {
      const file = files[key] as Express.Multer.File;
      if (!file) {
        throw new Error('No file provided for upload');
      }
      const fileBuffer = (file as any).buffer ?? (file as any).data;
      if (!fileBuffer) {
        throw new Error(`No valid buffer/data found for file: ${(file as any).name}`);
      }

      const readableStreamForFile = Readable.from(fileBuffer);

      const options: PinataPinOptions = {
        pinataMetadata: {
          name: `${(file as any).name}`,
        },
        pinataOptions: {
          cidVersion: 0,
        },
      };

      const pinataResponse = await pinata.pinFileToIPFS(readableStreamForFile, options);

      const filePinata: FilePinata = {
        name: (file as any).name,
        hash: pinataResponse.IpfsHash,
      };
      fileLinks.push(filePinata);
    }
    return fileLinks[0];
  }
}