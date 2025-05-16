import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { PrivyService } from './privy.service';
import {
  PrivyModuleAsyncOptions,
  PrivyModuleOptions,
} from './types/privy.types';
import { ServerException } from 'src/core/exceptions/auth.exceptions';

@Global()
@Module({})
export class PrivyModule {
  static register(options: PrivyModuleOptions): DynamicModule {
    return {
      module: PrivyModule,
      providers: [
        {
          provide: PrivyService,
          useValue: new PrivyService(options),
        },
      ],
      exports: [PrivyService],
    };
  }

  static registerAsync(options: PrivyModuleAsyncOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);

    return {
      module: PrivyModule,
      providers: [...asyncProviders, ...(options.extraProviders || [])],
      exports: [PrivyService],
      global: options.global || false,
    };
  }

  private static createAsyncProviders(
    options: PrivyModuleAsyncOptions,
  ): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: PrivyService,
          useFactory: async (...args: any[]): Promise<PrivyService> => {
            const config = await options.useFactory?.(...args);

            return new PrivyService(
              config || { applicationId: '', secret: '' },
            );
          },
          inject: options.inject || [],
        },
      ];
    }

    if (options.useClass) {
      return [
        {
          provide: PrivyService,
          useClass: options.useClass,
        },
      ];
    }

    if (options.useExisting) {
      return [
        {
          provide: PrivyService,
          useExisting: options.useExisting,
        },
      ];
    }

    throw new ServerException(
      'Invalid async options for privy module were provided',
    );
  }
}
