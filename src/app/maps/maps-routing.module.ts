import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FullScreenComponent } from '../full-screen/full-screen.component';
import { EncargosComponent } from '../encargos/encargos.component';
import { ListaEncargosComponent } from '../lista_encargos/lista_encargos.component';

const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'fullscreen',
        component: FullScreenComponent,
      },
      {
        path: 'markers',
        component: EncargosComponent,
      },
      {
        path: 'lista_encargos',
        component: ListaEncargosComponent,
      },
      {
        path: '**',
        redirectTo: 'fullscreen',
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MapsRoutingModule {}
