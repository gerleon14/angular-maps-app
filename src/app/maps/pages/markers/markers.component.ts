import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import * as mapboxgl from 'mapbox-gl';

interface MarkerColor {
  color: string;
  marker?: mapboxgl.Marker;
  center?: [number, number];
}

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
  markerArr: MarkerColor[] = [];

  @ViewChild('map') mapDiv!: ElementRef;

  constructor() {}

  ngAfterViewInit(): void {
    this.map = new mapboxgl.Map({
      container: this.mapDiv.nativeElement,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: this.center,
      zoom: this.zoomLevel,
    });

    this.getMarkersStorage();
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

    this.markerArr.push({ color, marker: newMarker });
    this.saveInStorage();

    newMarker.on('dragend', () => {
      this.saveInStorage();
    });
  }

  moveMarker({ marker }: MarkerColor) {
    this.map.flyTo({
      center: marker!.getLngLat(),
    });
  }

  saveInStorage() {
    const markerStorage: MarkerColor[] = this.markerArr.map((marker) => {
      const { lng, lat } = marker.marker!.getLngLat();

      return {
        color: marker.color,
        center: [lng, lat],
      };
    });

    localStorage.setItem('markers', JSON.stringify(markerStorage));
  }

  getMarkersStorage() {
    if (localStorage.getItem('markers')) {
      const markers: MarkerColor[] = JSON.parse(
        localStorage.getItem('markers')!
      );

      markers.forEach((marker) => {
        const newMarker = new mapboxgl.Marker({
          color: marker.color,
          draggable: true,
        })
          .setLngLat(marker.center!)
          .addTo(this.map);

        this.markerArr.push({ color: marker.color, marker: newMarker });

        newMarker.on('dragend', () => {
          this.saveInStorage();
        });
      });
    }
  }

  removeMarker(i: number) {
    this.markerArr[i].marker?.remove();
    this.markerArr.splice(i, 1);
    this.saveInStorage();
  }
}
