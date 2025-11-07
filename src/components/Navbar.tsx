interface NavbarProps {
  timestamp: string;
}

export default function Navbar({ timestamp }: NavbarProps) {
  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-8">
          <h1 className="text-base font-semibold text-gray-900">
            Tempur-Pedic Reconciliation
          </h1>
          <div className="flex gap-6 text-sm font-medium">
            <span className="text-gray-900 border-b-2 border-blue-500 pb-2">
              Dashboard
            </span>
            <span className="text-gray-400 pb-2 cursor-not-allowed">History</span>
            <span className="text-gray-400 pb-2 cursor-not-allowed">Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>Last processed: {timestamp}</span>
          <span className="bg-indigo-50 text-indigo-700 font-semibold px-3 py-1 rounded-full border border-indigo-200">
            PROTOTYPE
          </span>
        </div>
      </div>
    </nav>
  );
}
