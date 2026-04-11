// Server-rendered placeholder shown until the client store hydrates from
// localStorage. Mirrors the rough layout to avoid layout shift on hydration.
export function BoardSkeleton() {
  return (
    <div className="board flex-1 p-[var(--pile-gap)]">
      <div className="grid grid-cols-7 gap-[var(--pile-gap)] mb-[calc(var(--pile-gap)*2)]">
        <div className="card-slot card-slot--empty" />
        <div className="card-slot card-slot--empty" />
        <div />
        <div className="card-slot card-slot--empty" />
        <div className="card-slot card-slot--empty" />
        <div className="card-slot card-slot--empty" />
        <div className="card-slot card-slot--empty" />
      </div>
      <div className="grid grid-cols-7 gap-[var(--pile-gap)]">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="tableau-column">
            <div className="card-slot card-slot--empty" />
          </div>
        ))}
      </div>
    </div>
  );
}
