import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { Failure } from './components/failure';
import { isProblem } from './lib/api';
import { routeTree } from './routeTree.gen';
import '@fontsource-variable/nunito';
import './styles.css';

// A session gone while a screen is open (expired, revoked elsewhere): back to the sign-in, nothing cached.
const onError = (error: unknown) => {
  if (!isProblem(error, 'UNAUTHENTICATED')) return;
  queryClient.clear();
  void router.navigate({ to: '/connexion' });
};
const queryClient = new QueryClient({ queryCache: new QueryCache({ onError }), mutationCache: new MutationCache({ onError }) });
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultErrorComponent: Failure,
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const root = document.getElementById('app');
if (!root) throw new Error('#app is missing from index.html');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
