import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FullScreenComponent } from './pages/full-screen/full-screen.component';
import { EncargoComponent } from './pages/encargos/encargos.component';
import { ListaEncargosComponent } from './pages/lista_encargos/lista_encargos.component';

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
        component: EncargoComponent,
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
