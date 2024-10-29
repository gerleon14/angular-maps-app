/** 
SERVICIO BckapiService, para comunicación con backend

Idealmente, debería poder reutilizarse como módulo Angular
https://stackoverflow.com/questions/40089316/how-to-share-service-between-two-modules-ngmodule-in-angular-not-between-to-c

Código reutilizable - sólo para desarrolladores 


**/

import { Injectable } from '@angular/core';
import { HttpClient	} from '@angular/common/http';
import { Observable, of , timer, fromEvent, throwError, Subject, Subscription } 	from 'rxjs'; 
import { catchError, mergeAll, concatMap  }							from 'rxjs/operators';

import { BCKAPI_ROOT, BCKAPI_ROOT_UPDATE_S, DEBUG_BCKAPI	 } 	from './settings';
import { BACKEND_MOCK } 			from './bckapi.mock'


/** Clases BASE de objetos API
podrán ser implementadas en nuevas clases.
**/
export abstract class 	ApiBase 											{
	/** ApiBase, clase base de cualquier clase de la API.
	Provee métodos y propiedades necesarios para la interacción con el servidor backend y, en conjunto con BckapiService,
	define los procedimientos para ello.
	
	Palabras reservadas que no se podrán utilizar para nombres de propiedades de los objetos backend:
	- Todas las que empiecen por "api_":	pueden colisionar con nombres del propio bckapi framework.
	- Todas las que empiecen por "_":		se recibirían pero no se transmitirían desde el frontend.
	
	
	Uso:
		Una vez asignada la ruta, no se puede cambiar su base, porque sería como cambiar el tipo de objeto.
		
		Asignación de ruta completa:
			Cada clase ApiBase define un método get api_path que debe devolver la ruta a la API sin el id del elemento.
			
			obj.api_href = 'xxxxx/yyyyy/zzzzz/' (opcionalmente / al final)
			Si la última parte (zzzzz) es un número, lo interpretará como id del objeto.
		Asignación de id del objeto:
			Normalmente con esto bastará dado que no será necesario localizar por ruta completa (cada clase al lleva ya en api_path)
			obj.id   = 9999
			
	
	**/
	
	/** Identificador del recurso: api_name y/o api_path
	api_name:	proveerá el nombre del recurso en la API. Clase abstract: debe definirlo cada clase de la API. Si no lo define, deberá suplantar api_path.
	api_path:	ruta del recurso, que puede ser relativa (si está hard coded en las clases ApiBase de bckapi, o absoluta, si se ha obtenido su ruta
				completa automáticamente, mediante BckapiService.root y su api_name. Si no se hubiese aportado api_name en algunas
				clases de la API, éstas deberían suplantar api_path y establecer su propia ruta al recurso, completa o relativa.
	**/
	public 			get		api_name	()				:string {	return undefined	};		//	Suplantable por clases derivadas: especifican el nombre (hard coded) y de ese modo son capaces de encontrar el recurso en ApiRoot
	public 			get		api_path	()				:string	{								//	Suplantable por clases derivadas: especifican directamente la ruta relativa
											//	No necesitamos comprobarlo, tanto si api_name es undefined como si no existe en root, devolverá undefined // if (this.api_name && BckapiService.root.api_loaded())
											return BckapiService.root[this.api_name]	
										}	
	public 			get		api_path_as_url	()			:URL	{		
											/** Monta URL con datos del api_path si está disponible, si no, undefined.
											Aportará nuestro origin si api_path es relativo **/
												let path = this.api_path
												if (path) {
													
													let url:URL;
													
													// Intentamos montar la URL, pasando nuestro origen que se utilizará si no lo trae.
													try {
														url = new URL(path, location.origin)
													} catch {
														return // si error, undefined
													}
													
													return url
												}
										}	
	
	/* api_error y ApiError eliminados /**	Identificación de errores: api_error
	Si en las comunicaciones se tiene la precaución de utilizar ApiError como fallback en caso de problemas (es lo predeterminado), bastará con consultar a cualquier
	objeto por x.api_error para saber si se trata de un error de comunicación con la Api. Obviamente ApiError lo suplanta para devolver true.
	public 			get		api_error	()				:boolean{ 	return false						}
	**/
	
	/** Identificador del objeto
	El no tener una propiedad 'id' viene bien, porque al transformar el objeto en JSON no figurará 'id' sino '_id', 
	y el backend no reasignará accidentalmente la id del objeto ni lo sobreescribirá si se ha cambiado, dado que usará unicamente el api_href entero para escribir.
	Al recibir, si el objeto nos manda un id, sí lo sobreescribiremos, pero SIEMPRE coincidirá con el de api_href, ya que se lo estamos pidiendo mediante el api_href entero.
	**/ 
	public			get 	api_id		()	:string|number			{ 
											/** Obtiene id (última parte del path), sólo disponible si ya está inicializado el objeto
											con api_href asignado.
											**/
											
											if (!this.__api_url)
												return undefined
											
											let parts = this.__api_url.pathname.split('/'); 
											while (parts.length){
												let x = parts.pop()
												if (x) {
													// console.log(`DEBUG ApiBase.api_id ${x}`)
													return x
												}
											}
											return undefined
	
										}
	public			set		api_id		(id:string|number)			{ 
											/**Asigna id (última parte del path)
											Si ya tenemos una referencia asignada, no lo reconoce y avisa del error, sólo podremos modificar la referencia al objeto creando uno nuevo.**/
											if (!this.__api_url){
												let npath = this.api_path
												if (!npath.endsWith('/'))
													npath += '/'
												npath += id +'/' // se convierte a string si es número
												// Intentamos montar la URL, aportamos nuestro origin por si es relativo
												this.__api_url = new URL(npath, location.origin)
											} else {
												//	throw no para el cambio de tipos, ya que no es seguro en tipo (typesafe). Se podría solucionar https://dev.to/_gdelgado/type-safe-error-handling-in-typescript-1p4n
												//	Pero de momento no nos hace falta, con que salga el problema en consola y evitamos el asignar, es suficiente.
												throw new Error(`No se puede reasignar la id de un objeto Api ya inicializado: ${this.api_id} por ${id}.`);
											} 
										}
										
	/** Identificador HyperLink: api_resource, api_url, api_href
	Métodos que identifican la consulta del objeto en el backend, incluyendo parámetros de consulta específicos.
	Si no está especificado sólo podremos acceder a él en el caso de objetos que no requieren id (como las ApiList), donde api_id debe devolver null.
	**/									
	public			get		api_resource()	: string {
											/** HyperLing de ruta del objeto, como api_href, pero sin los parámetros concretos de búsqueda
											Sirve para identificar a qué recurso de la API se refiere este objeto exactamente.
											Esto es útil para, por ejemplo, saber si dos objetos se refieren al mismo recurso aunque tengan distintos parámetros de búsqueda.
											**/
		
											let url = this.api_url
											if (url) {
												let r = url.origin + url.pathname
												return (r.endsWith('/')?r:(r+'/')) // mantenemos la coherencia: siempre debe acabar con /
											}
	}
	public			set		api_resource(href:string) {
											/** La diferencia con api_href es que borrará los parámetros de búsqueda si los hay **/
											this.api_href = href
											this.api_filter_delete() 
	}
	private					__api_url		: URL;
	public			get		api_url		()	: URL	{ 
											/** Objeto URL con la ruta completa, incluyendo parámetros de búsqueda **/
											
											/* DEBUG
											console.log(`DEBUG ApiBase.api_url - ${this.__api_url} - ${this.api_path_as_url} - ${this.api_path} - ${this.api_id}`)
											// console.log(BckapiService.root)
											// */
											
											//	Si existe y es válida, se devuelve 
											///	Las no válidas son creadas sólo para incorporar filtros. Se inicializan como dummy, con 'ftp://n'
											if (this.__api_url && this.__api_url.hostname!='n')
												return this.__api_url
											//	Si no está especificada, sólo devolveremos en el caso en que api_id devuelva null
											//	lo que indica que no se usa (es una ApiList o similar) y por tanto sí es consultable
											//	y la podemos cargar en memoria, por si acaso hay modificaciones en sus parámetros.
											if (this.api_id===null) {
													
												//	Asigna la nueva url basada en configuración api_path, si puede
												let nurl = this.api_path_as_url // puede ser undefined
												
												//	Si tenemos nueva url la asignamos preservando posibles filtros de una inicialización dummy
												//	y la devolvemos
												if (nurl) {
													this.api_url_preserve_filter = nurl
													return this.__api_url
												}
											}
											//	Si id !== null somos un objeto api con id, y no la tenemos así que devolvemos undefined
										}
	public			set		api_url		(url:URL) 	{ 
											/** Establece nueva url para el objeto (copia de la aportada), comprobando que sea compatible:
												- Si no está especificada.
												- Si no redirige a otro recurso API. Sí está permitido cambiar parámetros de búsqueda.
											**/
											
											/**	Comprobamos que sea válida para este objeto.
												Si no teníamos, la comparamos con la nuestra (NO con _api_href, sino la procesada api_href, porque ya habrá considerado si el tipo de objeto
												es adecuado para disponer de ella de modo implícito (si api_id===null)
												Si coincide el origin+pathname con el esperado (aunque sea poniendo o quitando el último /). Esto es que coincide el api_path y el id, si tiene.
												No alteramos los posibles parámetros de búsqueda que incluya
											**/
											let origurl = this.api_url
											//	Si no teníamos, podríamos asignarla en principio, pero debemos comprobar que la aportada comienza por esa ruta (el resto sería id+search)
											if (!origurl) {
												//	Intentamos montar la dirección del recurso desde api_path
												origurl = this.api_path_as_url
												if (origurl) {
													let origurlcomp = origurl.origin + origurl.pathname	//	Podríamos aceptar que origin fuese case insensitive como lo es (añadiendo .toLowerCase()) pero decidimos no aceptarlo.
													if (!origurlcomp.endsWith('/')) origurlcomp += '/'
													let urlcomp		= url	 .origin + url	  .pathname	//	Podríamos aceptar que origin fuese case insensitive como lo es (añadiendo .toLowerCase()) pero decidimos no aceptarlo.
													if (!urlcomp	.endsWith('/')) urlcomp		+= '/'
												
													// Si la nueva url empieza por la nuestra, todo correcto
													if (urlcomp.startsWith(origurlcomp)) {
														///	Si se había configurado sólo filtros, los respetaremos si no se suplantaron
														this.api_url_preserve_filter = url
													}
													else
														throw new Error(`API object error changing api_href to "${url.href}": not compatible with path settled to "${origurl}.`);
												} else {
													throw new Error(`API object error setting api_href to "${url.href}": cannot get path for object from the API.`);
												}
											//	Si teníamos, comparamos, y la ruta (sin search pero con id, que está incluido en pathname) debe coincidir exactamente.
											} else { 
												let origurlcomp = origurl.origin + origurl.pathname	//	Podríamos aceptar que origin fuese case insensitive como lo es (añadiendo .toLowerCase()) pero decidimos no aceptarlo.
												if (!origurlcomp.endsWith('/')) origurlcomp += '/'
												let urlcomp		= url	 .origin + url	  .pathname	//	Podríamos aceptar que origin fuese case insensitive como lo es (añadiendo .toLowerCase()) pero decidimos no aceptarlo.
												if (!urlcomp	.endsWith('/')) urlcomp		+= '/'
												
												// Si coincide con nuestra ruta url principal (en definitiva api_path y api_id), la aceptaremos sin intervenir en parámetros de búsqueda
												if (origurlcomp == urlcomp)
													this.__api_url = new URL(url.href) // aquí no respetamos los filtros, ya existía
												else
													throw new Error(`API object error changing api_href to "${url.href}": not compatible with settled "${origurl}.`);
											}
											
										
										
										}										
	public			set		api_url_preserve_filter		(url:URL) 	{ 
											//	Asignaremos copia
											let nurl:URL = new URL(url.href) 
											
											///	Si se había configurado filtros, los respetaremos si no se suplantaron
											if (this.__api_url) {
												///	Si teníamos filtro (búsqueda) configurados, lo respetamos
												/* errores raros, como que no tiene keys
												for (let p of this.__api_url.searchParams.keys()) 
													if (!nurl.searchParams.has(p)) 
														nurl.searchParams.set(p,this.__api_url.searchParams.get(p))
													*/
												// console.log(this.__api_url.href)
												nurl.search = this.__api_url.search
											}
											
											//	Finalmente asignamos
											this.__api_url = nurl
										}
	public			get		api_href	()				:string	{ 
											/** HyperLink que identifica la consulta del objeto en el backend, incluyendo parámetros de consulta específicos.
											Si no está especificado sólo podremos acceder a él en el caso de objetos que no requieren id (como las ApiList), donde api_id debe devolver null.
											**/									
											let url = this.api_url
											if (url)
												return url.href
										}
										
