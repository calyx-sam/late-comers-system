/**
 * Stat card — shows a metric value with icon and label.
 */

export default function StatCard({ icon: Icon, value, label, color = 'blue', className = '' }) {
  return (
    <div className={`stat-card ${className}`}>
      <div className={`stat-card-icon ${color}`}>
        {Icon && <Icon />}
      </div>
      <div>
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
      </div>
    </div>
  );
}
