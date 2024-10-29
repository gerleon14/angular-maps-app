import { Injectable, OnDestroy } from '@angular/core';	///	Para servicios no funciona OnInit https://stackoverflow.com/a/41801916
import { BckapiService, MultiPageReader }		from './bckapi.service';
import { Grupo, Encargo, ENCARGO_PLANIFICACION } from './bckapi';
import { Activo, Direccion } from './bckapi';
import * as moment from 'moment';

import { CookieService } from 'ngx-cookie-service'

/** Evaluar si de verdad queremos utilizar Moment.js, tanto aquí como en el módulo para tratar los datepicker
https://inventi.studio/en/blog/why-you-shouldnt-use-moment-js
Añade peso (70KB) y otras consideraciones.
**/
// import * as moment from 'moment';

import { FormGroup, FormControl } from '@angular/forms';

import {DELAY_S, UPDATE_S, DEBUG} from './settings'

///	Constante que permitirá saber si nos estamos moviendo y los lectores deben pararse en la próxima lectura, pero aprovechando la que estén haciendo.
//	let, no var, dado que será block scope en lugar de function scope, que la convertiría en global y podría interferir con otros módulos quizá (depende de Angular o de javascript modules ¿?).
let moviendonos = false	


/**	Objeto grupo - encargos **/
class	GrupoEncargos {
	/// grupo					:Grupo; en constructor
	encargos_prog				:Encargo[];
	encargos_sinprog			:Encargo[];
	_prog_reader				:MultiPageReader;
	_sinprog_reader				:MultiPageReader;
	constructor ( statusService : StatusService, public grupo:Grupo ){
		///	Lectores
		const manager =  (o,e)=>(moviendonos?false:true)	//	Evitará próxima lectura si nos estamos moviendo
		this._prog_reader		= statusService.bckapiService.getMultiPageReader<Encargo>("encargo",  {delay_ms: 0			 , update_ms: UPDATE_S*1000 , manager:manager } )	//	Sin delay. Sólo se cargará después de inicializar el timeline, así que ya tendría un pequeño delay
		this._sinprog_reader	= statusService.bckapiService.getMultiPageReader<Encargo>("encargo",  {delay_ms: DELAY_S*1000, update_ms: UPDATE_S*1000 , manager:manager } )	
		
		///	Filtro de encargos programados
		let prog_filtro =	{
				sin_programar	: 0,
				estado_in		: ENCARGO_PLANIFICACION.join(','),
				limit			: 100,									//	Suplantamos el límite estándar de 25, pero lo ponemos bajo para que los grupos que empiezen a cargar vayan recibiendo poco a poco
				ordering		: 'fecha_programada',					//	Ordenado para que al representar los encargos sean posteriores los más a futuro y se visualizen por encima predeterminadamente
		}		
		///	Filtro de encargos no programados
		let sinprog_filtro =	{
				sin_programar	: 1,
				limit			: 100,									//	Suplantamos el límite estándar de 25, pero lo ponemos bajo para que los grupos que empiezen a cargar vayan recibiendo poco a poco
				estado_abierto	: 1,									//	Aunque estén presupuestándose
				// estado_in		: ENCARGO_PLANIFICACION.join(','),	
		}		
		///	Asignación: sólo los de este grupo. Si es null se entiende que es no asignado a nadie
		if (grupo) {
			prog_filtro		['asignado_a_id']	= grupo.id
			sinprog_filtro	['asignado_a_id']	= grupo.id
		}
		else {
			prog_filtro		['sin_asignar']	= 1
			sinprog_filtro	['sin_asignar']	= 1
		}
		///	PROGRAMADOS: Subscripción
		//	No inicializar aquí, se lanza una primera vez que configuremos el intervalo de tiempo con this.configura_intervalo
		//	Por eso no .start(... sino subscribe (subscribe devuelve la subscripción al observable, no el propio objeto como start).
		this._prog_reader
			.api_filter(prog_filtro)
			.subscribe( items=>{
				this.encargos_prog = items	
				if(DEBUG>=100)console.log("Grupo",grupo?grupo.id:null,"encargos programados cargados",this.encargos_prog)
			})
		///	SIN PROGRAMAR: Comenzamos consultas
		//	De momento no se usan las sin programarthis._sinprog_reader
		//	De momento no se usan las sin programar	.api_filter(sinprog_filtro)
		//	De momento no se usan las sin programar	.start( items=>{
		//	De momento no se usan las sin programar		this.encargos_sinprog = items	
		//	De momento no se usan las sin programar		if(DEBUG>=100)console.log("Grupo",grupo?grupo.id:null,"encargos sin programar cargados",this.encargos_sinprog)
		//	De momento no se usan las sin programar	})
		//	Sólo el primero tendrá delay
		this._sinprog_reader.delay_ms = 0
	}
	configura_intervalo (tiniapi, tfinapi) {
		let filtro_intervalo = {
			// fprg_gte		:	tiniapi,
			// fprg_lt		:	tfinapi,
			///	Consulta avanzada en servidor
			intervalo_after		:	tiniapi,
			intervalo_before	:	tfinapi,
		}
		/// Actualiza el intervalo de tiempo en las consultas de encargos programados
		this._prog_reader	.api_filter(filtro_intervalo)
		//	Debemos consultar de nuevo al servidor
		this._prog_reader	.start()	
	
	
	}
	start(prog=true,sinprog=true, ...subscribe:any[]) {
		if(prog)	this._prog_reader.start(...subscribe)
		//	De momento no se usan las sin programar if(sinprog)	this._sinprog_reader.start(...subscribe)
	}
	stop () {
		this._prog_reader.stop()
		//	De momento no se usan las sin programarthis._sinprog_reader.stop()
	}
	set update_ms (v:number) {
		this._prog_reader.update_ms = v
		this._sinprog_reader.update_ms = v
	}
	set delay_ms (v:number) {
		this._prog_reader.delay_ms = v
		this._sinprog_reader.delay_ms = v
	}
}

