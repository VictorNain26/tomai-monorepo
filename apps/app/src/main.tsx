import './index.css';
import { StrictMode } from 'react';
// Removed unused lucide-react imports
// Removed unused formatters imports
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (rootElement == null) {
  throw new Error('Failed to find the root element');
}

const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
