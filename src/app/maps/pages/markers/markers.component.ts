import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import * as mapboxgl from 'mapbox-gl';

@Component({
  selector: 'app-markers',
  templateUrl: './markers.component.html',
  styles: [
    `
      .map-container {
        height: 100%;
        width: 100%;
      }

      .list-group {
        position: fixed;
        right: 20px;
        top: 20px;
        z-index: 9999;
      }

      .list-group-item {
        cursor: pointer;
      }
    `,
  ],
})
export class MarkersComponent implements AfterViewInit {
  map!: mapboxgl.Map;
  zoomLevel: number = 15;
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
  }

  addMarker() {
    //Color aleatorio
    const color = '#xxxxxx'.replace(/x/g, (y) =>
      ((Math.random() * 16) | 0).toString(16)
    );

    const newMarker = new mapboxgl.Marker({
      draggable: true,
      color,
    })
      .setLngLat(this.center)
      .addTo(this.map);
  }
}