function date_0h ( date?:Date ) {
	/* Moment.js
	if (!date)
		return moment().startOf('day').fromNow()
	else
		return moment().startOf('day').from(date)
	/*/// Date
	if (!date)
		date = new Date()
	return new Date(date.getFullYear(), date.getMonth(), date.getDate())
	// */
}
function pad(num, size) {
	///	https://stackoverflow.com/a/2998822/3520105
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}
class	IntervaloTiempo	{
	texto:	string
	tini:	Date //moment.Moment
	tfin:	Date //moment.Moment
	width_pct:	number
	left_pct:	number
	es_ahora:	boolean
	col_fondo:	string
	
	carga (tini:Date, tpasos_num:number, tpasos_mspp:number, i:number) {
		/**
			tpasos_num:		número de pasos, con decimales
			tpasos_mspp:	milisegundos por paso, con decimales
			i:				índice del intervalo, comenzando en 0
		**/
		
		/** Confllicto Date-Moment.js: ya no es necesario porque ahora garantizamos que de this.tini salen Date
		/// Chapu por si viene como moment del datepicker, ocurrirá si hemos utilizado MatMomentAdapter en lugar de MatNative
		///	Debería, a la larga utilizarse todo moment o todo Date, mejor casi Date y apañarse, a no ser que tengamos cómputos muy complicados
		try { tini = (tini as unknown as moment.Moment).toDate() } catch {} 
		**/
		
		let resto = 1
		//	Si es el resto se indica con i == Math.trunc(tpasos_num), es decir, si teníamos 9.5 pasos e i==9 (que sería el décimo)
		if ( i >= Math.trunc(tpasos_num) ) 
			resto = tpasos_num - Math.trunc(tpasos_num)
		
		let h 	= this
		
		h.tini		= new Date(tini.getTime() + i*tpasos_mspp)//moment(tini	).add(i*tpasos_mspp		, 'ms') // copiamos, no lo modificamos
		h.left_pct  = i*(100/tpasos_num) 
		h.tfin		= new Date(h.tini.getTime() + tpasos_mspp*resto)//moment(h.tini	).add(tpasos_mspp*resto	, 'ms')
		h.width_pct = (100/tpasos_num) * resto
		
		let ahora 	= new Date()
		h.es_ahora	= ( h.tini <= ahora && ahora < h.tfin )//? (((new Date().getTime()-h.tini.getTime())*100)/((tini.getTime()+tpasos_mspp*tpasos_num)-tini.getTime())):0
		const day 		= h.tini.getDay()
		const es_finde	= (day==6 || day==0)
		//	Color del fondo
		if 		(h.es_ahora)				h.col_fondo = '#def'	//	ahora azulado
		else if (es_finde)					h.col_fondo = '#ddd'	//	Finde gris oscuro
		else if ([2,4].includes(day))		h.col_fondo = '#eee'	//	días pares gris claro
		else								h.col_fondo = '#fff'	//	días impares blanco


		/// De momento simplificamos visual de fecha
		// h.texto = h.tini.toLocaleString().split(':').slice(0,2).join(':')
		h.texto = moment(h.tini).format("DD/MM[\n]HH:mm")
		
		/* SI se usa Date
		//	Configuramos texto
		h.texto 	= ''
		let ho 		= h.tini.getHours()
		let mi 		= h.tini.getMinutes()
		///	Si cada paso es menos de 1h, ponemos los minutos
		if (tpasos_mspp < 1000*3600) 
			h.texto += ':'+pad(mi,2)
		///	Si cada paso es menos de 24h, ponemos la hora
		if (tpasos_mspp < 1000*3600*24) {
			//	Si habíamos puesto los minutos, sólo la pondremos si los minutos son 0, y separada
			if (h.texto) {
				if (!mi)
					h.texto += ' '+pad(ho,2)+'h'
			}
			else
				h.texto += pad(ho,2)+'h'
		}
		///	Si es el primero del día, o los intervalos son de más de un día, añadimos día
		if ( ( ho==0 && mi<(tpasos_mspp/(1000*60)) ) || (tpasos_mspp>=1000*3600*24)  ) {	
			let da = h.tini.getDate()
			
			h.texto += h.texto?(' '+da):da
			///	Si es el día 1, ponemos el mes
			if (da==1) {
				let mo = h.tini.getMonth()
				
				h.texto += ' /'+(mo+1)
				///	Si es el 1 de enero, ponemos el año
				if (mo==0) {
					h.texto+= ' /'+h.tini.getFullYear()
				}
			}
		}
		
		/* // Moment.js
		//	Configuramos texto
		let h_tini = h.tini.toDate()
		h.texto 	= ''
		let ho 		= h_tini.getHours()
		let mi 		= h_tini.getMinutes()
		///	Si cada paso es menos de 24h, ponemos la hora
		if (tpasos_mspp < 1000*3600*24) {
			h.texto += pad(ho,2)
			///	Si cada paso es menos de 1h, ponemos los minutos
			if (tpasos_mspp < 1000*3600) 
				h.texto += ':'+pad(mi,2)
			else
				h.texto += 'h'
		}
		///	Si es el primero del día, añadimos día
		if (ho==0 && mi == 0) {	
			let da = h_tini.getDate()
			
			h.texto += h.texto?(' '+da):da
			///	Si es el día 1, ponemos el mes
			if (da==1) {
				let mo = h_tini.getMonth()
				
				h.texto += '/'+(mo+1)
				///	Si es el 1 de enero, ponemos el año
				if (mo==0) {
					h.texto+= '/'+h_tini.getFullYear()
				}
			}
		} 
		// */
	}
}


