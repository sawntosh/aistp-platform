import Dialog from "./ui/Dialog";
import Button from "./ui/Button";

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) {
  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      {message && <p className="mt-1 text-body-sm text-text-muted">{message}</p>}
      <div className="mt-6 flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="primary" tone="destructive" className="flex-1" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
