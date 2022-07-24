import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MapsRoutingModule } from './maps-routing.module';
import { MinMapComponent } from './components/min-map/min-map.component';
import { FullScreenComponent } from './pages/full-screen/full-screen.component';
import { ZoomRangeComponent } from './pages/zoom-range/zoom-range.component';
import { MarkersComponent } from './pages/markers/markers.component';
import { PropertiesComponent } from './pages/properties/properties.component';


@NgModule({
  declarations: [
    MinMapComponent,
    FullScreenComponent,
    ZoomRangeComponent,
    MarkersComponent,
    PropertiesComponent
  ],
  imports: [
    CommonModule,
    MapsRoutingModule
  ]
})
export class MapsModule { }
