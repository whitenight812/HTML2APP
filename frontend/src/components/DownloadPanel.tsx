interface Props {
  apkUrl: string;
  taskId: string;
  onNewBuild: () => void;
}

/** Placeholder - will be fully implemented in Task 15 */
export default function DownloadPanel({ apkUrl, taskId, onNewBuild }: Props) {
  return (
    <div className="mt-6 p-4 bg-white border border-gray-200 rounded-lg">
      <h3 className="font-semibold text-gray-900">DownloadPanel (Task 15)</h3>
      <div className="mt-2 space-y-2 text-sm text-gray-600">
        <p>APK URL: {apkUrl}</p>
        <p>Task ID: {taskId}</p>
      </div>
      <button
        onClick={onNewBuild}
        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        New Build
      </button>
    </div>
  );
}
