import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import Browse from './pages/Browse';
import Favorites from './pages/Favorites';
import Tags from './pages/Tags';

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Browse />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/tags" element={<Tags />} />
            <Route path="/tags/:tagId" element={<Tags />} />
          </Routes>
        </Layout>
      </AppProvider>
    </BrowserRouter>
  );
}