	/** Importador de HyperLink
	Una vez asignados, no se puede cambiar ni la ruta relativa del objeto en la api, ni la id (si está especificada tanto con número como si es null).
	Sí se pueden cambiar los parámetros asociados de búsqueda (_api_href.search).
	href debe contener una ruta completa válida, con origin.
	**/
	public			set		api_href	(href:string)		{ 
											let url:URL;
											// Intentamos montar la URL a partir del valor aportado, aportamos nuestro origin por si relativo
											try {
												url = new URL(href, location.origin)
											} catch {
												throw new Error(`API object error setting api_href "${href}": not valid.`);
												return
											}
											this.api_url = url; // con las comprobaciones de set api_url
										}
	/** api_assign: makes possible to create new ApiBase with initialization location data when they are used in the context of RxJS observables.
	In such cases, when a constructor is used, the object is created before the actual initialization data is available, resulting in an
	no initialized object. For example: 
		In a ..._observable.subscribe function, we would instantiate an ApiBase with
			let x = new ApiObjectX().assign(inidata)	//	This would result in an initialized ApiBase, with inidata.
		instead of
			let x = new ApiObjectX(inidata)				//	This would result in an uninitialized ApiBase.
	No assign in constructor: in order to avoid the race condition during initialization with external data (as said), we prefer to disable
	the posibility of initializate data in the constructor: constructor ( inidata?:ApiBase|object|number|string|URL  ) {	this.assign(inidata) }
	**/
	public 		 			api_assign 		( loc?:ApiBase|object|number|string|URL, is_id=false ) { 	
												/** Asigna propiedades o localización en la API, para este objeto ya creado.
												loc: 	API location information, one of
													number:		would be the id of the object in the API
													string:		href of the object in the API unless is_id is true, when it would be an id (id in backend could be string).
													URL:		href of the object in the API.
													ApiBase: 	properties of the object, and maybe location information, since ApiBase objects may contain it if they are located.
													object:		properties of the object.
												is_id:	only apply when loc is a string. loc will be treated as an id of the object, not the href.
												**/
												//	Si es un número entero mayor que 0, es la id (aunque venga en formato string)
												if (loc) {
													
													let num = Number(loc)
													
													if (num > 0)// && isInt(num)) 		// Number devolverá NaN si no es un número válido
														this.api_id = num		// no a _id, para no saltarnos la anulación de ApiList con _id:never
													//	Si es un texto o URL, es el hyperlink a la API, a no ser que is_id==true, cuando se entiende que es sólo la id.
													else if (typeof loc === "string") {
														if (is_id)
															this.api_id = loc
														else
															this.api_href = loc
													}
													else if (loc instanceof URL)
														this.api_href = loc.href
													//	Si no, si hay datos, es un objeto del que copiaremos las propiedades.
													else if (loc)
														Object.assign (this,loc); 
													
												}
												//	Devolvemos una instancia de nosotros mismos, para poder utilizar assign durante la construcción.
												return this;	
											}
	public 		 			api_copy		( loc?:ApiBase|object|number|string|URL, is_id=false ) { return Object.create (this).api_assign(loc, is_id); 
											}
	public 		 			api_filter		( filter?:object  ) {
												/** Añadirá nuevo filtro de búsqueda 
												Permite añadir filtros con api_url sin configurar, inicializándola con 'ftp://n'.
												
												Respuesta:
													Devuelve instancia this para poder utilizarlo directamente durante creación.
												Parámetros:
													filter:	Objeto con filtros de búsqueda configurados. Ej.: {a:1, b:2}
															Permitimos undefined para que se pueda utilizar con variables cuyo valor desconocemos
												*/
												if (filter) {
													let url = this.api_url;  // Puede ser inferida de api_path
													if (!url) {
														/* ya podemos filtrar al inicio creando una url falsa temporal (no hará que api_url devuelva la falsa). //	Si no estamos configurados con url, no podemos filtrar
														throw new Error(`API object cannot be filtered if unconfigured. If this is an ApiList, wait for the API to be loaded. If not, set the id. `)
														return this
														*/
														if (!this.__api_url)
															this.__api_url = new URL('ftp://n')
														
														url = this.__api_url
													}
													
													for (let k in filter)
														url.searchParams.set(k,filter[k])
													
													/* Innecesario ¿a qué venía? api_url devuelve referencia a la URL real interna
													// Guardamos url directamente sin hacer comprobaciones. Podemos hacerlo porque viene
													//	de .api_url
													//	Necesitamos volverla a asignar porque puede venir deducida de api_path, no de _api_href
													this.__api_url = url
													*/
												}
												
												//	Devolvemos instancia nuestra
												return this
											}
	public 		 			api_filter_delete () {
												//	Como estamos borrando podemos usar __api_url, y debemos, por si estamos alterando una url sin inicializar del todo (sólo los filtros).
												//	si no estaba cargado ya, no lo cambiamos, sólo querríamos borrar parámetros si estubiese cargado.
												let url = this.__api_url; 
												if (url){
													url.search=''
												}
												return this
											}

	///	Monitoriza el estado del objeto, si está configurado en alguna función automática o similar
	private					__api_status?:string;
	public			get		api_status	():string		{ return this.__api_status  }
	public			set		api_status	(s:string) 		{ this.__api_status=s  }
	/* ya no, seguimos con registro principal de errores private					__api_errors?:string;
	public			get		api_errors	():string		{ return this.__api_errors  }
	public			set		api_errors	(s:string) 		{ this.__api_errors=s  }*/
}
export abstract class	ApiBaseNoId						extends ApiBase 	{
	/** ApiBase: para modelos de la API que no necesitan id ni pueden llevarla, como listas. */
	
	public		 			id			:never; 							// No puede tener nunca una id
	public			get 	api_id	()	:string			{ return null; }	// Devuelve null para indicar que no puede tener id
	public			set 	api_id	(id:string)			{ throw new Error(`No se pede asignar un api_id a un objeto ApiList.`) }
}
export abstract class 	ApiListBase <T extends ApiBase>	extends ApiBaseNoId {
	/** ApiList, clase abstracta de ApiBase, que provee métodos universales para las consultas de listados rest-framework.
	Es genérica por lo que se pueden construir nuevas clases a partir de ella, específicas para las listas de elementos del backend
	y mantener un estricto control de tipos en los resultados.
	Si no es necesario un control de tipos tan estricto, existen ApiList y ApiListP, listas que sirven para cualquier objeto ApiBase.
	
		Ejemplos:
			export class	GrupoList		extends ApiListBase<Grupo		>	{	get api_name () { return 'grupo'			} }
			export class	EncargoList		extends ApiListBase<Encargo		> 	{	get api_name () { return 'encargo'			} }
			
	**/
						
	public		 			count		:number	=undefined;
	public		 			next		:string	=undefined;
	public		 			previous	:string	=undefined;
	public		 			results		:T[]	=undefined;
	
	// public static readonly 	ApiObject 	= T;
}

/** Clases de objetos API para utilizar directamente, sin necesidad de crear clases derivadas de ApiBase específicas para cada uno.

	ApiObject:
		bckapiService.read( new ApiObject( "direccion" ).assign( 2312 ) )	
		Leería el objeto de "direccion" con id 2312
	ApiList:
		bckapiService.read( new ApiList( "direccion" ).filter({via__icontains:"calle"}) )	
		Leería lista de objetos "direccion" con los parámetros de filtrado 
	
 **	Si son independientes de los recursos provistos por la API, podemos usar los siguientes con el path entero, relativo o absoluto:
	ApiObjectP:
		bckapiService.read( new ApiObjectP( "api/a/b/c" ).assign( "fulano?b=1" ) )
		Leería el objeto ubicado en "httpx://???.???/api/a/b/c" con id "fulano" y parámetros de búsqueda (filter) "b=1"

	ApiListP:
		bckapiService.read( new ApiListP( "api/a/b/c?f=44" ).api_filter_delete().api_filter({a:1,b:2}) )
		Leería lista de objetos ubicados en "httpx://???.???/api/a/b/c?a=1&b=2", sustituyendo filtro original (f=44) por los nuevos.

**/
export class 			ApiObject						extends ApiBase	{
	constructor ( private __api_name:string ) { super() }
	public 			get		api_name	()				:string {	return this.__api_name;	};	
}	
export class 			ApiObjectP 						extends ApiBase	{
	constructor ( private _api_path:string ) { super() }
	public 			get		api_path	()				:string {	return this._api_path;	};	
}	

