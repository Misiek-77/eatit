import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createNutritionRepository } from './nutrition/data/repository';
import { NutritionProvider } from './nutrition/state/NutritionProvider';
import { syncThemeAcrossTabs } from './shared/theme';
import './styles/tokens.css';
import './styles/app.css';
import './styles/nutrition.css';

syncThemeAcrossTabs();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NutritionProvider repository={createNutritionRepository()}>
      <App />
    </NutritionProvider>
  </StrictMode>,
);