const TRANGO_DEF_TINI = date_0h(new Date(new Date().getTime()-1000*3600*24*7))
const TRANGO_DEF_TFIN = date_0h(new Date(new Date().getTime()+1000*3600*24*8))

@Injectable({ 
  providedIn: 'root'
})
export class StatusService implements  OnDestroy {
	
	private selecgrupos_guardada:string;
	private selecgrupos_guardada_yacargada = false
	
	constructor(
		public	bckapiService: BckapiService ,
		private	cookieService:	CookieService,
	) {
		///	Leemos la cookie donde hemos guadado los grupos seleccionados
		const geg = this.cookieService.get('selecgrupos')
		this.selecgrupos_guardada 	= geg?geg:'[]'
		//	Guardaremos cada 3s el orden de grupoencargos_asignados, si es distinta
		setInterval(()=>{
			const ids = new Array<number>()
			for (let ge of this.grupoencargos_asignados)
				ids.push(ge.grupo.id)
			const listaids = JSON.stringify(ids)
			if (this.selecgrupos_guardada != listaids) {
				this.cookieService.set('selecgrupos', listaids)
			}
		}, 3000)
			
			
		///	Lector automático de grupos existentes
		this.grupos_existentes_reader	= this.bckapiService.getMultiPageReader<Grupo>	("grupo", {delay_ms: DELAY_S*1000, update_ms:UPDATE_S*1000 } )
			.api_filter({
				limit			: 1000,	//	Suplantamos el límite estándar de 25
			})
			.start(	items => { 
				///	Cargamos UNA VEZ los grupos por orden, si había selección guardada
				if (!this.selecgrupos_guardada_yacargada) {
					const ids = JSON.parse(this.selecgrupos_guardada)
					const grupos = new Array<Grupo>()
					for (let id of ids) {
						for (let g of items) {
							if (g.id == id) {
								grupos.push(g)
								break
							}
						}
					}
					this.grupos_seleccionados__asigna(grupos)
					//	Evitamos volver a cargarlo
					this.selecgrupos_guardada_yacargada = true
				}
				
				this.grupos_existentes	= items 			//	La lista cambia con cada lectura completa
				
			})

		///	GrupoEncargos para no asignados
		this.grupoencargos_sin_asignar = this.newGrupoEncargos(null)

		///	Subscribimos cambios en el tiempo: hace que actualicemos los filtros
		this.trango.valueChanges.subscribe(()=>{
			if (DEBUG>=100) console.log("trango.valueChanges $");
			this.intervalos__acttimeline()
		}) 
		
		
	}
  
