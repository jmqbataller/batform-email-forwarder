export default function DashboardLoading() {
  return (
    <div className="dashboard" aria-busy="true" aria-label="Loading dashboard">
      <div className="loading-title" />
      <div className="stats-grid"><div className="loading-card" /><div className="loading-card" /><div className="loading-card" /></div>
      <div className="loading-panel" />
    </div>
  );
}
