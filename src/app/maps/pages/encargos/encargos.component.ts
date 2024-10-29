// encargos.component.ts
// encargos.component.ts
import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { EncargosService } from '../../services/encargos.service';
import * as mapboxgl from 'mapbox-gl';

interface EncargoColor {
  color: string;
  marker?: mapboxgl.Marker;
  center?: [number, number];
}

@Component({
  selector: 'app-encargos',
  templateUrl: './encargos.component.html',
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
export class EncargosComponent implements AfterViewInit {
  map!: mapboxgl.Map;
  zoomLevel: number = 15;
  center: [number, number] = [-2.92528, 43.26271];
  markerArr: EncargoColor[] = [];

  @ViewChild('map') mapDiv!: ElementRef;

  constructor(private encargosService: EncargosService) {}

  ngAfterViewInit(): void {
    this.map = new mapboxgl.Map({
      container: this.mapDiv.nativeElement,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: this.center,
      zoom: this.zoomLevel,
    });

    this.loadEncargos();
  }

  loadEncargos() {
    this.encargosService.getEncargos().subscribe((encargos) => {
      encargos.forEach((encargo) => {
        const direccion = encargo.activo?.direccion;
        if (direccion && direccion.lat !== undefined && direccion.lng !== undefined) {
          const color = this.getRandomColor();

          const newMarker = new mapboxgl.Marker({
            draggable: false,
            color,
          })
            .setLngLat([direccion.lng, direccion.lat])
            .addTo(this.map);

          this.markerArr.push({
            color,
            marker: newMarker,
            center: [direccion.lng, direccion.lat],
          });
        }
      });
    });
  }

  // Método para obtener un color aleatorio
  getRandomColor(): string {
    return '#xxxxxx'.replace(/x/g, (y) =>
      ((Math.random() * 16) | 0).toString(16)
    );
  }

  addMarker() {
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

  moveMarker({ marker }: EncargoColor) {
    this.map.flyTo({
      center: marker!.getLngLat(),
    });
  }

  saveInStorage() {
    const markerStorage: EncargoColor[] = this.markerArr.map((marker) => {
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
      const markers: EncargoColor[] = JSON.parse(
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