export class 			ApiList							extends ApiListBase <ApiBase>	{
	constructor ( private __api_name:string ) { super() }
	public 			get		api_name	()				:string {	return this.__api_name;	};	
	
	public 	getObject ( index?:number ) {  
							/** Creamos nuestro propia clase ApiObject como clase anidada, dinámicamente,
							It is related with class expressions https://stackoverflow.com/a/45244695/3520105
							
							this.ApiObject().assign ( this.results[1] ) 
							**/
							let r = new  ApiListObject(this)
							if (index===0 || index>0)
								r.api_assign(this.results[index])
							return r
						}
	
}	
export class 			ApiListObject extends ApiBase {
							constructor ( public api_list_parent: ApiList ) { super();}
							public 			get		api_name	()				:string {	return this.api_list_parent.api_name;	};	
						}	
export class 			ApiListP						extends ApiListBase <ApiBase>	{
	constructor ( private _api_path:string ) { super() }
	public 			get		api_path	()				:string {	return this._api_path;	};	
	
	public 	getObject 	( index?:number ) {  
							/** Creamos nuestro propia clase ApiObject como clase anidada, dinámicamente,
							It is related with class expressions https://stackoverflow.com/a/45244695/3520105
							
							this.ApiObject().assign ( this.results[1] ) 
							**/
							let r = new  ApiListPObject(this)
							if (index===0 || index>0)
								r.api_assign(this.results[index])
							return r
						}
	
}	
export class 			ApiListPObject extends ApiBase {
							constructor ( public api_list_parent: ApiListP ) { super();}
							public 			get		api_path	()				:string {	return this.api_list_parent.api_path;	};	
						}	

class 					ApiRoot							extends ApiBaseNoId {
	/** ApiRoot, clase raíz para descubrimiento de la API
	Especial, sólo para utilizarla una vez en BckapiService, por lo que no se exporta.
	Cargará las propiedades que nos devuelva el backend en su raíz.
	Sólo un uso en bckapiService.root.
	**/
	public 			get		api_path	()				:string		{ return BCKAPI_ROOT }
	public					api_loaded 	() 				:boolean	{
		//	Está cargado si hay variables no internas (empiezan por _, como _api_href)
		for (let k in this)
			if (!k.startsWith('_'))
				return true;
		return false;
	}
}

/** HttpErrorInterceptor:	Interceptor de errores http global. No utilizado, se deja como referencia.
No es necesario, capturamos los erroes en BckapiService para poder hacer un seguimiento pormenorizado. Así que se deja como referencia.
**/
/*
import { EMPTY, throwError } 					from 'rxjs'; 	// Para HttpErrorInterceptor. No utilizado, se deja como referencia
import {	// Para HttpErrorInterceptor
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
  HttpHandler,
  HttpEvent,
  HttpResponse
} from '@angular/common/http';
@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
	/** Captura los errores HTTP de modo global
	Se registra en app.module.ts
	https://stackoverflow.com/a/46019852/3520105
	https://medium.com/@nicowernli/angular-captura-todos-los-errores-de-httpclient-mediante-un-httpinterceptor-2cead03bb654
	**
	intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

		return next.handle(request).pipe(
			catchError(
				(error: HttpErrorResponse) => {
					/** Cuando se da un error de no resolución de nombre (fallo de red) al intentar enviar una comunicación http
							net::ERR_NAME_NOT_RESOLVED	-> cuando se corta la red
						el tipo de error.error es ProgressEvent en lugar de como dicen otras informaciones EventEvent https://rollbar.com/blog/angular-6-error-tracking/
						En concreto el tipo sería: 'HttpSentEvent | HttpHeaderResponse | HttpProgressEvent | HttpResponse<any> | HttpUserEvent<any> | HttpErrorResponse'
					**
					/** Tiene las siguientes características:
							DEBUG HttpErrorInterceptor:
								typeof error 							= object
								error instanceof ProgressEvent 			= false
								error 									= [object Object]
								typeof error.error 						= object
								error.error instanceof ProgressEvent 	= true
								error.error 							= [object ProgressEvent]
								error	  	.headers = [object Object]
								error	  	.status = 0
								error	  	.statusText = Unknown Error
								error	  	.url = https://sertec.ipapsystems.com/api/grupo/
								error	  	.ok = false
								error	  	.name = HttpErrorResponse
								error	  	.message = Http failure response for https://sertec.ipapsystems.com/api/grupo/: 0 Unknown Error
								error	  	.error = [object ProgressEvent]
								error.error	.isTrusted = true
								error.error	.lengthComputable = false
								error.error	.loaded = 0
								error.error	.total = 0
								error.error	.NONE = 0
								error.error	.CAPTURING_PHASE = 1
								error.error	.AT_TARGET = 2
								error.error	.BUBBLING_PHASE = 3
								error.error	.type = error
								error.error	.target = [object XMLHttpRequest]
								error.error	.currentTarget = [object XMLHttpRequest]
								error.error	.eventPhase = 2
								error.error	.bubbles = false
								error.error	.cancelable = false
								error.error	.defaultPrevented = false
								error.error	.composed = false
								error.error	.timeStamp = 22999.654999934137
								error.error	.srcElement = [object XMLHttpRequest]
								error.error	.returnValue = true
								error.error	.cancelBubble = false
								error.error	.path = 
								error.error	.composedPath = function composedPath() { [native code] }
								error.error	.stopPropagation = function stopPropagation() { [native code] }
								error.error	.stopImmediatePropagation = function stopImmediatePropagation() { [native code] }
								error.error	.preventDefault = function preventDefault() { [native code] }
								error.error	.initEvent = function initEvent() { [native code] }
								error.error	.__zone_symbol__stopImmediatePropagation = function stopImmediatePropagation() { [native code] }
								error.headers.normalizedNames = [object Map]
								error.headers.lazyUpdate = null
								error.headers.headers = [object Map]						
						
					**
					/* DEBUG
					console.log(`DEBUG HttpErrorInterceptor:`)
					console.log(`    ${typeof error} ${error instanceof ProgressEvent} ${error}`)
					console.log(`    ${typeof error.error} ${error.error instanceof ProgressEvent} ${error.error}`) 
					for (let x in error			) console.log(`    error	  	.${x} = ${error[x]}`)
					for (let x in error.error	) console.log(`    error.error	.${x} = ${error.error[x]}`)
					for (let x in error.headers	) console.log(`    error.headers.${x} = ${error.headers[x]}`)
					// *
					if (error.error instanceof ProgressEvent) {
						// A client-side or network error occurred. Handle it accordingly.
						console.warn('Seems like a client network error occurred:', error.message);
						
						// If you want to return a new response:
						//return of(new HttpResponse({body: [{name: "Default value..."}]}));

						/** Devolvemos un error que podamos capturar más arriba: 404 **
						return throwError(new HttpErrorResponse({headers:error.headers,status:404,statusText:error.statusText,url:error.url}));
						// return of(new Error(error.message));
						// return throwError(new Error(error.message));
						
					} else { 
						// Return the error on the upper level:
						return throwError(error);
						// or just return nothing:
						// return EMPTY;
					}

				}
			)
		);
	}
}*/

/** BckapiService **/
@Injectable({
  providedIn: 'root'
})
export class 			BckapiService				{
	/** Servicio de comunicación con la API del backend
	*
	**/
	
	constructor( private http: HttpClient,) { 
		/**	DEBUG - aportamos información del nivel de debug BCKAPI **/
		if(DEBUG_BCKAPI)console.log(`%c DEBUG BCKAPI ${DEBUG_BCKAPI}         `, 'background: #d70; color: #fe0') // amarillo sobre naranja
		
		/**	Monitorización de conexión del navegador 
		Creamos subscripciones para monitorizar el estado online del navegador. Sólo a título informativo. No se quitará la subscripción nunca así que no necesitamos guardarlos.
		Referencia: https://stackoverflow.com/a/54844939/3520105
		**/
		fromEvent(window, 'online' ).subscribe(e => {
		  this.online = 1000000;
		  console.log(`%c CLIENT ONLINE ${new Date().toLocaleString()}`, 'background: #cfc; color: #121') // verdoso
		});
		fromEvent(window, 'offline').subscribe(e => {
		  this.online = 0;
		  console.warn(`%c CLIENT OFFLINE ${new Date().toLocaleString()}`, 'background: #fcc; color: #211') // rojizo
		});

		/** Lanzador
		Todas las subscripciones que se hagan a HttpClient deben hacerse de modo ordenado, para que no descarte las antiguas si se hacen demasiado rápido.
		Por ello necesitamos un inicializador Subject: observable proxy (procurador), que permite suscripciones múltiples y al que se pueden pasar parámetros asíncronamente
		que serán distribuidos a los suscriptores. Utilizado con una sola subscripción que ejecuta las funciones entrantes, actúa de embudo que obliga a que las subscripciones
		de estas funciones a HttpClient sean ordenadas, de una en una, y evitar el descarte de algunas si hay colisión.
		Referencia:
			Documentación: 			https://rxjs-dev.firebaseapp.com/guide/subject
			Problemas similares:	https://stackoverflow.com/a/59922635 https://stackoverflow.com/a/45882434/3520105
		**/
		this.launcher$$.pipe(mergeAll()).subscribe( (r)=>{ this.commsps+=1;setTimeout(()=>{this.commsps-=1},1000) } )	//	Notifica que estamos comunicando durante 1 seg. a this.comm, por lo que nos da una indicación de nº de requests/s
		
		//	API_ROOT: Comenzaremos a leer de inmediato la configuración de la API, y lo haremos cada hora, a no ser que haya errores de comunicación, que aceleramos consultas a 100ms incrementales, hasta que funcione.
		///	Debe estar después de inicializar el lanzador
		this.interval_read( BckapiService.root, BCKAPI_ROOT_UPDATE_S*1000, 0.1*1000, BCKAPI_ROOT_UPDATE_S*1000, undefined)
		
	}

