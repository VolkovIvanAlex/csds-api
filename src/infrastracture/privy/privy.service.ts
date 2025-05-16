import { Injectable } from '@nestjs/common';
import { PrivyClient } from '@privy-io/server-auth';
import { PrivyModuleOptions } from 'src/infrastracture/privy/types/privy.types';

@Injectable()
export class PrivyService {
  public readonly client: PrivyClient;
  public readonly jwksEndpoint?: string;
  private readonly applicationId: string;
  private readonly secret: string;

  constructor(options: PrivyModuleOptions) {
    this.applicationId = options.applicationId;
    this.secret = options.secret;
    this.jwksEndpoint = options.jwksEndpoint;

    this.client = new PrivyClient(this.applicationId, this.secret);
  }
}
