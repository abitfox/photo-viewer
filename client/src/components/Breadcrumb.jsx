import { useNavigate } from 'react-router-dom';

export default function Breadcrumb({ path, onNavigate }) {
  const navigate = useNavigate();

  if (!path) return null;

  const parts = path.split('/').filter((p) => p !== '');

  const handleClick = (targetPath) => {
    if (onNavigate) {
      onNavigate(targetPath);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs mt-3">
      <button
        onClick={() => handleClick('/')}
        className="px-2.5 py-1 rounded-lg bg-dark-400/60 text-primary font-semibold hover:bg-primary/30 transition-colors"
        title="/"
      >
        🏠
      </button>
      <span className="text-gray-500">/</span>

      {parts.map((part, index) => {
        const accumulatedPath = '/' + parts.slice(0, index + 1).join('/');
        const isLast = index === parts.length - 1;

        return (
          <span key={index} className="flex items-center gap-1">
            {isLast ? (
              <span className="px-2.5 py-1 rounded-lg bg-primary/50 text-white cursor-default max-w-[200px] truncate">
                {part}
              </span>
            ) : (
              <button
                onClick={() => handleClick(accumulatedPath)}
                className="px-2.5 py-1 rounded-lg bg-dark-400/40 text-gray-400 hover:bg-primary/30 hover:text-white transition-colors max-w-[200px] truncate"
              >
                {part}
              </button>
            )}
            {!isLast && <span className="text-gray-500">/</span>}
          </span>
        );
      })}
    </div>
  );
}
