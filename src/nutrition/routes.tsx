import { lazy } from 'react';
import { TodayScreen } from './screens/TodayScreen';

/**
 * Every screen of the nutrition diary, all under /dieta. The standalone app mounts these as they are; a
 * merged app adds them next to its own routes and a "Dieta" tab pointing at /dieta.
 */
const AddScreen = lazy(() => import('./screens/AddScreen').then((m) => ({ default: m.AddScreen })));
const ProductForm = lazy(() => import('./screens/ProductForm').then((m) => ({ default: m.ProductForm })));
const ProductsScreen = lazy(() => import('./screens/ProductsScreen').then((m) => ({ default: m.ProductsScreen })));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })));

export const NUTRITION_ROUTES = [
  { path: '/dieta', element: <TodayScreen /> },
  { path: '/dieta/dodaj', element: <AddScreen /> },
  { path: '/dieta/produkty', element: <ProductsScreen /> },
  { path: '/dieta/produkt/:id', element: <ProductForm /> },
  { path: '/dieta/ustawienia', element: <SettingsScreen /> },
];
