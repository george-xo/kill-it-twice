import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then(
        ({ DASHBOARD_ROUTES }) => DASHBOARD_ROUTES,
      ),
  },
  {
    path: 'customers',
    loadChildren: () =>
      import('./features/customers/customers.routes').then(
        ({ CUSTOMERS_ROUTES }) => CUSTOMERS_ROUTES,
      ),
  },
  {
    path: 'operations',
    loadChildren: () =>
      import('./features/operations/operations.routes').then(
        ({ OPERATIONS_ROUTES }) => OPERATIONS_ROUTES,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