	/** --- Servicios genéricos --- **/
	
	/** Estado del navegador online: 
		0 navegador offline, 1000000 navegador online. 
		Con cada fallo de comunicación restaremos 1 (sin llegar a 0).
		De este modo nos puede servir de indicador de la calidad de la comunicación desde:
			a) la carga de la página.
			b) el restablecimiento de la comunicación del navegador (navigator.onLine, evento online)
	**/
	public 					online 				:number
	/** Lanzador
		Todas las subscripciones que se hagan a HttpClient deben hacerse de modo ordenado, para que no descarte las antiguas si se hacen demasiado rápido.
		Por ello necesitamos un inicializador Subject: observable proxy (procurador), que permite suscripciones múltiples y al que se pueden pasar parámetros asíncronamente
		que serán distribuidos a los suscriptores. Utilizado con una sola subscripción que ejecuta las funciones entrantes, actúa de embudo que obliga a que las subscripciones
		de estas funciones a HttpClient sean ordenadas, de una en una, y evitar el descarte de algunas si hay colisión.
		Referencia:
			Documentación: 			https://rxjs-dev.firebaseapp.com/guide/subject
			Problemas similares:	https://stackoverflow.com/a/59922635 https://stackoverflow.com/a/45882434/3520105
	**/
	private 				launcher$$ 			: Subject< Observable<any> >	= new Subject()	// Podría ser static, pero dado que lo incializamos en el constructor es lógico que no lo sea
	public					commsps		:number = 0; // indicará el número de request por segundo que se están efectuando								
	
	/** --- API - Variales --- **/
	/**	root
	Objeto ApiRoot que contendrá los recursos disponibles de la API, 
	se actualizará automáticamente.
	Requiere ser static para estar disponible para ApiBase.
	**/
	public	static	root						=	new ApiRoot ()
	/** quitar root_update, solucionado con interval_read
	public			root_update_tempo;
	private			root_update	() 	{ 
									/** Eliminamos la suscripción al temporizador
									A pesar de que utilizamos un timer que sólo se ejecutará una vez, debemos desvincularnos, por si ejecutamos la actualización
									manualmente antes de que ocurra.
									No hace falta comprobar antes si está cerrada ( && !this.root_update_tempo.closed )
									setTimeout no funciona bien, no vale para observables adecuadamente. if (this.root_update_tempo) clearTimeout(this.root_update_tempo)
									/
									if (this.root_update_tempo)	this.root_update_tempo.unsubscribe()
									
									///	Llamamos a la lectura de root
									this.read	(	
										//	Leerá ApiRoot
										BckapiService.root,  														
										//	Si hay error, lo apuntará con nombre específico para esta función
										this.error_handle('bckapiService.root_update', null), //new ApiError()),				
										//	Al completar, en caso de comunicar correctamente, reiniciará el error de esta función, al final.
										//	Detectamos que es error si la propiedad api_error devuelve true, que indica que es el nuevo ApiError
										//	La respuesta del servidor no la trae, por lo que la evaluación será que no hay error.
										//	En tal caso, actualizamos y reiniciamos el contador de errores
									// ).subscribe(
										(res)=>{
											
											/// Si no hubo error, quitamos fallos y el intervalo será el normal.
											if (res!==null) 
												this.error_remove('bckapiService.root_update')
											
											/* DEBUG
											console.log (`BckapiService.root - Errors ${this.errors['bckapiService.root_update'][0]}, last ${this.errors['bckapiService.root_update'][1]} - Loaded ${BckapiService.root.api_loaded()}`)
											for (let x in BckapiService.root)
												console.log (`    ${x} == ${BckapiService.root[x]}`)
											///
											
											///	Volvemos a suscribir con el intervalo de actualización
											let iv:number;
											//	Si la api está cargada, la actualizamos con el tiempo normal, 
											//	si no, si hay errores de comunicación, más a menudo pero a intervalo creciente
											//	Si no está cargada y hay errores, calculamos intervalo pequeño para reintentar.
											if (!BckapiService.root.api_loaded() && this.errors['bckapiService.root_update'])
												iv = Math.min(BCKAPI.UPDATE_S, Math.max(2, this.errors['bckapiService.root_update']*5) )
											else
												iv = BCKAPI.UPDATE_S
											
											//	Suscribimos nueva actualización con el intervalo
											this.root_update_tempo = timer(iv*1000).subscribe((counter)=>{this.root_update()})
											// this.root_update_tempo = setTimeout(this.root_update,iv*1000)
											
											/* DEBUG
											console.log(`interval = ${iv}`)
											console.log(this.errors)
											// /
													
										
										}	
									)
									
									
									
								}*/
	
	/** Contador de errores de comunicación, definirá la tasa de refresco automático, menor si hay fallos 
		errors: Almacenará, por cada operación, cuántos errores de comunciación ha habido, y en función de eso dilatar reintentos.
				Serviría para aumentar el intervalo de intentos en determinadas operaciones de lectura o escritura, 
				para que tenga un comportamiento incremental y no acabe con miles de mensajes en consola ocupando mucha RAM
	**/
	private			errors				: {[k: string]: [number,Date]}	= 	{}; 			
	private			error_remove 		(operation:string){
								// console.log(`delete error ${operation}`)
								delete this.errors [operation]
					}
	private			error_register		(operation:string){
							//	Si hay errores, sumamos 
							if (operation in this.errors) {
								this.errors[operation][0]	+= 1
								this.errors[operation][1]	= new Date()
							//	Si no los había, es el primero
							} else {
								this.errors[operation]	=  [1, new Date()]
							}
							//	Indicamos en this.online y consola
							if (this.online > 1)
								this.online -= 1
							
							if(DEBUG_BCKAPI)
								console.warn(`${operation} fail ${this.errors[operation][0]} at ${this.errors[operation][1].toLocaleString()}`);
					}
	private			error_handle <T> 	(operation:string, result:T=null, info?:string) {
						/** 
						* Handle Http operation that failed.
						* Let the app continue.
						* @param operation - name of the operation that failed
						* @param result - optional value to return as the observable result
						**/
						return (error: any): Observable<T> => {

							// TODO: send the error to remote logging infrastructure
							// console.error(error); // log to console instead
							
							//	Registramos la operación
							this.error_register(operation)
							
							//	Info adicional
							if (info || DEBUG_BCKAPI)
								console.warn(`Catched error -> ${operation} ${info} -> ${error}`)
							
							/* DEBUG
							console.log(`LIST OF ERRORS`)
							for (let x in this.errors)
								console.log(`    ${x}: ${this.errors[x][0]} - ${this.errors[x][1]}`)
							// */
							
							// Let the app keep running by returning an empty result.
							return of(result as T);
							
						};
					}
		
	/**	--- API - Métodos de comunicaciones automáticas: interval y timer--- **/
	/**	Sólo pueden estar activas una comunicación read y/o una comunicación write automáticas a la vez por cada recurso de la API.
			- read:		timer_read , interval_read , MultiPageReader <- sólo uno puede estar activo simultáneamente para cada recurso de la API
			- write:	timer_write, interval_write.
			
		Si se habilitase otra se desprogramaría la anterior.
		Viene causado porque la subscripción a los temporizadores se identifica por apiobject.api_resource. Si se quisiese independizar por consulta, se podría aplicar
		una uuid para cada comunicación (o sería más apropiado para cada objeto), pero en principio. no se ve ventaja dado que las comunicaciónes automáticas deben ser
		poscas y robustas.
	**/
	