	ngOnDestroy(): void {
		/**	Paramos y dessubscribimos los que estén en marcha,
			Por pulcritud, más que nada, pero no sería estrictamente imprescindible, dado que parece que el garbage collector sí recoje aunque haya subscripciones https://stackoverflow.com/a/44294453
			
			Al contrario que OnInit, OnDestroy sí es aplicable a servicios https://stackoverflow.com/a/41801916
		*/
		this.grupoencargos_sin_asignar.stop()		//	Los sin asignar
		for (let ge of this.grupoencargos_asignados)	//	Los cargados
			ge.stop()
	}
	
	
	
	/**	--- SINCRONIZACIÓN BASE DE DATOS BACKEND ---
	Enfoque BACKEND COMPUTING, no EDGE COMPUTING: el servidor nos da el color, la representación del activo y la dirección con cada encargo
	en lugar de cargar una copia de la base de datos con activos.
	Esto ralentiza en cierta medida las consultas dado que es el servidor el que tiene que buscar y componer, pero en una aplicación como
	esta que se va a utilizar sólo por entre 1 y 3 clientes simultáneamente: no afecta al servidor; permite un mantenimiento más sencillo del
	código; garantiza la coherencia entre páginas representadas por el servidor y las representadas por el frontend.
	La velocidad de las consultas la mejoraremos consultando separadamente por grupo.
	**/
	public		grupos_existentes				= new Array<Grupo>();
	public		grupos_existentes_reader		:MultiPageReader;
	
	public		grupoencargos_sin_asignar		:GrupoEncargos;			//	Leerá los encargos sin asignar, inicializado en el constructor
	public		grupoencargos_asignados			= new Array<GrupoEncargos>();	//	Leerá los encargos de los grupos seleccionados
	
