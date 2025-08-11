import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, map, Observable, of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NGSIService {
  private readonly logger = new Logger(NGSIService.name);
  private readonly orionUrl: string;
  //private readonly orionUrl = 'http://localhost:1026/ngsi-ld/v1/entities';
  private readonly headers = {
    'Content-Type': 'application/ld+json',
    'Fiware-Service': 'csds',
    'Fiware-ServicePath': '/',
  };
  private readonly context = [
    'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.8.jsonld',
  ];

  @Inject()
  private readonly httpService: HttpService;
  constructor(private readonly configService: ConfigService) { 
    this.orionUrl = this.configService.get<string>('ORION_URL', 'http://localhost:1026/ngsi-ld/v1/entities');
  }

  createEntity(entity: any): Observable<AxiosResponse<any>> {
    const payload = {
      ...entity,
      '@context': this.context,
    };
    return this.httpService
      .post(this.orionUrl, payload, { headers: { ...this.headers, 'Content-Type': 'application/ld+json' } })
      .pipe(map((response) => response));
  }

  async updateEntity(entityId: string, attributes: Record<string, any>): Promise<void> {
    const payload = {
      ...attributes,
      '@context': this.context,
    };

    this.logger.log(`Updating entity ${entityId} with payload: ${JSON.stringify(payload)}`);
    try {
      await firstValueFrom(
        this.httpService.patch(`${this.orionUrl}/${entityId}/attrs`, payload, {
          headers: { ...this.headers, 'Content-Type': 'application/ld+json' },
        }),
      );
      this.logger.log(`Entity ${entityId} updated`);
    } catch (error: any) {
      this.logger.error(`Failed to update entity ${entityId}: ${error.message}, Response: ${JSON.stringify(error.response?.data)}`);
      throw new NotFoundException(`Failed to update entity ${entityId}: ${error.message}`);
    }
  }

  async updateRelationship(entityId: string, attributeName: string, relationship: { type: 'Relationship'; object: string | string[] }): Promise<void> {
    const attributes = {
      [attributeName]: relationship,
    };

    // Add @context to the payload
    const payload = {
      ...attributes,
      '@context': this.context,
    };

    try {
      await firstValueFrom(
        this.httpService.patch(`${this.orionUrl}/${entityId}/attrs`, payload, {
          headers: { ...this.headers, 'Content-Type': 'application/ld+json' },
        }),
      );
      this.logger.log(`Relationship ${attributeName} for entity ${entityId} updated`);
    } catch (error: any) {
      this.logger.error(`Failed to update relationship ${attributeName} for entity ${entityId}: ${error.message}`);
      throw new NotFoundException(`Failed to update relationship for entity ${entityId}: ${error.message}`);
    }
  }

  async checkEntityExists(id: string, type?: string): Promise<boolean> {
    let url = `${this.orionUrl}/${id}`;
    if (type !== undefined) {
      url += `?type=${type}`;
    }
    return firstValueFrom(
      this.httpService
        .get(url, { headers: { ...this.headers, Accept: 'application/ld+json' } })
        .pipe(
          map(() => true),
          catchError((error) => {
            if (error.response && error.response.status === 404) {
              return of(false);
            }
            throw error;
          }),
        ),
    );
  }

  async getEntitiesByType(type: string): Promise<any[]> {
    let url = `${this.orionUrl}?type=${type}`;
    return firstValueFrom(
      this.httpService
        .get(url, { headers: { ...this.headers, Accept: 'application/ld+json' } })
        .pipe(
          map((response: AxiosResponse<any[]>) => response.data || []),
          catchError((error) => {
            if (error.response && error.response.status === 404) {
              return of([]);
            }
            throw error;
          }),
        ),
    );
  }

  async getEntityById(id: string): Promise<any> {
    return firstValueFrom(
      this.httpService
        .get(`${this.orionUrl}/${id}`, { headers: { ...this.headers, Accept: 'application/ld+json' } })
        .pipe(
          map((response: AxiosResponse<any>) => response.data),
          catchError((error) => {
            if (error.response && error.response.status === 404) {
              return of(null);
            }
            throw error;
          }),
        ),
    );
  }

  async deleteEntity(id: string): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.delete(`${this.orionUrl}/${id}`, {
          headers: { ...this.headers },
        }),
      );
      this.logger.log(`Entity ${id} deleted`);
    } catch (error: any) {
      this.logger.error(`Failed to delete entity ${id}: ${error.message}, Response: ${JSON.stringify(error.response?.data)}`);
      throw new NotFoundException(`Failed to delete entity ${id}: ${error.message}`);
    }
  }
}