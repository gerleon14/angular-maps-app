import { Directive, ElementRef, HostListener  } from '@angular/core';
/// REF: https://angular.io/guide/attribute-directives



@Directive({
  selector: '[appVistaSelecgrupos]'
})
export class VistaSelecgruposDirective {

	constructor(private el: ElementRef) { 

	}
	@HostListener('mouseenter') onMouseEnter() {
												this.abierto(true);
											}
	@HostListener('mouseleave') onMouseLeave() {
												this.abierto(false);
											}

  
	private abierto(a:boolean) { 
		let sels = this.el.nativeElement.style
		
		let pans = document.getElementById('panel').style
		
		// console.log('abierto',a)
		
		if (a) {
			sels.height = '30%'
			pans.height = 'calc(100% - 0.15rem - 4rem - 30%)'
			// sels.flex = '0 0'
		}
		else {
			sels.height = '2rem'
			pans.height = 'calc(100% - 0.15rem - 4rem - 2rem)'
			// sels.flex = '0 0'
		}
		
	}

}