	public		grupoencargos_grupo_id	(grupo_id:number) { // Puede ser undefined
									let ge;
									if (!grupo_id)
										ge = this.grupoencargos_sin_asignar
									else
										for (let gea of this.grupoencargos_asignados)
											if (gea.grupo.id==grupo_id) {
												ge = gea
												break
											}
									return ge
								}
	public		consulta_grupo_id		(grupo_id:number, prog=true, sinprog=true) {
									let ge = this.grupoencargos_grupo_id(grupo_id)
									if (ge) {
										ge.start(prog,sinprog)
									}
								}
	public		boost_grupo_id		(grupo_id:number) {
									let ge = this.grupoencargos_grupo_id(grupo_id)
									if (ge) {
										ge.update_ms	= 5*1000
										ge.delay_ms		= 10*1000
										let inidate_ms 	= new Date().getTime()
										let f = (encargos)=>{
											//	En 10 minutos cancelaremos la consulta boost al encargo, habrá hecho 120 !
											if (new Date().getTime() - inidate_ms >= 10*60*1000) {
												ge.stop()	// cancelamos todas las subscripciones, incluida esta
												ge.update_ms 	= UPDATE_S*1000
												ge.delay_ms		= 0
												ge.start()	//	Iniciamos el conteo de nuevo, ya con los valores habituales
											}
												
										}
										ge.start(f) // se subscribe a f las actualizaciones
									}
								}
	public		boost_encargo 	(encargo:Encargo) {
					/**	Hará que temporalmente se ejecuten consultas rápidas a un encargo, porque hemos abierto
					y puede que se haya cambiado. Si ha cambiado, 
					
					**/
					let enc = this.bckapiService.timer_read(new Encargo().api_assign({id:encargo.id}), 10*1000, 5*1000, 5*1000, 3600*1000, undefined, undefined, (enc,err)=>{
										let cambiado = false;
										for (let k in enc)
											if (enc[k]!=encargo[k]){cambiado=true;break;}
										if (cambiado){
											
											this.consulta_grupo_id(enc.asignado_a_id, !(!enc.fecha_programada), !enc.fecha_programada)
											if (encargo.asignado_a_id!=enc.asignado_a_id) {
												this.consulta_grupo_id(encargo.asignado_a_id, !(!encargo.fecha_programada), !encargo.fecha_programada)
											}
											this.bckapiService.stop(enc)
												
										}
											
												
									})
						
					//	En 10 minutos cancelaremos la consulta boost al encargo, habrá hecho 120 !
					setTimeout(()=>{this.bckapiService.stop(enc)}, 10*60*1000)
					
				}
	
	
	/**	--- SELECCIÓN DE GRUPOS ---
	**/
	public		grupos_seleccionados				= new Array<Grupo>();
				grupos_seleccionados__asigna	( acualmenteselec:Grupo[] ){
													if(DEBUG>=100)console.log("    Asignando nueva selección de grupos y actualizando",acualmenteselec)
													
													let nlistasel = new Array<Grupo>()
													
													///	Los que no estaban visibles, siguen seleccionados
													for (let gs of this.grupos_seleccionados)
														if (!gs.__visible) 
															nlistasel.push(gs)
													
													///	Los que nos envía el evento como actualmente seleccionados, se añaden
													nlistasel.push ( ...acualmenteselec )
													
													///	Damos validez a la lista de seleccionados
													this.grupos_seleccionados = nlistasel
													
													///	Actualizamos la lista de grupos y encargos
													this.grupoencargos_asignados__actualiza()
													
												}
				grupos_seleccionados__existe	( grupo ) {
													///	Sirve para volver a seleccionar los que lo estaban, porque al actualizar la lista en la plantilla,
													///	habremos perdido esa información
													return this.grupos_seleccionados.findIndex((g)=>g.id==grupo.id) > -1
												}
	private		grupoencargos_asignados__actualiza() {
		/** Actualiza la lista grupoencargos_asignados **/
		
		
		let ge:GrupoEncargos
		let gs:Grupo
		let nuevos = new Array<GrupoEncargos>()
		
		///	Comprobamos si estaba cargado y si no lo estaba, lo cargamos
		for (gs of this.grupos_seleccionados) {
			let loaded = false
			for (ge of this.grupoencargos_asignados) {
				if (ge.grupo.id == gs.id) {
					loaded = true
					break
				}
			}
			// console.log("vemos si esta cargado",gs, loaded)
			if (!loaded){
				//	Almacenamos el nuevo GrupoEncargos
				let nge = this.newGrupoEncargos(gs)
				this.grupoencargos_asignados.push( nge )
				nuevos.push(nge)
			}
		}
		
		
		// /* //	Borramos los que no estén seleccionados, parándolos (stop) y no incluyéndolos en nueva lista
		let ngye = new Array<GrupoEncargos>()
		for (let ge of this.grupoencargos_asignados){
			if (this.grupos_seleccionados__existe(ge.grupo))
				ngye.push(ge)
			else
				ge.stop()
		}
		this.grupoencargos_asignados = ngye
			
			
		///	Debemos actualizar los intervalos en los nuevos para que comienzen a funcionar
		this.intervalos__actgrupoencargos(nuevos)

	}

