import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { NotAvailableError } from './error-handling/model';
import { ConfigurationService } from '../configuration/configuration.service';
import { CkanResource, Dataset, DatasetType } from '../model';
import { NotSupportedError, NotSupportedReason } from './error-handling/model';

export interface DistributionResponse {
  '@graph': string;
}

@Injectable({
  providedIn: 'root'
})
export class DatasetService {

  constructor(
    private http: HttpClient,
    private config: ConfigurationService
  ) { }

  getDataset(resource: CkanResource): Observable<Dataset> {
    const url = `${this.config.configuration.apiUrl}distributions/${resource.id}`;
    return this.http.get(`${this.config.configuration.proxyUrl}${url}`)
      .pipe(
        catchError(err => this.handleError(url, err, resource)),
        map((res: any) => {
          if (!res || !res['@graph'] || res['@graph'].length === 0) {
            throw new NotSupportedError(url, resource, NotSupportedReason.metadata);
          }

          let dist: any;
          res['@graph'].forEach((e: any) => {
            if (e['@type'] === 'http://www.w3.org/ns/dcat#Distribution') {
              dist = e;
            }
          });

          resource.type = resource.type ? resource.type : this.getFormat(dist.format);
          if (!resource.type) {
            throw new NotSupportedError(url, resource, NotSupportedReason.fileFormat);
          }
          return {
            resource,
            description: dist.description,
            title: dist.title,
            url: dist.accessURL
          };
        })
      );
  }

  getGeoJSON(url: string, resource: CkanResource): Observable<any> {
    return this.http.get(`${this.config.configuration.proxyUrl}${url}`).pipe(
      catchError(err => this.handleError(url, err, resource))
    );
  }

  private handleError(url: string, err: any, resource: CkanResource): Observable<never> {
    return throwError(new NotAvailableError(url, resource, err));
  }

  private getFormat(format: string | string[]): DatasetType {
    let type: DatasetType | undefined;
    if (Array.isArray(format)) {
      type = format.map(e => this.identifyFormat(e)).find(e => e !== undefined);
    } else {
      type = this.identifyFormat(format);
    }
    if (type) {
      return type;
    } else {
      throw new Error(`Couldn't find supported format`);
    }
  }

  private identifyFormat(format: string): DatasetType | undefined {
    format = format.toLowerCase();
    if (format.indexOf('geojson') > -1) {
      return DatasetType.GEOJSON;
    }
    if (format.indexOf('wms') > -1) {
      return DatasetType.WMS;
    }
    if (format.indexOf('fiware') > -1) {
      return DatasetType.FIWARE;
    }
    return undefined;
  }

}