	private 		_timer			<T extends ApiBase> ( fname:string, obj:T, delay:number, val:number, val_error?:number, val_exhausted?:number, step?:number, manager?:(object,[number,Date])=>(Observable<T>|boolean), postprocess?:(object,any)=>void, _recursive?:string )	{
										/**	Función para ejecución de func (read, write o create) a intervalos. Admite regulación (throttle), de modo que podemos cambiar el intervalo
										en caso de error (val_error) y hacerle ir pasando hasta val_exhausted si no se corrige el error, en step pasos.
										
										Parámetros:
											fname:			función: 'read' o 'write' 
											obj:			objeto a leer, escribir..
											 
											delay:			retraso hasta primera ejecución, en ms
											
											val:			intervalo siguiente lectura, en milisegundos: si == null, no se leerá después de la primera, si 0 será repetición de inmediato.
											val_error:		si ===null ó <0, en caso de error se detendrá la lectura periódica
															si se define >=0, se pasa a ese intervalo en el primer error
															si no se define, será el intervalo fijo val.
											val_exhausted:	si definido, se irá pasando de val_error a val_exhausted para el intervalo. 
															Si no se define, se utilizará siempre val_error
															Si 0 (o null), los reintentos serán incrementales pero nunca dejarán de aumentar en su espaciado, con lo se acabaría finalmente de intentar, en la práctica.
															Si <0, no se intentará más una vez llegado al valor especificado, y se lanzará una advertencia a la consola
											step:			mS de paso a ir incrementando el intervalo desde val_error hasta llegar a val_exhausted, si hubo error.
															Si negativo, se calculará automáticamente considerando que el valor pasado refleja el número de intentos deseados.
															Si no definido, y val_exhausted sí lo está, se interpretará automáticamente (val_error * número de errores) lo que lo convierte los intervalos en una progresión exponencial a partir de val_error.
															Si null, y val_exhausted está definido, se entenderá que hará un intento con val_error y luego pasará a val_exhausted.
											manager:		Función que toma el objeto y los errores de comunicación del mismo, y se ejecuta antes de ejecutar cada intervalo.
															Puede interferir en la ejecución según su valor devuelto:
															- true: permitir el disparo cuando llegue el momento, 
															- false: evitar su ejecución 
															- Observable: devolver un Observable que se ejecutará antes de la función (si devuelve false la cancelará igualmente).
											postprocess		toma objeto respuesta (el mismo de entrada en read) y el contenido de errores para este objeto (tupla nº errores y fecha), y lo postprocesa. NO se permite cancelar la suscripción según su resultado porque podría dar lugar a race condition.
											
										Ej:
											interval_read (obj, 1000, 
										**/
										
										/// Para las write el resultado es un objeto nuevo
										let objres:any;
										if (fname=='read')
											objres = obj
										else
											objres = new Object()
										
										// console.log("_timer ->","obj",obj.api_href,"obj.api_status =",obj.api_status, "_recursive =",_recursive)
										// console.log("delay",delay,"val",val,"val_error",val_error,"val_exhausted",val_exhausted,"step",step)
										
										///	Marcador de primera ejecución
										let e1 = (!_recursive);
										
										///	1ª ejecución: Nos asignamos el estado si somos la primera ejecución, donde se genera el estado
										///	Si ya tuviésemos estado, simplemente lo sobreescribimos, es porque hemos reiniciado este hilo de ejecución y el anterior se autocancelará.
										if (e1) {
											obj.api_status = `${fname}_timer ${(Date.now()).toString(36)} ${(Math.random()*2147483647).toString(36)}` // Función, timestamp y nº aleatorio 1M en base 36: https://stackoverflow.com/q/6213227/3520105
											_recursive = obj.api_status
										}
										///	2ª y siguientes. Comprobamos el estado y si es incompatible con el que requiere esta función al ser ejecutada
										//	Si sí somos nosotros simplemente continuamos
										else if (obj.api_status!=_recursive){
											/// Cancelación: no puede ser distinto de _recursive, eso indicaría que el objeto se ha utilizado en otra operación, por ejemplo reiniciando con start otro MultiPageReader.
											///	Paramos esta línea de ejecución (igual que con la cancelación devolvemos objres), pero no advertimos, puede ser un simple reinicio.
											/// No advertimos: console.warn("Api object misuse in function ${fname}_timer: seems was used in other operation. Timer cancelled at ${new Date().toLocaleString()}")
											//	Aquí no es necesario this.stop(obj) // dejará obj.api_status en undefined si no lo está ya, así que el siguiente paso se cancelará
											//	puesto que esta línea de ejecución acaba al hacer return, no se generan más observables.
											return objres
										}
										
										// /* DEBUG 
										if (DEBUG_BCKAPI>=100 && e1) {
											console.log (`BckapiService.${fname}_timer Obj ${obj.api_href} - Status ${obj.api_status} - Errors ${this.errors[obj.api_status]?this.errors[obj.api_status][0]:"no"}, last ${this.errors[obj.api_status]?this.errors[obj.api_status][1].toLocaleString():"no"} - API Loaded ${BckapiService.root.api_loaded()}`)
											// for (let x in BckapiService.root)	console.log (`    ${x} == ${BckapiService.root[x]}`)
										}
										//*/
										
										/**	Calculamos el intervalo para la próxima ejecución
										Volvemos a suscribir con el intervalo de actualización
										**/
										let iv:number;
										///	Si estamos ya en recursión, calculamos el tiempo iv a aplicar al timer, en función de errores.
										if (!e1) {
											//	Si hay error y queremos gestionarlo de alguna manera definiendo val_error,
											if (this.errors[obj.api_status] && val_error!==undefined ) {
												//	Si queremos que se cancele, val_error sería null
												if (val_error===null || val_error < 0) {
													iv = null
												}
												// Si queremos regulación (val_error !== null) vamos dando pasos desde val_error hasta val_exhausted
												else if (val_error>=0) {
														
													let errs	=  this.errors[obj.api_status][0]
													let stept	=  step // debemos conservar el valor original de step para la llamada recursiva más adelante.
													
													///	Actuamos según val_exhausted
													//	Si val_exhausted no está definido, se tomará val_error
													if (val_exhausted===undefined)
														iv = val_error
													//	Si val_exhausted positivo o negativo (negativo implica que es cancelable) 
													else if ( val_exhausted > 0 || val_exhausted < 0) {
														let val_exhaustedt = Math.abs(val_exhausted)
														
														//	Si stept no definido, lo calcularemos automáticamente en función del número de errores, e irá creciendo
														if (stept===undefined)
															stept = Math.max(1,val_error) * (errs-1)
														else if (stept < 0)
															stept = Math.trunc((val_exhaustedt - val_error) / (-stept))
														
														///	Si stept es 0 o null o negativo, 
														///	se entiende que pasa directo a val_exhaustedt después de una vez pasar por val_error
														//	Si es null
														if (stept == null){
															if (errs<=1)	//	Si es el primer error, val_error
																iv = val_error
															else if (errs==2 || val_exhausted > 0)	//	Si es el segundo siempre se aplica val_exhaustedt, o si val_exhausted era positivo
																iv = val_exhaustedt
															else // si val_exhausted es negativo, se cancela después de aplicarlo una vez
																iv = 0
														}
														//	Si no, calculamos el siguiente intervalo, sin pasarnos de val_exhaustedt
														else {
															//	calculamos
															iv = val_error + stept * (errs-1)
															//	si es mayor que val_exhaustedt
															if (iv > val_exhaustedt)
																// si era positivo, lo ajustamos a val_exhaustedt
																if (val_exhausted > 0)
																	iv = val_exhaustedt
																// si era negativo, significa que al llegar a él se cancelaba el intervalo
																else
																	iv = 0
														}
													}
													//	Si es 0 o null, no se considerará límite, y el intervalo crecerá indefinidamente si hay stept definido.
													else {
														//	Si no se definió stept, como se había definido val_exhausted con 0, interpretamos que se quiere un intervalo exponencial
														//	sin límite, a partir de val_error
														if (stept===undefined)
															stept = Math.max(1,val_error) * (errs-1)
														
														//	Si hay stept positivo no le pondremos fin
														if (stept > 0)
															iv = val_error + stept * (errs-1)
														//	Sin stept, el intervalo será val_error
														else
															iv = val_error
													}
												} 
											} 
											//	Si no había error, o no queremos gestionarlo, el intervalo estipulado
											else 
												iv = val
										}
										///	Si es la primera ejecución, el primer tiempo es el delay
										else 
											iv = delay // cuando es la primera ejecución 0 no se considera cancelado, sino que es lanzamiento inmediato una primera vez.
										
										///	Nueva actualización con el intervalo, sólo si hay intervalo (null sería que se ha cancelado)
										///	o si es la primera ejecución
										if (iv!=null || e1) {
											let tim:Observable<any> = timer(iv)
											
											/**	Si hay manager 
											Según su resultado, la ejecución se cancela, prosigue, o cambiamos la subscripción al timer por suscripción al observable aportado
											**/
											// console.log(`manager en _interval ${manager}`)
											if (manager) {	
												tim = tim.pipe(concatMap((counter)=>{
														let rmanager = manager(obj, this.errors[obj.api_status])
														// console.log(rmanager,'dice el manager')
														// Si devuelve false, se cancela temporizador
														if (rmanager===false) {
															this.stop(obj)
															return of(false)
														}
														//	Si devuelve un observable, condicionaremos nuestra ejecución, con los mismos parámetros, a él.
														else if (rmanager instanceof Observable) {
															return rmanager
														}
														//	Si no devuelve ni false ni Observable, seguimos ejecución normal
														else
															return of(true)
												}))
											}
											///	Llamamos a la lectura después de interpretar el resultado del manager
											tim = tim.pipe(concatMap(managerorder=>{
												// console.log(managerorder,'interpretamos el manager')
												if (managerorder!==false && obj.api_status==_recursive){
													// Debemos llamar por key a func, porque si no this no estará disponible dentro de ella. Esto se origina porque está pasada por parámetro
													return this[fname+'_observable']	(	
														//	Leerá el objeto del backend
														obj,  														
														//	Si hay error, lo apuntará con nombre específico para esta función
														//	Nos lo podemos permitir porque si vuelve a la normalidad lo vamos a borrar.
														this.error_handle(obj.api_status, null), //new ApiError()),				
													// Nos suscribimos al observable.
													//	Debemos utilizar subscribe, no directamente la función como postprocess, dado que ésta postprocesa el objeto
													)
												}
												// cancelado por el manager o el obj.api_status
												else {
													this.stop(obj) // dejará obj.api_status en undefined, así que el siguiente paso se cancelará
													return of(null) 
												}
											}))
											///	Resultado, postproceso y recursión
											tim = tim.pipe(concatMap(res=>{
												// console.log(res,'es el resultado','status =',obj.api_status)
												///	Si no se canceló la llamada de lectura por el manager o por el obj.api_status
												if (obj.api_status==_recursive) {
													///	Si la respuesta es válida
													if (res!==null) {
														/// Quitamos fallos y el intervalo será el normal.
														this.error_remove(obj.api_status)
														///	Asignamos al objeto las propiedades, igual que hace la función fname (sin _observable)
														Object.assign(objres,res)
													}
													///	Función postproceso anque haya fallado la respuesta
													if (postprocess) {
														///	no debemos permitir que se pueda parar la ejecución en postprocess, porque podría dar lugar a race condition: lo dessuscribimos pero ya está ejecutándose la función principal que lo volverá a suscribir
														postprocess(objres, this.errors[obj.api_status])
													}
													///	Recursión: añadimos un observable que nos vuelva a lanzar de nuevo
													/// Tampoco necesitaríamos devolver nada, no vamos a concatenar más, pero si el tipo de concatMap es devolver observable, devolvemos.
													return of(this._timer(fname,obj,delay,val,val_error,val_exhausted,step,manager,postprocess, _recursive)) // pasamos el estado en _recursive de modo que sabremos cuándo somos la primera o no, e información de lo que estamos haciendo
												}
												///	Finaliza la ejecución
												///	Aunque no se use luego tenemos que devolver un observable para utilizar concatMap
												else {
													this.stop(obj) // dejará obj.api_status en undefined si no lo está ya, así que el siguiente paso se cancelará
													return of(null) 
												}
											}))
											
											///	LANZAMOS
											this.launcher$$.next(tim)
											
										}
										///	Si ya hemos acabado iv será null 
										///	Marcamos como inactivo, quitando el estado del objeto aportado y errores.
										else {
											this.stop(obj)
										}
										
											
										/* DEBUG
										console.log(`DEBUG _interval: ${objid}`)
										console.log(`    val: ${val}, val_error: ${val_error}, val_exhausted: ${val_exhausted}, step: ${step}`)
										console.log(`    next in ${iv} ms`)
										console.log(`    errors ${this.errors[objid]?this.errors[objid]:0}`)
										// */
									
							
										///	Devolvemos el objeto que se irá actualizando
										return objres
									}	
					interval_read	<T extends ApiBase>	( 				obj:T, 			val,	val_error?,	val_exhausted?, step?, manager?, postprocess?)	{
											/**	Función para lectura a intervalos. Admite regulación (throttle), de modo que podemos cambiar el intervalo
											en caso de error (val_error) y hacerle ir pasando hasta val_exhausted si no se corrige el error, en step pasos.
											
											
											Parámetros:
												val:			intervalo en milisegundos
												val_error:		si se define, se pasa a ese intervalo en el primer error, si no, será un intervalo fijo.
												val_exhausted:	si definido, se irá pasando de val_error a val_exhausted para el intervalo. Si no se define, será igual que val_error
												step:			ms de paso en pasar de val_error a val_exhausted
												
											Ej:
												interval_read (obj, 1000, 
											**/
											return this._timer	( 'read', obj, 0, val, val_error, val_exhausted, step, manager, postprocess )
										}	
					interval_write	<T extends ApiBase>	( 				obj:T,			val,	val_error?,	val_exhausted?, step?, manager?, postprocess?)	{
											return this._timer	( 'write', obj, 0, val, val_error, val_exhausted, step, manager, postprocess )
										}	
					timer_read		<T extends ApiBase>	( 				obj:T, delay,	val?,	val_error?,	val_exhausted?, step?, manager?, postprocess? )	{
											/**	Función para lectura a intervalos. Admite regulación (throttle), de modo que podemos cambiar el intervalo
											en caso de error (val_error) y hacerle ir pasando hasta val_exhausted si no se corrige el error, en step pasos.
											
											Parámetros:
												val:			intervalo en milisegundos
												val_error:		si se define, se pasa a ese intervalo en el primer error, si no, será un intervalo fijo.
												val_exhausted:	si definido, se irá pasando de val_error a val_exhausted para el intervalo. Si no se define, será igual que val_error
												step:			ms de paso en pasar de val_error a val_exhausted
												
											Ej:
												interval_read (obj, 1000, 
											**/
											return this._timer	( 'read'	, obj, delay, val, val_error, val_exhausted, step, manager, postprocess )
										}	
					timer_write		<T extends ApiBase>	( 				obj:T, delay,	val?,	val_error?,	val_exhausted?, step?, manager?, postprocess? )	{
											return this._timer	( 'write'	, obj, delay, val, val_error, val_exhausted, step, manager, postprocess )
										}	
					stop				( obj, ) {
											// console.log('bckapiService.stop',obj,this.errors)
											if (obj.api_status)
												this.error_remove(obj.api_status)
											obj.api_status = undefined
											// console.log("    status:",obj)
										}
					