	/**	--- GETIÓN DEL TIMELINE ---
	**/
	public		intervalos				= new Array<IntervaloTiempo>();	
	public		trango					= new FormGroup({
						tini	:						new FormControl(TRANGO_DEF_TINI),
						tfin	:						new FormControl(TRANGO_DEF_TFIN), //date_0h(moment().add(1,'month')));
					},
					//	Opciones
					{ 	
						updateOn: 'change', //	Opción updateOn (change/submit/blur) -> https://fiyazhasan.me/angular-forms-validation-updateon-blur/
					},	
				)
	public		calendario_h			= new FormControl(8)
	public	get tini					() 		{ return new Date(this.trango.get('tini').value) }	///	Debemos generar nuevo Date, porque puede venir como objeto Moment.js si estamos utilizando MatMomentAdapter
	public	get tfin					() 		{ return new Date(this.trango.get('tfin').value) }	///	Debemos generar nuevo Date, porque puede venir como objeto Moment.js si estamos utilizando MatMomentAdapter
	public	set tini					(v:any) { this.trango.setValue({tini:v}) }
	public	set tfin					(v:any) { this.trango.setValue({tfin:v}) }
	public	get	tini_iso 				() 		{ let t=this.tini; 	if(t)return t.toISOString()}
	public	get	tfin_iso 				() 		{ let t=this.tfin; 	if(t)return t.toISOString()}
	public	get	tini_ms					() 		{ let t=this.tini; if(t)return (new Date(t).getTime()) }	
	public	get	tfin_ms	 				() 		{ let t=this.tfin; if(t)return (new Date(t).getTime()) }
	private		tapi					( t:Date ) {
			/** Adapta fechas a la API
			
			Con DRF y Django v3.1.1 funciona perfectamente las fechas ISO con ms y zona horaria.
			El problema es que no podemos utilizar más que Django v3.0.10 para que no se rompa la anotación
			de prioridad en la plataforma de Sertec.
				return t.toISOString()
			**/
			return t.toISOString().replace('T',' ').split('.')[0]
	}
	// Configuración de intervalos temporales
	private		tpasos_mspp				() { //	puede ser float
		let r:number;
		let ivl = this.intervalo_ms()
		
		///	Si es más de 20 días, será una franja por día
		if (ivl > 1000*3600*24*20)
			r = 1000*3600*24
		///	Si es más de 10 días, será dos franjas por día
		else if (ivl > 1000*3600*24*10)
			r = 1000*3600*12
		///	Si es más de 5 días, será una franja por cada 4 horas
		else if (ivl > 1000*3600*24*5)
			r = 1000*3600*4
		///	Si es más de 2 días, será una franja por cada 2 horas
		else if (ivl > 1000*3600*24*2)
			r = 1000*3600*2
		///	Si es más de 1 días, será una franja por cada 1 horas
		else if (ivl > 1000*3600*24*1)
			r = 1000*3600
		///	Si es 1 día o menos, cada 30 min
		else 
			r = 1000*1800
		
		return r 
	} 
	private		tpasos_num				():number  {	///	Puede ser float, 0 o NaN
		return this.intervalo_ms()/this.tpasos_mspp()
	}
	private		intervalo_ms 			() { 	///	Puede devolver 0 o NaN (que evalúa False) si uno de los límites de tiempo no está definido.
		// console.log(this.tini.value,"tini.value")
		// console.log(this.tfin.value,"tfin.value")
		// if (this.tini.value && this.tfin.value)
		// /* con Date
		let i = this.tini_ms
		let f = this.tfin_ms
		return Math.max( 0, f - i ) // Puede ser NaN
		/*/ //	Moment
		return moment(this.tfin.value).diff(moment(this.tini.value))
		// */
	}
	
