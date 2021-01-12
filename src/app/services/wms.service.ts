import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import WMSCapabilities from 'ol/format/WMSCapabilities';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface InternalWMSLayer {
  Name: string;
  Title: string;
  Abstract: string;
  Layer: InternalWMSLayer[];
  Dimension: {
    name: string;
    default: string;
    values: string;
  }[];
  BoundingBox: {
    crs: string;
    extent: number[]
  }[];
  Style: {
    Abstract: string;
    Name: string;
    Title: string;
    LegendURL: {
      Format: string;
      OnlineResource: string;
      size: number[];
    }[]
  }[];
  EX_GeographicBoundingBox: number[];
}

export interface WMSLayer {
  name: string;
  title: string;
  abstract: string;
  url: string;
  childLayer?: WMSLayer[];
}

@Injectable({
  providedIn: 'root'
})
export class WmsService {

  constructor(
    private http: HttpClient
  ) { }

  public getLayerTree(wmsurl: string): Observable<WMSLayer> {
    return this.getCapabilities(wmsurl).pipe(map(res => this.createLayer(res.Capability.Layer, this.cleanUpWMSUrl(wmsurl))));
  }

  public asList(entry: WMSLayer, list: WMSLayer[]): WMSLayer[] {
    if (entry.name !== undefined) {
      list.push({
        name: entry.name,
        title: entry.title,
        abstract: entry.abstract,
        url: entry.url
      });
    }
    if (entry.childLayer && entry.childLayer.length > 0) {
      entry.childLayer.forEach(e => this.asList(e, list));
    }
    return list;
  }

  private createLayer(layer: InternalWMSLayer, url: string): WMSLayer {
    if (layer.Style && layer.Style.length > 0) {
      layer.Style.forEach(e => console.log(e.LegendURL));
    }
    console.log(layer.Style);
    return {
      name: layer.Name,
      title: layer.Title,
      abstract: layer.Abstract,
      url,
      childLayer: layer.Layer ? layer.Layer.map(l => this.createLayer(l, url)) : []
    };
  }

  private cleanUpWMSUrl(url: string): string {
    let wmsRequesturl = url;
    if (wmsRequesturl.indexOf('?') !== -1) {
      wmsRequesturl = wmsRequesturl.substring(0, wmsRequesturl.indexOf('?'));
    }
    return wmsRequesturl;
  }

  private getCapabilities(url: string): Observable<any> {
    const wmsRequesturl = this.cleanUpWMSUrl(url) + '?request=GetCapabilities&service=wms&version=1.3.0';
    return this.http.get(wmsRequesturl, { responseType: 'text' })
      .pipe(map(res => new WMSCapabilities().read(res)));
  }
}
