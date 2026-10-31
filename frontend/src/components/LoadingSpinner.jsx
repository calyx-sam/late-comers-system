/**
 * Loading spinner component.
 */

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="spinner-overlay">
      <div className="text-center">
        <div className="spinner-border text-primary mb-3" role="status">
          <span className="visually-hidden">{message}</span>
        </div>
        <p className="text-muted">{message}</p>
      </div>
    </div>
  );
}
