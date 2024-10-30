import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

//	Interacción con API en backend
import { HttpClientModule, HttpClientXsrfModule } from '@angular/common/http';
// import { HTTP_INTERCEPTORS 						} from '@angular/common/http';	// Para HttpErrorInterceptor. No utilizado, se deja como referencia
// import { HttpErrorInterceptor 					} from './bckapi.service';		// Para HttpErrorInterceptor. No utilizado, se deja como referencia

import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

///	@angular/material
import { MatProgressBarModule	} from '@angular/material/progress-bar'
import { MatListModule			} from '@angular/material/list'
import { MatSelectModule		} from '@angular/material/select'

///	Fechas: Angular material con MatMomentDateModule
import { MatDatepickerModule	} from '@angular/material/datepicker'
// import {MatNativeDateModule} from '@angular/material/core';
// import { NativeDateAdapter } from '@angular/material';
import { MatFormFieldModule		} from '@angular/material/form-field'
// import { MatInputModule			} from '@angular/material/input'
import { MAT_DATE_FORMATS } from '@angular/material/core';	//http://brickydev.com/angular-material-datepicker-with-many-custom-date-formats/
export const FORMAT = {
  parse: {
      dateInput: 'DD-MM-YYYY',
  },
  display: {
      dateInput: 'DD-MM-YYYY',
      monthYearLabel: 'MMM YYYY',
      dateA11yLabel: 'LL',
      monthYearA11yLabel: 'MMMM YYYY',
  },
}


///	ReactiveFormsModule vs Template Driven Forms https://blog.angular-university.io/introduction-to-angular-2-forms-template-driven-vs-model-driven/
import { ReactiveFormsModule } from '@angular/forms';
///	Drag n Drop
import {DragDropModule} from '@angular/cdk/drag-drop';
import { MenuComponent } from './menu/menu.component';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [
    AppComponent,
    MenuComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,												//	#ARV: necesario para poder utilizar HttpClient
    HttpClientXsrfModule.withOptions({								//	#ARV:	Para configurar el nombre de la cookie de protección CRSF del backend. Ver https://angular.io/guide/http#security-xsrf-protection 
                    cookieName: 'csrftoken',		// https://docs.djangoproject.com/en/2.2/ref/settings/#csrf-cookie-name 
                    headerName: 'X-CSRFToken', 		// https://docs.djangoproject.com/en/2.2/ref/settings/#csrf-header-name 
                    }), BrowserAnimationsModule,
    ///	@angular/material
    MatProgressBarModule,
    MatListModule,
    MatSelectModule,
    
    MatDatepickerModule ,
    
    // MatNativeDateModule,
    // NativeDateAdapter,
    MatFormFieldModule,
    // MatInputModule,
    
    ///	ReactiveFormsModule vs Template Driven Forms https://blog.angular-university.io/introduction-to-angular-2-forms-template-driven-vs-model-driven/
    ReactiveFormsModule,
    ///	Drag n Drop
    DragDropModule,
    AppRoutingModule,
    RouterModule
    
    ],
  providers: [
      // Para HttpErrorInterceptor. No utilizado, se deja como referencia
      /*{
      provide: HTTP_INTERCEPTORS,
      useClass: HttpErrorInterceptor,
      multi: true,
      },*/
      ///	Para MatMomentDateModule http://brickydev.com/angular-material-datepicker-with-many-custom-date-formats/
      { provide: MAT_DATE_FORMATS, useValue: FORMAT },
    ],
  bootstrap: [AppComponent]
})
export class AppModule { }
