import { Component } from '@angular/core';

interface MenuItem {
  route: string;
  name: string;
}

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styles: [
    `
      li {
        cursor: pointer;
      }
    `,
  ],
})
export class MenuComponent {
  menuItems: MenuItem[] = [
    {
      route: './fullscreen',
      name: 'Mapa',
    },
    {
      route: './encargos',
      name: 'Encargos',
    },
    {
      route: './lista_encargos',
      name: 'Lista de Encargos',
    },
  ];
}
