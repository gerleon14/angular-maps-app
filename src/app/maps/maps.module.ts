import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MapsRoutingModule } from './maps-routing.module';
import { MinMapComponent } from '../min-map/min-map.component';
import { FullScreenComponent } from '../full-screen/full-screen.component';
import { EncargosComponent } from '../encargos/encargos.component';
import { ListaEncargosComponent } from '../lista_encargos/lista_encargos.component';


@NgModule({
  declarations: [
    MinMapComponent,
    FullScreenComponent,
    EncargosComponent,
    ListaEncargosComponent
  ],
  imports: [
    CommonModule,
    MapsRoutingModule
  ]
})
export class MapsModule { }
