/**
 * TomAI Admin Panel - React Admin 5
 * Interface admin pour gestion users et abonnements
 */

import { Admin, Resource, ListGuesser, EditGuesser } from 'react-admin';
import simpleRestProvider from 'ra-data-simple-rest';

// Backend API URL (utilise env var ou fallback localhost)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Data provider REST standard pour React Admin
const dataProvider = simpleRestProvider(`${API_URL}/admin`);

function App() {
  return (
    <Admin
      dataProvider={dataProvider}
      title="TomAI Admin"
    >
      {/* Resource users avec auto-génération via Guesser */}
      <Resource
        name="users"
        list={ListGuesser}
        edit={EditGuesser}
      />
    </Admin>
  );
}

export default App;
