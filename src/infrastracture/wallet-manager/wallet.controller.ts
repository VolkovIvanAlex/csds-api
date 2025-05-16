import {
  Controller,
  Get,
  HttpStatus,
} from '@nestjs/common';
import { WalletService } from './wallet.service';

@Controller('api/wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}


  @Get('WBTPriceToUsd')
  async fetchWbtPriceUsd() {
    const wbtPriceUsd = await this.walletService.fetchWbtPriceUsd();
    return {
      statusCode: HttpStatus.OK,
      wbtPriceUsd,
    };
  }
}
