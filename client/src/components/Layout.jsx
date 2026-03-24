import { useApp } from '../context/AppContext';
import Header from './Header';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-4 max-w-[1800px]">
        {children}
      </main>
    </div>
  );
}
