import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import * as mapboxgl from 'mapbox-gl';

@Component({
  selector: 'app-zoom-range',
  templateUrl: './zoom-range.component.html',
  styles: [
    `
      .map-container {
        height: 100%;
        width: 100%;
      }

      .row {
        width: 400px;
        background-color: white;
        bottom: 25px;
        left: 25px;
        padding: 20px;
        border-radius: 5px;
        position: fixed;
        z-index: 999;
      }
    `,
  ],
})
export class ZoomRangeComponent implements OnInit, AfterViewInit, OnDestroy {
  map!: mapboxgl.Map;
  zoomLevel: number = 16;
  center: [number, number] = [-74.80050079279056, 10.92720608875137];

  @ViewChild('map') mapDiv!: ElementRef;

  constructor() {}

  ngAfterViewInit(): void {
    this.map = new mapboxgl.Map({
      container: this.mapDiv.nativeElement,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: this.center,
      zoom: this.zoomLevel,
    });

    this.map.on('zoom', () => (this.zoomLevel = this.map.getZoom()));

    this.map.on('zoomend', () => {
      if (this.map.getZoom() > 18) {
        this.map.zoomTo(18);
      }
    });

    //Movimiento del mapa
    this.map.on('move', (e) => {
      const targe = e.target;
      const { lng, lat } = targe.getCenter();

      this.center = [lng, lat];
    });
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.map.off('zoom', () => {});
    this.map.off('zoomend', () => {});
    this.map.off('move', () => {});
  }

  zoomIn() {
    this.map.zoomIn();
  }

  zoomOut() {
    this.map.zoomOut();
  }

  handleZoomRange(zoom: string) {
    this.map.zoomTo(Number(zoom));
  }
}
