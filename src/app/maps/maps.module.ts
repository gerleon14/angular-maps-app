import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MapsRoutingModule } from './maps-routing.module';
import { MinMapComponent } from './components/min-map/min-map.component';
import { FullScreenComponent } from './pages/full-screen/full-screen.component';
import { EncargoComponent } from './pages/encargos/encargos.component';
import { ListaEncargosComponent } from './pages/lista_encargos/lista_encargos.component';


@NgModule({
  declarations: [
    MinMapComponent,
    FullScreenComponent,
    EncargoComponent,
    ListaEncargosComponent
  ],
  imports: [
    CommonModule,
    MapsRoutingModule
  ]
})
export class MapsModule { }
