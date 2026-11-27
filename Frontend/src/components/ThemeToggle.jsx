export default function ThemeToggle({ dark, onToggle }) {
  return (
    <button
      type="button"
      className="sr-theme-toggle"
      onClick={onToggle}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      title={`Switch to ${dark ? 'light' : 'dark'} mode`}
    >
      <span aria-hidden="true">{dark ? '☀' : '☾'}</span>
      <span>{dark ? 'Light' : 'Dark'} mode</span>
    </button>
  );
}
