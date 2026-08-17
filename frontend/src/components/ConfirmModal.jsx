export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 animate-fade-in">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg animate-pop">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.98]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-red-500 active:scale-[0.98]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
