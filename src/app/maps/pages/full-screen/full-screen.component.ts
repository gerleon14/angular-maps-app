import { Component, OnInit } from '@angular/core';
import { EncargosService } from '../../services/encargos.service';
import * as mapboxgl from 'mapbox-gl';

@Component({
  selector: 'app-full-screen',
  templateUrl: './full-screen.component.html',
  styles: [
    `
      #map {
        height: 100%;
        width: 100%;
      }
    `,
  ],
})
export class FullScreenComponent implements OnInit {
  map!: mapboxgl.Map;

  constructor(private encargosService: EncargosService) {}

  ngOnInit(): void {
    this.map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-2.92528, 43.26271],
      zoom: 16,
    });

    // Obtén los encargos y agrégalos al mapa
    // this.encargosService.getEncargos().subscribe((encargos) => {
    //   encargos.forEach((encargo) => {
    //     new mapboxgl.Marker({ color: encargo.color })
    //       .setLngLat(encargo.location)
    //       .addTo(this.map);
    //   });
    // });
  }
}