	public		intervalos__actgrupoencargos ( ges:GrupoEncargos[] ){
				//	No tiene efecto si no hay intervalo bien configurado
				const pasos			= this.tpasos_num()		//	float o NaN
				if (pasos) {
					const mspp		= this.tpasos_mspp()	//	float (ya no podría ser NaN puesto que pasos no lo es)
				
					/// Actualiza el intervalo de tiempo en las consultas
					///	Utilizaremos un margen a cada lado del 100% del intervalo actual (50% de los pasos que hay)
					// 	/*	Podríamos no usar margen, desde que tenemos la consulta avanzada 'intervalo' en el servidor (ver GrupoEncargos.configura_intervalo)
						//	Pero es conveniente para que el movimiento hacia los lados sea rápido y no requiera esperar a otra consulta.
					const margen_ms	= (pasos * mspp) 
					const tiniapi		=	this.tapi(new Date(this.tini.getTime()-margen_ms))
					const tfinapi		=	this.tapi(new Date(this.tfin.getTime()+margen_ms))
					/*/
					const tiniapi		= 	this.tapi(this.tini)
					const tfinapi		= 	this.tapi(this.tfin)
					// */
					for (let ge of ges){
						ge.configura_intervalo(tiniapi,tfinapi)
						// console.log(ge)
					}
				}
	}
	private		intervalos__acttimeline_timer;
	private		intervalos__acttimeline	(delay_ms = 250, ges?:GrupoEncargos[]) {
		// console.log("    -----")
		//	Tendremos una nueva lista de intervalos
		const invls	= new Array<IntervaloTiempo>()
		
		///	Si no hay pasos es que no está configurado el rango de fechas, no podemos saber el intervalo y se borrará.
		const pasos			= this.tpasos_num()		//	float o NaN
		if (pasos) {
			const mspp		= this.tpasos_mspp()	//	float (ya no podría ser NaN puesto que pasos no lo es)
		
			// console.log('intervalos__acttimeline')
			
			//	Pasamos también el intervalo resto en caso de pasos ser float (por eso .ceil), IntervaloTiempo.carga considerará si es el resto o no.
			for (let i of new Array(Math.ceil(pasos)).keys()) {
				let ni = new IntervaloTiempo()
				ni.carga( this.tini, pasos, mspp, i )
				invls.push(	ni )
			}
			
		}
			
		///	Detectamos si es la primera vez que cargamos los intervalos, en cuyo caso no habrá retraso al actualizar el intervalo en grupoencargos
		const  primeravez = (this.intervalos===undefined)
		///	Ya tenemos la lista de intervalos que se utilizará, puede estar vacía si el rango de tiempo no estaba bien especificado
		this.intervalos = invls
		
		
		///	Si estamos moviéndonos, debemos evitar que lectores se disparen para ello marcamos la variable global moviendonos,
		///	que los detendrá de manera ordenada antes de la próxima lectura, pero sin estropear la que esté en curso.
		moviendonos = true
		///	Las actualización del intervalo en consultas lo haremos con retraso, para evitar hacer procesamiento
		///	innecesario si se actualiza intervalos__acttimeline dentro de poco (start anula órdenes de start anteriores).
		clearTimeout(this.intervalos__acttimeline_timer)
		// console.log("------------------------------",this.intervalos)
		this.intervalos__acttimeline_timer = setTimeout(()=>{
			/// Actualiza el intervalo de tiempo en las consultas
			this.intervalos__actgrupoencargos ( [this.grupoencargos_sin_asignar] )
			this.intervalos__actgrupoencargos ( this.grupoencargos_asignados	 )
			///	Marcamos que ya no nos movemos
			moviendonos = false
		}, primeravez?0:delay_ms)
	}
	public		intervalo__para			()											{ this._intervalo__mueve_orden = null }
	public		intervalo__mueve		(orden?:string,pct?:number,next_ms?:number)	{ this._intervalo__mueve_orden = {orden:orden,pct:pct,next_ms:150};this._intervalo__mueve()} // la primera repetición tardará más que las siguientes (150 vs ...)
	private		_intervalo__mueve_orden:{orden:string,pct?:number,next_ms?:number};
	private		_intervalo__mueve		()	{
				// console.log('moviendo')
				
				//	Si hay orden vigente, ejecutamos
				if (this._intervalo__mueve_orden) {
					let orden 	= this._intervalo__mueve_orden.orden
					let pct		= this._intervalo__mueve_orden.pct
				
		
					let ivlms = this.intervalo_ms()
					if (ivlms) {
						
						let ntinims
						let ntfinms
						
						///	Si la orden es centrar
						if (orden=='|') {
							const ahora = new Date().getTime()
							ntinims	= ahora-ivlms/2
							ntfinms	= ahora+ivlms/2
						}
						///	Si la orden es anular zoom y desplazamiento
						else if (orden=='·') {
							ntinims	= TRANGO_DEF_TINI.getTime()
							ntfinms	= TRANGO_DEF_TFIN.getTime()
						}
						///	Si la orden es hoy
						else if (orden=='hoy') {
							ntinims	= date_0h(new Date()).getTime()
							ntfinms	= ntinims + 1000*3600*24
						}
						///	Si la orden es sem o mes
						else if (orden=='sem' || orden=='mes') {
							const ahora = new Date()
							let		dia_1a7	= ahora.getDay()// 0=domingo
							dia_1a7=(dia_1a7==0)?1:dia_1a7+1 
							const dias_a_restar_para_lunes = dia_1a7 - 1
							ntinims	= date_0h(ahora).getTime() - dias_a_restar_para_lunes*1000*3600*24
							ntfinms	= ntinims + 1000*3600*24*(orden=='sem'?7:31)
						}
						///	Si es desplazar o zoom
						else {
						
							let movms;
							
							if (!pct)
								movms = this.tpasos_mspp()
							else
								movms = (pct*ivlms)/100
							
							ntinims = this.tini_ms
							ntfinms = this.tfin_ms
							
							
							if (orden=='<') {
								ntinims -= movms / 2
								ntfinms -= movms / 2
							}
							else if (orden=='>') {
								ntinims += movms / 2
								ntfinms += movms / 2
							}
							else if (orden=='+') {
								ntinims += movms 
								ntfinms -= movms 
							}
							else if (orden=='-') {
								ntinims -= movms 
								ntfinms += movms 
							}
						}
						
						///	Sólo valdrá si fin-ini > 12 horas
						if (ntfinms-ntinims>=1000*3600*12) {
							
							///	Actualizamos el rango de tiempo sin disparar el evento
							///	Esto no quiere decir que no se disparará, sino que se disparará una vez menos.
							///	De hecho se disparará al menos 2 veces porque al actualizar el widget será este quien lo lanze.
							///	Como en FormGroup hemos dicho que sólo updateOn submit, se actualizará sólo una vez
							///	por cada cambio de los valores en FormGroup, esto es, 2.
							///	Por ello intervalos__acttimeline sí será llamado, 2 veces.
							this.trango.setValue(
								{
									tini:	new Date( ntinims ),
									tfin:	new Date( ntfinms ),
								},
								///	Opciones: no disparamos automáticamente el cambio, para evitar múltiples reverberaciones. Actualizamos a mano el intervalo.
								{
									emitEvent: false
								}
							)
						}
					}
					//	Seguimos dentro de X ms según vengan configurados
					setTimeout( ()=>this._intervalo__mueve(),this._intervalo__mueve_orden.next_ms ) // undefined para que cuente como no primera orden
					//	Próximas repeticiones serán de 50 ms
					this._intervalo__mueve_orden.next_ms = 50
				} 
	}
	public		encargo_carga_situacion_en_intervalo (e:Encargo) { // modificará el encargo para añadirle info en variables privadas __ que no se mandarán
		let ancho_ms 	= (e.horas_estimadas?e.horas_estimadas:1) * 3600*1000 *(24/this.calendario_h.value)
		let ivl			= this.intervalo_ms()
		
		///	Porcentaje del intervalo
		e.__width_pct	= ivl?((100*ancho_ms)/ivl):undefined

		let tini_ms		= this.tini_ms
		
		// console.log("fecha_programada",typeof e.fecha_programada,e.fecha_programada)
		let fprg		= e.fecha_programada?(new Date(e.fecha_programada)):undefined
		let fprg_ms		=fprg?(fprg.getTime()):undefined
		
		///	Posición en el intervalo, y posición de superposición z-index de -2000 a -1000 para los que están en el intervalo (los demás se entiende que no se representarán)
		if (fprg_ms!==undefined && ivl) {
			let left_ms		= fprg_ms - tini_ms
			e.__left_pct	= (100*left_ms)/ivl
			e.__zindex		= undefined//-2000+Math.trunc(e.__left_pct*10)
		}
		else {
			e.__left_pct	= undefined
			e.__zindex		= undefined
		}
		
		if (DEBUG>=100)	console.log("encargo con sit. en intervalo:",e)
		
		///	Guardamos visualización de fecha programada y enlace a modificación
		e.__fprgfmt 	= fprg?(fprg.toLocaleDateString()):undefined
		
		e.__href		= new URL('gmao/encargo/'+e.id+'/change/',location.origin).href
		
		return e
	}
	public		encargos_carga_situaciones_en_intervalo(es:Encargo[], filtrar=true)  { 
		/**
			filtrar:	devolverá nueva lista sin los que sean visibles en el intervalo actual
						si false, devolverá la misma lista, pero con la información de situación cargada, si disponible.
		*/
		/// modificará los encargos para añadirles info en variables privadas __ que no se mandarán
		// console.log("encargos: ",es)
		if (es)	{ //	Puede venir undefined
			for (let e of es) {
				this.encargo_carga_situacion_en_intervalo(e)
			}
			
			
			if (filtrar) {
				let nes = new Array<Encargo>()
				for (let e of es)
					if (!(e.__left_pct===undefined || e.__left_pct >= 100 || e.__width_pct <= 0 || (e.__left_pct+e.__width_pct <= 0) ))
						nes.push(e)
				return nes
			}
		}
		
		return es
	}
	
	
	
	/**	--- UTILITIES --- **/
	public		random ( max:number ) {
		return Math.trunc(Math.random()*max)
	}

	public		newGrupoEncargos( grupo:Grupo) { return new GrupoEncargos(this, grupo) }
}