	/** quitar, implementación original de interval_read - contiene errores pero se deja un rato por referencia
	interval_read	 ( obj, val, val_error?:number, val_exhausted?:number, steps=10)	{
		/**	Función para lectura a intervalos. Admite regulación (throttle), de modo que podemos cambiar el intervalo
		en caso de error (val_error) y hacerle ir pasando hasta val_exhausted si no se corrige el error, en steps pasos.
		
		Parámetros:
			val:			intervalo en milisegundos
			val_error:		si se define, se pasa a ese intervalo en el primer error, si no, será un intervalo fijo.
			val_exhausted:	si definido, se irá pasando de val_error a val_exhausted para el intervalo. Si no se define, será igual que val_error
			steps:			pasos en pasar de val_error a val_exhausted
			
		Ej:
			interval_read (obj, 1000, 
		/
		
		//	Revisamos parámetros
		if (!val_exhausted)
			val_exhausted = val_error
		
		//	Identificador del objeto en errores y timers
		let objid = `interval_read "${obj.api_href}"`
		
		/** Eliminamos la suscripción al temporizador
		A pesar de que utilizamos un timer que sólo se ejecutará una vez, debemos desvincularnos, por si ejecutamos la actualización
		manualmente antes de que ocurra.
		No hace falta comprobar antes si está cerrada ( && !this.timers	.closed )
		setTimeout no funciona bien, no vale para observables adecuadamente. if (this.timers	) clearTimeout(this.timers	)
		/
		if (this.timers[objid]	)	this.timers	.unsubscribe()
		
		
		///	Llamamos a la lectura de root
		this.read	(	
			//	Leerá el objeto del backend
			obj,  														
			//	Si hay error, lo apuntará con nombre específico para esta función
			//	Nos lo podemos permitir porque si vuelve a la normalidad lo vamos a borrar.
			this.error_handle(objid, null), //new ApiError()),				
			//	Al completar, en caso de comunicar correctamente, reiniciará el error de esta función, al final.
			//	Detectamos que es error si la propiedad api_error devuelve true, que indica que es el nuevo ApiError
			//	La respuesta del servidor no la trae, por lo que la evaluación será que no hay error.
			//	En tal caso, actualizamos y reiniciamos el contador de errores
		// ).subscribe(
			(res)=>{
				
				/// Si no hubo error, quitamos fallos y el intervalo será el normal.
				if (res!==null) 
					this.error_remove(objid)
				
				/* DEBUG
				console.log (`BckapiService.root - Errors ${this.errors['bckapiService.root_update']}, last ${this.error_date['bckapiService.root_update']} - Loaded ${BckapiService.root.api_loaded()}`)
				for (let x in BckapiService.root)
					console.log (`    ${x} == ${BckapiService.root[x]}`)
				///
				
				/**	Calculamos el intervalo para la próxima ejecución
				Volvemos a suscribir con el intervalo de actualización
				/
				let iv:number;
				//	Si queremos regulación (definido val_error) y hay error, vamos dando pasos desde val_error hasta val_exhausted
				if (val_error>0 && objid in this.errors) {
					let errs	= this.errors[objid][0]
					
					//	Si los errores superan los pasos, el intervalo será val_exhausted, ya hemos llegado al fin del tramo
					if (errs>steps)
						iv = val_exhausted
					//	Si no, calculamos el intervalo en función del error al que lleguemos
					else {
						let stepiv	= (val_exhausted - val_error) / steps
						//	El intervalo empieza en val_error, luego steps-1 pasos más y a partir de ahí se considerará val_exhausted y sería la condición anterior.
						iv = val_error + stepiv * (errs-1) 
					}
				//	Si no había error, el intervalo estipulado
				} else
					iv = val
				
				//	Suscribimos nueva actualización con el intervalo
				this.timers[objid] = timer(iv).subscribe((counter)=>{this.read_interval_throttle(obj,val,val_error,val_exhausted,steps)})
				// this.timers	 = setTimeout(this.root_update,iv*1000)
				
				// /* DEBUG
				console.log(`interval_read "${obj.api_href}" (next in ${iv} ms) - errors ${this.errors[objid]}`)
				// /
						
			
			}	
		)
	}	**/
	
