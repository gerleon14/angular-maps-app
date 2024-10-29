import { ApiBase, ApiListBase } from './bckapi.service';


export class	Provincia		extends ApiBase				{	get api_name () { return 'provincia'		}		
	nombre			?:string;
}
export class	Municipio		extends ApiBase				{	get api_name () { return 'municipio'		}	
	nombre			?:string;
}
export class	Direccion		extends ApiBase				{	get api_name () { return 'direccion'		}	
	via					?:string;
	codigo_postal		?:string;
	municipio_id		?:number;
	provincia_id		?:number;
}
export class	ClaseExpediente	extends ApiBase				{	get api_name () { return 'claseexpediente'	}
	id					:number
	nombre				?:string;
	prefijo				?:string;
	sufijo				?:string;
	digitos				?:number;
}
export class	Grupo			extends ApiBase				{	get api_name () { return 'grupo'			}	
	id					:number
	numero				?:number;
	nombre				?:string;
	
	///	Variables internas del frontend
	__visible			?:boolean;	//	Si es visible
} 
export class	Activo			extends ApiBase				{	get api_name () { return 'activo'			}	
	id					:number
	numero				?:number;
	nombre				?:string;
	direccion_id		?:number;
}

enum			ENCARGO	{	  
	SOLICITADO	, 				//	Planificación
	PENDIENTE_PRESUPUESTO,		
	PRESUPUESTADO	, 
	PARADO	, 					//	Planificación
	ACEPTADO		, 			//	Planificación
	NO_ACEPTADO	, 
	CANCELADO, 
	TERMINADO	
};
export const	ENCARGO_PLANIFICACION = [ ENCARGO.SOLICITADO, ENCARGO.PARADO, ENCARGO.ACEPTADO ]
export class	Encargo			extends ApiBase				{	get api_name () { return 'encargo'			}
	id					:number
	clase_id			?:number;
	numero				?:number;
	activo_id			?:number;
	estado				?:number;
	objeto				?:string;
	contenido			?:string;
	asignado_a_id		?:number;
	horas_estimadas		?:number;
	fecha_programada	?:string; // Aunque le pusiésemos Date se almacenará como string
	fecha_limite		?:string; // Aunque le pusiésemos Date se almacenará como string
	
	///	Variables generadas que no pertenecen a la base de datos: comienzan por '_'. Pueden ser generadas por el servidor backend.
	_codigo				?:string
	_codigocol			?:string
	_activo_html		?:string
	
	
	///	Variables internas del frontend por operatividad. Es imposible que las mande el servidor python, puesto que empezando '__' hace "name mangling" y cambia los nombres a _ClassName__identifier)
	__left_pct			?:number;
	__zindex			?:number;	
	__width_pct			?:number;
	__fprgfmt			?:string;
	__href				?:string;
	
	///	Métodos
	estado_tx ()	: string {
		switch ( this.estado ){
			case ENCARGO.SOLICITADO:			{return 'Solicitado'}
			case ENCARGO.PENDIENTE_PRESUPUESTO:	{return 'Pendente de presupuestar'}
			case ENCARGO.PRESUPUESTADO:			{return 'Presupuestado'}
			case ENCARGO.PARADO:				{return 'Parado'}
			case ENCARGO.ACEPTADO:				{return 'Aceptado'}
			case ENCARGO.NO_ACEPTADO:			{return 'No aceptado'}
			case ENCARGO.CANCELADO:				{return 'Cancelado'}
			case ENCARGO.TERMINADO:				{return 'Terminado'}
			default:							{return null;}
				
		}
	};
	estado_planificacion():boolean {
		return ENCARGO_PLANIFICACION.includes(this.estado) 
	}
};
	


export class	GrupoList		extends ApiListBase<Grupo		>
																	{	get api_name () { return 'grupo'			} }
																	// {	get api_path () {return 'api/noexiste' 		} }	//	pruebas
export class	EncargoList		extends ApiListBase<Encargo		> 	{	get api_name () { return 'encargo'			} }




// export class	GrupoList		extends ApiList<Grupo		> {	public static readonly api_path = API_ROOT+'activo/'; }
// export class	EncargoList		extends ApiList<Encargo		> {	public static readonly api_path = API_ROOT+'activo/'; }
