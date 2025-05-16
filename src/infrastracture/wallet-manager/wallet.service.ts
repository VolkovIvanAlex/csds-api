import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { PrivyService } from '../privy/privy.service';
import { mintAbi } from 'src/core/utils/blockchain.utils';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WalletService {
  private readonly network: ethers.Network;
  private readonly provider: ethers.JsonRpcProvider;
  private readonly adminWallet: ethers.Wallet;
  private readonly nftAdminWallet: ethers.Wallet;

  constructor(private readonly privyService: PrivyService, private readonly configService: ConfigService) {
    this.network = new ethers.Network(
      process.env.CHAIN_NAME || 'Whitechain Testnet',
      process.env.CHAIN_ID || '2625',
    );

    this.provider = new ethers.JsonRpcProvider(
      process.env.CHAIN_PROVIDER || 'https://rpc-testnet.whitechain.io',
      this.network,
    );

    this.adminWallet = new ethers.Wallet(
      process.env.ADMIN_KEY || '',
      this.provider,
    );
    this.nftAdminWallet = new ethers.Wallet(
      process.env.NFT_ADMIN_KEY || '',
      this.provider,
    );
  }

  async drop(privyId: string): Promise<string> {
    const { linkedAccounts } =
      await this.privyService.client.getUserById(privyId);
    const accountWithWallet: any = linkedAccounts?.find(
      (account: any) => account?.type?.trim() === 'wallet',
    );

    const feeData = await this.provider.getFeeData();
    console.log(this.adminWallet.address);

    await this.adminWallet.sendTransaction({
      to: accountWithWallet.address,
      value: ethers.parseEther('0.01'),
      gasLimit: 100_000,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    });

    return accountWithWallet.address;
  }

  /** Ensures the user's wallet has a minimum balance, funding it if necessary */
  async ensureMinimumBalance(
    privyId: string,
    minBalance: number = 0.005,
  ): Promise<void> {
    const walletAddress = await this.getWalletAddress(privyId);
    const balance = parseFloat(await this.getBalance(walletAddress));
    if (balance <= minBalance) {
      console.log('need to drop funds');
      await this.drop(privyId);
    }
  }

  /** Retrieves the wallet address associated with a Privy ID */
  async getWalletAddress(privyId: string): Promise<string> {
    const { linkedAccounts } =
      await this.privyService.client.getUserById(privyId);
    const accountWithWallet: any = linkedAccounts?.find(
      (account: any) => account?.type?.trim() === 'wallet',
    );
    if (!accountWithWallet) {
      throw new Error('No wallet found for user');
    }
    return accountWithWallet.address;
  }

  /** Retrieves the balance of a wallet address in ether */
  async getBalance(address: string): Promise<string> {
    const network = new ethers.Network(
      process.env.CHAIN_NAME || 'Whitechain Testnet',
      process.env.CHAIN_ID || '2625',
    );

    const provider = new ethers.JsonRpcProvider(
      process.env.CHAIN_PROVIDER || 'https://rpc-testnet.whitechain.io',
      network,
      { staticNetwork: network },
    );

    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  async addMinter(privyId: string) {
    const { linkedAccounts } =
      await this.privyService.client.getUserById(privyId);
    const accountWithWallet: any = linkedAccounts?.find(
      (account: any) => account?.type?.trim() === 'wallet',
    );

    const contractAddress = process.env.CONTRACT_ADDRESS || '';

    console.log(this.nftAdminWallet.address);
    const richContract = new ethers.Contract(
      contractAddress,
      mintAbi,
      this.nftAdminWallet,
    );
    //console.log(richContract);

    const tx = await richContract.setMinter(accountWithWallet.address, true);
    console.log('Tx sent:', tx.hash);
    await tx.wait();
    console.log('Minter added:', accountWithWallet.address);
  }

  async fetchWbtPriceUsd(): Promise<number | null> {
    const retries = this.configService.get<number>('RETRY_COUNT', 5);
    const backoffMs = this.configService.get<number>('BACKOFF_START_MS', 5000);
    const backoffMaxMs = this.configService.get<number>('BACKOFF_MAX_MS', 120000);
  
    return this.fetchWbtPriceUsdWithBackoff(retries, backoffMs, backoffMaxMs);
  }

  async fetchWbtPriceUsdWithBackoff(retries = 5, backoffMs = 5000, backoffMaxMs = 120000): Promise<number | null> {
    let attempt = 0;
  
    while (attempt < retries) {
      try {
        console.log('attempt: ', attempt);
        const response = await axios.get(
          'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest',
          {
            headers: {
              'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY || '',
            },
            params: {
              symbol: 'WBT',
              convert: 'USD',
            },
          },
        );
  
        const price = response.data.data.WBT.quote.USD.price;
        return price;
      } catch (err: any) {
        const isRateLimit = err?.response?.status === 429;
  
        if (isRateLimit) {
          console.warn(`429 Rate Limit hit. Retrying in ${backoffMs / 1000}s... (attempt ${attempt + 1})`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          backoffMs = Math.min(backoffMs * 2, backoffMaxMs); // exponential backoff
          attempt++;
        } else {
          console.error('Failed to fetch WBT price:', err);
          return null;
        }
      }
    }
  
    console.error('Max retry attempts reached. Returning null.');
    return null;
  }

}
