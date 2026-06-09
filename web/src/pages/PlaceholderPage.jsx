import AppLayout from '../components/AppLayout.jsx';

// Temporary stub for screens coming in later phases (Tickets, Board, Dashboard).
export default function PlaceholderPage({ title, phase }) {
  return (
    <AppLayout>
      <div className="grid h-full place-items-center">
        <div className="max-w-md rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="mb-3 text-4xl">🚧</div>
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <p className="mt-2 text-sm text-slate-500">
            This screen is planned for <span className="font-semibold">{phase}</span>. The
            navigation, auth, roles and user management are live — this page is the next build.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
