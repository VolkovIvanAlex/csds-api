import { Provider, Type } from '@nestjs/common';

export interface PrivyModuleOptions {
  applicationId: string;
  secret: string;
  jwksEndpoint?: string;
}

export interface PrivyOptionsFactory {
  createPrivyOptions(): Promise<PrivyModuleOptions> | PrivyModuleOptions;
}

export interface PrivyModuleAsyncOptions {
  global?: boolean;
  useExisting?: Type<PrivyOptionsFactory>;
  useClass?: Type<PrivyOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<PrivyModuleOptions> | PrivyModuleOptions;
  inject?: any[];
  extraProviders?: Provider[];
}