	/**	--- API - Métodos de comunicación básicos --- **/
					read				<T extends ApiBase> ( obj:T, on_error?:(error)=>Observable<any>, postprocess?:(T)=>any):T {
						/**	Read some ApiBase from the backend api.
						Response:
							Returns the same passed object (obj), updated, with the response, and postprocessed if postprocess is defined.
						Parámetros:
							obj:	Identificación del objeto. ERROR SI API NO CONFIGURADA. Puede ser una instancia del objeto a leer (de la clase cls) con id asignado, o su identificador id.
									Se admite undefined, porque hay objetos que no llevan id, los ApiList.
									Si es un objeto de la clase cls, se actualizará una vez recibida la respuesta, y se devuelve (no muy buena práctica pero necesario en este caso).
									Para evitar errores, si se aporta obj tipo T, no se devolverá (se devolverá el valor predeterminado undefined).
							on_error: especifica la función que sustituirá al observable en caso de error. 
									Predeterminado si undefined: función que anotará el error y devolverá un objeto ApiError, es decir un objeto ApiBase vacío.
							postprocess:	especifica la función que postprocesará la respuesta,
									Toma como parámetro el objeto obj que hemos pasado (no la respuesta directa) y se ignorará el valor que devolviese.
									
							
							#Eliminado:  params?: HttpParams | { [param: string]: string | string[]; },
							#	params:	Permite pasar a .get parámetros en su consulta.
							#			El tipo de params está definido del mismo modo que en angular: https://angular.io/api/common/http/HttpClient#get
						Respuesta:
							objeto recibido, que será el mismo que el aportado, si se aportó, con los campos actualizados.
						**/
						let objres = obj
						let observ = this.read_observable(obj, on_error).pipe(concatMap(	(res)=>{
							/* DEBUG
														console.log(`------ read: respuesta recibida ---------------------- ${obj.constructor.name}`)
							for (const k in res) {
														console.log(`> param obj a destino: ${k}`)
														console.log(`    ${k} = ${res[k]}`)

								// if (!k.startsWith('_')) // esa comprobación parece que no sería necesaria, puesto que sólo aparecen en el listado los campos que nos mandan.
								obj[k] = res[k];
							}		
							/*/   
							Object.assign(objres, res) // Equivale a -> for (let k in res) this[k] = res[k]; -> https://stackoverflow.com/a/58788876/3520105 
							// */
							
							//	Pasamos el objeto a postproceso, aunque podríamos utilizar objres directamente, debemos devolver un observable
							return of(objres)
						}))
						///	Postproceso
						if (postprocess) observ = observ.pipe(concatMap(	(prevobj)=>{
							// No necesitaríamos devolver nada, no vamos a concatenar más, pero si el tipo de concatMap es devolver observable, devolvemos.
							return of(postprocess(prevobj))
						}))
						
						///	LANZAMOS la consulta
						this.launcher$$.next(observ)
						
						/// Devolvemos objeto respuesta, todavía no cargado con nueva información
						return objres
					}
					write				<T extends ApiBase> ( obj:T, on_error?:(error)=>Observable<any>, postprocess?:(object)=>any):object {
						/**
						Respuesta:
							object que se completará una vez recibamos respuesta
						on_error especifica la función que sustituirá al observable en caso de error. Predeterminado si null: función que devuelve observable que devuelve null.
						**/
						let objres = new Object()
						let observ = this.write_observable(obj, on_error).pipe(concatMap(	(res)=>{
								/*
															console.log(`------ write: respuesta recibida ---------------------- ${obj.constructor.name}`)
								for (const k in res) {
															console.log(`> param obj a destino: ${k}`)
															console.log(`    ${k} = ${res[k]}`)

									// if (!k.startsWith('_')) // esa comprobación parece que no sería necesaria, puesto que sólo aparecen en el listado los campos que nos mandan.
									objres[k] = res[k];
								}										
								/*/   
								Object.assign(objres, res) // Equivale a -> for (let k in res) this[k] = res[k]; -> https://stackoverflow.com/a/58788876/3520105 
								// */
							
							//	Pasamos el objeto a postproceso, aunque podríamos utilizar objres directamente, debemos devolver un observable
							return of(objres)
						}))
						///	Postproceso
						if (postprocess) observ = observ.pipe(concatMap(	(prevobj)=>{
							// No necesitaríamos devolver nada, no vamos a concatenar más, pero si el tipo de concatMap es devolver observable, devolvemos.
							return of(postprocess(prevobj))
						}))
						
						///	LANZAMOS la consulta
						this.launcher$$.next(observ)
						
						/// Devolvemos objeto respuesta, todavía no cargado con nueva información
						return objres
					}
					create				<T extends ApiBase> ( obj:T, on_error?:(error)=>Observable<any>, postprocess?:(object)=>any):object {
						/**
						Respuesta:
							object que se completará una vez recibamos respuesta
						on_error especifica la función que sustituirá al observable en caso de error. Predeterminado si null: función que devuelve observable que devuelve null.
						**/
						let objres = new Object()
						let observ = this.create_observable(obj, on_error).pipe(concatMap(	(res)=>{
								/*
															console.log(`------ create: respuesta recibida ---------------------- ${obj.constructor.name}`)
								for (const k in res) {
															console.log(`> param obj a destino: ${k}`)
															console.log(`    ${k} = ${res[k]}`)

									// if (!k.startsWith('_')) // esa comprobación parece que no sería necesaria, puesto que sólo aparecen en el listado los campos que nos mandan.
									objres[k] = res[k];
								},										
								/*/   
								Object.assign(objres, res) // Equivale a -> for (let k in res) this[k] = res[k]; -> https://stackoverflow.com/a/58788876/3520105 
								// */
							
							//	Pasamos el objeto a postproceso, aunque podríamos utilizar objres directamente, debemos devolver un observable
							return of(objres)
						}))
						///	Postproceso
						if (postprocess) observ = observ.pipe(concatMap(	(prevobj)=>{
							// No necesitaríamos devolver nada, no vamos a concatenar más, pero si el tipo de concatMap es devolver observable, devolvemos.
							return of(postprocess(prevobj))
						}))
						
						///	LANZAMOS la consulta
						this.launcher$$.next(observ)
						
						/// Devolvemos objeto respuesta, todavía no cargado con nueva información
						return objres
					}
					read_observable 	<T extends ApiBase> ( obj:T, on_error?:(error)=>Observable<any>):Observable<T> 		{ // cls explicado: https://stackoverflow.com/a/50844126
						/**Observable de consulta del objeto.
						Respuesta:
							observable si se pudo consultar, null si no.
						Parámetros:
							on_error:	especifica la función que sustituirá al observable en caso de error. Predeterminado si undefined: función que devuelve observable que devuelve null. Si null, no se capturará el error.
						**/
						//	Verificamos que sea un objeto válido ApiBase, si es una respuesta de la api no traerá los métodos necesarios (api_href)
						let url = obj.api_href
												if(DEBUG_BCKAPI) { console.log(`bckapiService.read_.. ${url}`)
													// console.log(BckapiService.root)
												}
						if (url===undefined){
							/// Procesamos el error según configuración, sin lanzarlo, para no parar ejecución si hay captura de errores establecida.
							let errurl = new Error (`read_observable: obj location in API unknown (api_href returns undefined). API loaded: ${BckapiService.root.api_loaded()}.`)
							if (on_error)
								return on_error(errurl)
							else if (on_error ===undefined)
								return this.error_handle(`bckapiService.read_observable`,null,url)(errurl)
							else
								throw errurl
						}
						/*	Parámetros de la consulta: descartado incorporarlos en parámetro de la función porque vendrán en _api_href en el propio objeto.
							quitado: params?: HttpParams | { [param: string]: string | string[]; }, 
							
							let options:object|undefined = undefined;
							if (params) 
								options['params'] = params
							
						*/	
						//	Observable GET https://angular.io/api/common/http/HttpClient#get
						let obs;
						//	Si estamos en modo debug >= 10 utilizaremos un backend falso para pruebas
						if (BACKEND_MOCK)
							if (url in BACKEND_MOCK.GET)
								obs = of(BACKEND_MOCK.GET[url])
							else
								// obs = of(null)
								obs = throwError(new Error ('Using BACKEND_MOCK.GET: "${url}" not found'))
						else
							obs = this.http.get<T>(url) //, options)
						// console.log(url, obs, BACKEND_MOCK.GET)
						//	Capturamos error sólo si hay función, o si está undefined, en cuyo caso el observable devolverá null.
						if 		(on_error)
							obs = obs.pipe(catchError(on_error))
						//	Predeterminadamente anotaremos un error genérico para esta función. NO debe ser personalizado para el objeto ya que
						//	no es posible borrarlo después con algún criterio (para ello deberíamos hacerlo fuera de esta función) y podríamos acabar llenando la memoria de errores.
						else if (on_error===undefined)
							obs = obs.pipe(catchError(this.error_handle(`bckapiService.read_observable`,null,url)))	// new ApiError() pasa a null
						return obs
						
					}
					write_observable	<T extends ApiBase> ( obj:T, on_error?:(error)=>Observable<any>):Observable<object> { // cls explicado: https://stackoverflow.com/a/50844126
						/**Observable de escritura del objeto.
						Respuesta:
							observable si se pudo consultar, null si no.
						Parámetros:
							on_error:	especifica la función que sustituirá al observable en caso de error. Predeterminado si undefined: función que devuelve observable que devuelve null. Si null, no se capturará el error.
						**/
						let url = obj.api_href
												if(DEBUG_BCKAPI>=1) console.log(`bckapiService.write_.. ${url}`)
						if (url===undefined){
							/// Procesamos el error según configuración, sin lanzarlo, para no parar ejecución si hay captura de errores establecida.
							let errurl = new Error (`write_observable: obj location in API unknown (api_href returns undefined). API loaded: ${BckapiService.root.api_loaded()}.`)
							if (on_error)
								return on_error(errurl)
							else if (on_error ===undefined)
								return this.error_handle(`bckapiService.write_observable`,null,url)(errurl)
							else
								throw errurl
						}
						//	Pasamos a JSON aquí, con función de reemplazo para poder eliminar propiedades privadas
						let objson = JSON.stringify(obj, (k,v)=>(k.startsWith('_'))?undefined:v)
						// Debug
						// for (const k in obj)	console.log(`write obj: ${k} = ${obj[k]}`)
						//	Observable PUT https://angular.io/api/common/http/HttpClient#get
						let obs;
						//	Si estamos en modo debug >= 10 utilizaremos un backend falso para pruebas
						if (BACKEND_MOCK)
							if (url in BACKEND_MOCK.PUT)
								obs = of(BACKEND_MOCK.PUT[url])
							else
								// obs = of(null)
								obs = throwError(new Error ('Using BACKEND_MOCK.PUT: "${url}" not found'))
						else
							obs = this.http.put<T>(url, objson)
						//	Capturamos error sólo si hay función, o si está undefined, en cuyo caso el observable devolverá null.
						if 		(on_error)
							obs = obs.pipe(catchError(on_error))
						//	Predeterminadamente anotaremos un error genérico para esta función. NO debe ser personalizado para el objeto ya que
						//	no es posible borrarlo después con algún criterio (para ello deberíamos hacerlo fuera de esta función) y podríamos acabar llenando la memoria de errores.
						else if (on_error===undefined) 
							obs = obs.pipe(catchError(this.error_handle(`bckapiService.write_observable`,null,url))) 	// new ApiError() pasa a null
						return obs
					}
					create_observable	<T extends ApiBase> ( obj:T, on_error?:(error)=>Observable<any>):Observable<object> { // cls explicado: https://stackoverflow.com/a/50844126
						/**Observable de creación del objeto.
						Respuesta:
							observable si se pudo consultar, null si no.
						Parámetros:
							on_error:	especifica la función que sustituirá al observable en caso de error. Predeterminado si undefined: función que devuelve observable que devuelve null. Si null, no se capturará el error.
						**/
						let url = obj.api_href
												if(DEBUG_BCKAPI>=1) console.log(`bckapiService.create_.. ${url}`)
						if (url===undefined){
							/// Procesamos el error según configuración, sin lanzarlo, para no parar ejecución si hay captura de errores establecida.
							let errurl = new Error (`create_observable: obj location in API unknown (api_href returns undefined). API loaded: ${BckapiService.root.api_loaded()}.`)
							if (on_error)
								return on_error(errurl)
							else if (on_error ===undefined)
								return this.error_handle(`bckapiService.create_observable`,null,url)(errurl)
							else
								throw errurl
						}
						//	Pasamos a JSON aquí, con función de reemplazo para poder eliminar propiedades privadas
						let objson = JSON.stringify(obj, (k,v)=>(k.startsWith('_'))?undefined:v)
						//	Observable POST https://angular.io/api/common/http/HttpClient#get
						let obs;
						//	Si estamos en modo debug >= 10 utilizaremos un backend falso para pruebas
						if (BACKEND_MOCK)
							if (url in BACKEND_MOCK.POST)
								obs = of(BACKEND_MOCK.POST[url])
							else
								// obs = of(null)
								obs = throwError(new Error ('Using BACKEND_MOCK.POST: "${url}" not found'))
						else
							obs = this.http.post<T>(url, objson)
						//	Capturamos error sólo si hay función, o si está undefined, en cuyo caso el observable devolverá null.
						if 		(on_error)
							obs = obs.pipe(catchError(on_error))
						//	Predeterminadamente anotaremos un error genérico para esta función. NO debe ser personalizado para el objeto ya que
						//	no es posible borrarlo después con algún criterio (para ello deberíamos hacerlo fuera de esta función) y podríamos acabar llenando la memoria de errores.
						else if (on_error===undefined)
							obs = obs.pipe(catchError(this.error_handle(`bckapiService.create_observable`,null,url)))	// new ApiError() pasa a null
						return obs
					}
					
		
	/**	--- API - Clases de alto nivel --- **/
	
