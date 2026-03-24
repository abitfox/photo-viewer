import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const navItems = [
  { path: '/', view: 'browse', label: '浏览', icon: '📁' },
  { path: '/favorites', view: 'favorites', label: '收藏', icon: '⭐' },
  { path: '/tags', view: 'tags', label: '标签', icon: '🏷️' },
];

export default function Header() {
  const location = useLocation();
  const { currentView, setCurrentView } = useApp();

  const handleNav = (view) => {
    setCurrentView(view);
  };

  return (
    <header className="sticky top-0 z-50 bg-dark-200/95 backdrop-blur-md border-b border-primary/20 shadow-lg">
      <div className="px-5 py-3">
        <div className="flex items-center justify-between gap-5">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent whitespace-nowrap">
              📸 照片浏览器
            </h1>
          </div>

          <nav className="flex gap-1 bg-black/30 p-1 rounded-xl">
            {navItems.map((item) => (
              <Link
                key={item.view}
                to={item.path}
                onClick={() => handleNav(item.view)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
                  location.pathname === item.path
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                <span>{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
