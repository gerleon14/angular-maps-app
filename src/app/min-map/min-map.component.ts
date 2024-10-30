import {
  Component,
  Input,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import * as mapboxgl from 'mapbox-gl';

@Component({
  selector: 'app-min-map',
  templateUrl: './min-map.component.html',
  styles: [
    `
      .map-container {
        width: 100%;
        height: 150px;
      }
    `,
  ],
})
export class MinMapComponent implements AfterViewInit {
  map!: mapboxgl.Map;
  zoomLevel: number = 15;
  @Input() center: [number, number] = [0, 0];

  @ViewChild('map') mapDiv!: ElementRef;

  constructor() {}

  ngAfterViewInit(): void {
    this.map = new mapboxgl.Map({
      container: this.mapDiv.nativeElement,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: this.center,
      zoom: this.zoomLevel,
      interactive: false,
    });

    new mapboxgl.Marker({}).setLngLat(this.center).addTo(this.map);
  }
}
