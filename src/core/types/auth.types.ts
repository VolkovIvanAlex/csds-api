import { Request } from 'express';
import { User } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user: User;
}

export interface DefaultRequest extends Request {
  sessionID: string;
}

export interface GenerateGoogleOAuth2Response {
  token: string;
}