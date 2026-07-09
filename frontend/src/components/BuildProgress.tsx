import type { BuildStatus } from '../types';

interface Props {
  status: BuildStatus | null;
  error: string | null;
  onDone: (apkUrl: string | null) => void;
}

/** Placeholder - will be fully implemented in Task 15 */
export default function BuildProgress({ status, error, onDone }: Props) {
  return (
    <div className="mt-6 p-4 bg-white border border-gray-200 rounded-lg">
      <h3 className="font-semibold text-gray-900">BuildProgress (Task 15)</h3>
      {status && (
        <div className="mt-2 space-y-2 text-sm text-gray-600">
          <p>Status: {status.status}</p>
          <p>Progress: {status.progress}%</p>
          {status.currentStep && <p>Step: {status.currentStep}</p>}
          {error && <p className="text-red-600">Error: {error}</p>}
          {status.status === 'done' && status.apkUrl && (
            <button
              onClick={() => onDone(status.apkUrl)}
              className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg"
            >
              Complete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
