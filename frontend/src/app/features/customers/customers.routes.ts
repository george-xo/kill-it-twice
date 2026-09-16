import type { Routes } from '@angular/router';

import { CustomerDetailsComponent } from './customer-details/customer-details.component';
import { CustomersComponent } from './customers.component';

export const CUSTOMERS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: CustomersComponent,
  },
  {
    path: ':customerId',
    component: CustomerDetailsComponent,
  },
];
