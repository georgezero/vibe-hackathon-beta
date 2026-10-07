import "./people.css";

export default function PeopleAccessLoading() {
  return (
    <main className="people-page" aria-busy="true" aria-label="Loading people and access">
      <header className="people-header">
        <div>
          <div className="people-skeleton people-skeleton-title" />
          <div className="people-skeleton people-skeleton-copy" />
        </div>
        <div className="people-skeleton people-skeleton-action" />
      </header>
      <section className="people-summary" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <div key={item}>
            <div className="people-skeleton people-skeleton-label" />
            <div className="people-skeleton people-skeleton-number" />
          </div>
        ))}
      </section>
      <section className="people-console" aria-hidden="true">
        <div className="people-toolbar">
          <div className="people-skeleton people-skeleton-search" />
        </div>
        <div className="people-loading-rows">
          {[0, 1, 2, 3, 4].map((item) => (
            <div className="people-loading-row" key={item}>
              <div className="people-skeleton people-skeleton-avatar" />
              <div>
                <div className="people-skeleton people-skeleton-name" />
                <div className="people-skeleton people-skeleton-email" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