	/** MultiPageReader: 
	
		let reader = bckapiService.MultiPageReader()
	
	**/
	public			getMultiPageReader	<T extends ApiBase = ApiBase> (
											items_api_name:string,
											options?
										){ 
											/** clase para lectura multipágina del servidor, lo que permite ir leyendo progresivamente
											**/
											return new MultiPageReader<T> (
												this,
												items_api_name,
												options,
											) 
										}
	
}
export class			MultiPageReader	<T extends ApiBase = ApiBase>	{
	/**	Lector multipágina, para APIs que provean las consultas paginadas.
	STOP: Una vez subscritos al reader (mediante .subscribe(...) o .start(...)), para cancelar las subscripciones debemos llamar a .stop .
	Es necesario para garantizar que se pare, puesto que si no su hilo de observables seguirá vigente. En teoría no es imprescindible .stop para que sea recogido por el recolector de basura el MultiPageReader ni su items$$, mientras no se guarde en otro sitio referencia a los mismos https://stackoverflow.com/a/44294453 ,
	pero en realidad sus observables emitidos guardarían su referencia, y provocaríamos memory leaks en caso de no utilizarlo.
	
	Sólo funcional con APIs que funcionen por descubrimiento de recurso por nombre (que sus objetos tengan api_name funcional).
	Genérica. Opcionalmente se puede especificar un tipo de objeto Api concreto, en lugar de ApiBase, para reforzar el control de tipos.
	
	Backend API:
		La disponibilidad de más páginas se indicará en los resultados con un enlace en la propiedad 'next'.
		La paginación puede controlarse con el término offset, para poder inicializar la página de búsqueda. Normalmente también vendrá con el parámetro limit, pero MultiPageReader no lo alterará ni utilizará.
	
	Para que los cambios sean observables, no utilizamos un emisor de eventos. No se debe usar un emisor de eventos en un servicio: https://stackoverflow.com/a/34402906 import { Output, EventEmitter } from '@angular/core';	// Para MultiPageReader: con Output lo podrán heredar componentes y tener Output configurado.
	Utilizamos un Subject
	**/
	
	private		items$$						= new Subject<T[]>();	//	Observable de elementos leídos. Privado por ser Subject (podríamos exponerlo al exterior con .asObservable, pero preferimos hacer funciones propias de subscribe y unsubscribe).
	private		items$$_subscriptions		= new Subscription();	//	Subscripción múltiple donde haremos seguimiento de todas las subscripciones a items$$ https://stackoverflow.com/q/56702200
	
	private		items_tmp		: T[];			
	private		items_request	: ApiList	= new ApiList(this.items_api_name); //	Siempre la misma instancia, porque almacena su estado con los temporizadores. Podría ser una nueva.
	private		items_page					= 0;								//	Almacena las páginas que llevamos leídas en items_tmp
	
	///	options
	public		delay_ms		:number		= 0			//	Espera inicial a leer
	public		update_ms		:number		= null		//	Intervalo de actualización de la lectura entera
	public		pages_ms		:number		= 0			//	Intervalo de lectura de la siguiente página, en mS.
	public		max_items		:number		= 1000		//	Máximo de elementos que se leerán (si <=0 ó null, no se considerará máximo)
	public		partial			:boolean	= false		//	Visualizar resultados parciales (en items$$) según se va leyendo
	public		manager			:any		= undefined	//	Manager propio con las mismas condiciones que los manager de BckapiService.timer. Se ejecutará si el MultiPageReader sigue leyendo, antes de la lectura siguiente, y podrá interaccionar con su funcionamiento.
	constructor ( 
		private	bckapiService	:BckapiService,  
		public	items_api_name	:string				,	//	Nombre del recurso en la API
				options	= {},
				
	) { Object.assign(this,options) }
	
	public	api_filter		( filter?:object  ) {
		this.items_request.api_filter(filter)
		return this
	}
	public	api_filter_delete	() {
		this.items_request.api_filter_delete()
		return this
	}
	
	public	start			( ...subscribe:any[] )	{
			/**
			Parámetros:
				Cualquier parámetro aportado se entenderá como una subscripción que se hará efectiva antes del inicio de la lectura.
			**/
			
			
			///	Inicializamos 
			//	Nueva lista temporal
			this.items_tmp 		= new Array<T>();
			//	Ponemos en página 0, por si ya hubiésemos leído y fuese un relanzamiento
			this.items_request.api_filter({offset:0})
		
			//	Subscribimos el observable si se aportó info.
			// console.log(subscribe,subscribe.length,new Boolean(subscribe), new Boolean(subscribe.length))
			if (subscribe.length) {
				this.subscribe( ...subscribe )
			}
			
			//	Definimos el intervalo de lectura entre páginas y en caso de error. Para que se lea, debe ser >0 
		
			//	Lectura automática
			this.bckapiService.timer_read		( 
				this.items_request, 						///	Objeto que se actualizará con cada lectura
				this.delay_ms, 								//	first			-> retraso de primera consulta entre 100 y 200 ms, para que no coincidan todos los elementos a la vez.
				this.pages_ms, 								//	val				-> espaciado de las consultas
				Math.max(this.pages_ms,100),				//	val_error		-> en caso de error preguntamos otra vez al mismo intervalo que entre páginas
				Math.max(this.update_ms,1*3600*1000),		//	val_exhausted 	-> máximo el mayor de 1h y update_ms entre reintentos si hay error
				undefined, 									//	step automático -> en caso de error irá aumentando el intervalo de lectura exponencialmente
				//	Manager
				(obj,err)=>{
					if(DEBUG_BCKAPI>=100)console.log(`DEBUG MultiPageReader MANAGER obj ${obj.api_resource} next ${obj.next} err ${err}`)
					
					// si no hay error
					if (!err) {
						///	Si ya habíamos llegado al final de la paginación volvemos al principio, o cancelamos la ejecución si !update_ms
						if (this.items_page == -1) {
							// console.log('FIN',this.update_ms)
							//	Ponemos el contador de páginas leídas a 0 (todavía no hemos leído la primera, eso vendrá después del manager.
							this.items_page = 0
							/* No es necesario, ahora renovamos items_request al acabar: // Cambiamos el offset para volver al principio
								// no obj.api_filter_delete() porque quizá haya filtros
								obj.api_filter({offset:0})
								// AQUÍ NO: lo eliminaríamos antes de postprocess: vaciamos resultados del objeto items_request, para volver a cargar de 0
								// 		obj.results.length = 0
							*/
							// Ralentizamos el intervalo de consulta al normal, si queremos actualizarlo
							if (this.update_ms) {
								return timer(this.update_ms)
							}
							//	Si no, informamos a timer_read de que queremos parar
							else {
								/**	No dessubscribimos automáticamente si no hay actualización, puede que ejecutemos de nuevo start sin subscripción para actualizar
								this.items$$_subscriptions.unsubscribe()	//	https://stackoverflow.com/q/56702200
								**/
								return false
							}
						}
					}
					///	Se sigue leyendo en general, si hay error o si no hemos llegado al final
					///	Si tenemos un manager configurado, interceptamos la lectura y devolvemos su resultado
					if (this.manager)
						return this.manager(obj,err)
					return true
				},
				//	Postprocess: copiamos contenido a lista
				(obj,err)=>{
					if(DEBUG_BCKAPI>=100)console.log(`      MultiPageReader POSTPROCESS obj ${obj.api_resource} next ${obj.next} err ${err}`)
					
					if (!err) {
						let islast = ( ! obj.next )
						
						//	Hemos leído una página más
						this.items_page += 1
						
						///	Anexamos resultados a la lista temporal
						if (obj.results) {
							// limitamos a los máximos deseados, y marcamos como último si procede
							if (this.max_items>0){
								let itm = this.max_items - this.items_tmp.length
								//	si quedan más libres que los resultados, los anexamos sin más
								if (itm>obj.results.length)
									this.items_tmp.push ( ...obj.results )
								//	si no, si quedan libres, pero menos que los resultados, los anexamos y marcamos como último
								else if (itm>0) {
									this.items_tmp.push ( obj.results.slice(0,itm) )
									islast = true
								}
								//	si no quedan libres, marcamos como último
								else
									islast = true
							}
							else
								this.items_tmp.push ( ...obj.results )						
						}
						
						//	Si es el último, copiamos la lista temporal a una nueva y se la asignamos a la válida (items).
						///	Con observables emitimos una REFERENCIA a la lista interna de elementos (items_tmp)
						///	La consecuencia es que la lista emitida SÓLO es distinta cuando es una nueva lectura
						if (islast) {
							// this.items = this.items_tmp.slice()						//	items es una nueva lista, copia de la temporal
							this.items$$.next( this.items_tmp )							//	items$$ emite una referencia a la lista interna
							// this.items_tmp.length = 0								//	vaciamos lista temporal, preparándola para próxima consulta
							this.items_tmp		 	= new Array<T>()					//	nueva lista temporal, preparándola para próxima consulta
							this.items_request.api_filter({offset:0})					//	reiniciamos items_request, listo para siguente lectura si hay update_ms
							if (this.items_request.results)	this.items_request.results.length = 0
							this.items_page 		= -1								//	ponemos el contador de páginas leídas a -1 => indicará al manager en la próxima ejecución que se llegó al final.
						}
						//	Si no es el último
						else {
							//	En caso de que queramos ver resultados parciales, no podemos sustituir la lista entera, debemos reemplazar algunos de sus elementos
							///	Utilizando observables, se emitirá una REFERENCIA a la lista interna de elementos (items_tmp)
							///	La consecuencia es que la lista emitida SÓLO es distinta cuando es una nueva lectura
							if (this.partial) {
								// this.items.splice(0,this.items_tmp.length, ...this.items_tmp)
								this.items$$.next( this.items_tmp )
							}
							
							//	Si había más resultados que los últimos leídos, pasamos a la siguiente página para la próxima lectura
							obj.api_href = obj.next
						}
					}
				}
			
			); 		
	
			///	Devolvemos nuestra propia instancia, así podremos empezar nada más crear el objeto
			return this;
	}
	public	stop			()	{
		if(DEBUG_BCKAPI)console.log("stop MultiPageReader",this.items_request.api_status)
		this.bckapiService.stop(this.items_request)
		this.items$$_subscriptions.unsubscribe()	//	https://stackoverflow.com/q/56702200
		if(DEBUG_BCKAPI)console.log("    ...stopped",this.items_request.api_status)
	}
	public	subscribe		(...args:any[])	{
		/**
		Respuesta:	subscripción (nos podríamos dessuscribir)
		**/
		let subs = this.items$$.subscribe	( ...args )
		this.items$$_subscriptions.add (subs)		// https://stackoverflow.com/q/56702200
		return subs
	}
	
	
	
}
	

	