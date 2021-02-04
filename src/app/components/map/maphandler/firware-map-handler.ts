import { HttpClient, HttpXhrBackend } from '@angular/common/http';
import { ComponentFactoryResolver, ViewContainerRef } from '@angular/core';
import { Map, View } from 'ol';
import { pointerMove } from 'ol/events/condition';
import Feature, { FeatureLike } from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import Select, { SelectEvent } from 'ol/interaction/Select';
import VectorLayer from 'ol/layer/Vector';
import Projection from 'ol/proj/Projection';
import VectorSource from 'ol/source/Vector';
import { Circle as CircleStyle, Style } from 'ol/style';
import Fill from 'ol/style/Fill';
import { interval, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ConfigurationService } from '../../../configuration/configuration.service';
import { FeatureInfoPopupComponent } from '../feature-info-popup/feature-info-popup.component';
import { MapHandler } from './map-handler';
import { FiwareOptions, MapProjection } from './model';


interface FiwareResponseEntry {
    id: string;
    location?: GeoJSON.Point;
    [key: string]: any;
}

export class FiwareMapHandler extends MapHandler {

    private httpClient = new HttpClient(new HttpXhrBackend({ build: () => new XMLHttpRequest() }));

    private vectorLayer!: VectorLayer;
    private clickSelectGeojsonFeature!: Select;
    private hoverSelectGeojsonFeature!: Select;

    private colorMap: string[] = [];

    private counter = 0;
    private secondsTillReload = 60;

    constructor(
        protected config: ConfigurationService,
        private viewContainerRef: ViewContainerRef,
        private factoryResolver: ComponentFactoryResolver,
        private options: FiwareOptions,
    ) {
        super(config);
    }

    public createMap(mapId: string): Observable<void> {
        interval(1000).pipe().subscribe(() => {
            this.counter++;
            // console.log(`${this.secondsTillReload - this.counter} seconds till reload`);
            if (this.counter >= this.secondsTillReload) {
                this.counter = 0;
                this.fetchData().subscribe(res => this.updateData(res));
            }
        });
        return this.fetchData().pipe(map(res => this.initMap(mapId, res)));
    }

    private fetchData(): Observable<Feature[]> {
        return this.httpClient.get<FiwareResponseEntry[]>(`${this.config.configuration.proxyUrl}${this.options.url}`)
            .pipe(map(res => res.map(e => new GeoJSON().readFeature(this.transformFeature(e)))));
    }

    private initMap(mapId: string, features: Feature[]): void {
        const projection = new Projection({ code: MapProjection.EPSG_4326 });
        const layers = this.createBaseLayers(projection);
        let extent;

        this.map = new Map({
            layers,
            controls: [],
            target: mapId,
            view: new View({
                projection: projection.getCode(),
                maxZoom: 18
            })
        });

        if (this.overlay) {
            this.map.addOverlay(this.overlay);
        }

        const vectorSource = new VectorSource({ features });
        this.vectorLayer = new VectorLayer({
            source: vectorSource,
            style: (feature) => {
                return new Style({
                    image: new CircleStyle({
                        radius: 7,
                        fill: new Fill({ color: this.getColor(feature) })
                    }),
                });
            }
        });
        this.map.addLayer(this.vectorLayer);
        extent = vectorSource.getExtent();

        extent = extent ? extent : this.getDefaultExtent(projection);
        this.map.getView().fit(extent);
    }

    private updateData(features: Feature[]): void {
        const source = this.vectorLayer.getSource();
        source.clear();
        source.addFeatures(features);
    }

    private transformFeature(payload: FiwareResponseEntry): any {
        const geom = payload.location;
        delete payload.location;
        return {
            type: 'Feature',
            properties: payload,
            geometry: geom
        };
    }

    public activateFeatureInfo(): void {
        if (this.vectorLayer) {
            this.clickSelectGeojsonFeature = new Select({ layers: [this.vectorLayer] });
            this.clickSelectGeojsonFeature.on('select', (evt => {
                this.clickSelectGeojsonFeature.getFeatures().clear();
                this.showGeoJsonFeature(evt);
            }));
            this.map.addInteraction(this.clickSelectGeojsonFeature);

            this.hoverSelectGeojsonFeature = new Select({
                condition: pointerMove,
                style: (feature) => {
                    return new Style({
                        image: new CircleStyle({
                            radius: 9,
                            fill: new Fill({ color: this.getColor(feature) })
                        }),
                    });
                },
                layers: [this.vectorLayer]
            });
            this.hoverSelectGeojsonFeature.on('select', (evt => {
                this.map.getTargetElement().style.cursor = evt.selected.length > 0 ? 'pointer' : '';
            }));
            this.map.addInteraction(this.hoverSelectGeojsonFeature);
        }
    }

    public deactivateFeatureInfo(): void {
        if (this.clickSelectGeojsonFeature) {
            this.map.removeInteraction(this.clickSelectGeojsonFeature);
        }
        if (this.hoverSelectGeojsonFeature) {
            this.map.removeInteraction(this.hoverSelectGeojsonFeature);
        }
    }

    private getColor(feature: FeatureLike): string {
        if (!feature.getProperties()?.lineNumber) {
            return 'black';
        }
        const lineNumber = feature.getProperties().lineNumber;
        if (this.colorMap[lineNumber] === undefined) {
            const r = Math.round(Math.random() * 255);
            const g = Math.round(Math.random() * 255);
            const b = Math.round(Math.random() * 255);
            // tslint:disable-next-line: no-bitwise
            this.colorMap[lineNumber] = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        }
        return this.colorMap[lineNumber];
    }

    private showGeoJsonFeature(evt: SelectEvent): void {
        if (this.overlay) {
            const coordinate = evt.mapBrowserEvent.coordinate;
            this.overlay.setPosition(coordinate);
            if (evt.selected.length) {
                const properties = evt.selected[0].getKeys()
                    .filter(e => e !== 'geometry')
                    .map(e => ({ key: e, value: evt.selected[0].get(e) }));
                this.viewContainerRef.clear();
                const factory = this.factoryResolver.resolveComponentFactory(FeatureInfoPopupComponent);
                const component = factory.create(this.viewContainerRef.injector);
                component.instance.properties = properties;
                this.viewContainerRef.insert(component.hostView);
            }
        }
    }

}