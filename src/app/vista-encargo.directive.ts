import { Directive, Input, ElementRef, HostListener } from '@angular/core';
/// REF: https://angular.io/guide/attribute-directives

@Directive({
  selector: '[appVistaEncargo]'
})
export class VistaEncargoDirective {
	
	@Input()		encargo; 
	
	constructor( private el: ElementRef ) { }
	@HostListener('mouseenter') onMouseEnter() {	this.abierto(true );	}
	@HostListener('mouseleave') onMouseLeave() {	this.abierto(false);	}
	
	public abierto(a:boolean) { 
		///	Estilo del concunto marcador-encargo (1) y del encargo (2)
		let style1 = this.el.nativeElement.style
		let style2 = this.el.nativeElement.lastChild.style 
		
		// let pans = document.getElementById('panel').style
		
		// console.log('abierto',a)
		// console.log(this.encargo)
		
		if (a) {
			// console.log(this.encargo)
			// console.log(this.el)
			// console.log(sels.width)
			// return
			
			///	Guardamos estilos que retocaremos
			for (let k of [
				'left',
				// 'width',
				// 'height',
				// 'overflow',
				'z-index', 
			]){
				this.memo.style1[k] = style1[k]
			}
			for (let k of [
				'overflow',
				'background-color',
				'width',
				'border',
				// 'left',
			]){
				this.memo.style2[k] = style2[k]
			}
			
			style1['z-index']			= 9999							//	Encima de todo
			style2['overflow']			= 'visible'		
			style2['background-color']	= 'rgba(255,255,255,.8)'		
			style2['width']				= 'min-content'		
			style2['border']			= 'solid .1em #000'		
			//	Ver si debemos mover el encabezado
			let me = this.moverencabezado()
			// console.log(me)
			if (me) {
				style1.left = me + '%'
				// style2.left = me + '%'
				// style.width = 'calc(' + style.width + ' - ' + me + '%)'
				// style['border-left'] = 'none'
			}
			//	Modificamos ancho real si lo requiere
			// let aw = this.ampliarwidth()
			// if (aw) {
				// style.width = aw
				// sels['border-right'] = 'none'
			// }
		}
		else {
			//	Recuperamos estilo al salir
			Object.assign(style1, this.memo.style1)
			Object.assign(style2, this.memo.style2)
		}
	}


	///	Almacén de estados de este objeto
	memo =	{
				style1:{},	//	Estilo del elemento principal
				style2:{},	//	Estilo del contenido
			}
	
	private	ampliarwidth () {		///	Devuelve el tamaño que deberá tener la anchura en string y configurado como píxeles
		let pxinteriorsinmarg = this.el.nativeElement.clientWidth	// https://developer.mozilla.org/es/docs/Web/API/Element/clientWidth
		if (pxinteriorsinmarg < 100)
			return '100px'
	}
	private	moverencabezado () {	///	Devuelve el % a restar a la anchura, en número positivo.
		// /* Si modificábamos posición del encargo y no del contenido
		if (this.encargo.__left_pct < 0)
			return (-this.encargo.__left_pct)
		/*/	Si movemos el contenido
		if (this.encargo.__left_pct < 0)
			return ( (this.encargo.__left_pct * -100) / this.encargo.__width_pct )
		// */
	}
	
	
}
