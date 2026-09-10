import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Download } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchMyCertificates, certificatePdfUrl } from "../../services/certificatesService";
import CertificateView from "../../components/CertificateView";
import Button from "../../components/ui/Button";
import Skeleton from "../../components/ui/Skeleton";
import ErrorState from "../../components/ui/ErrorState";

export default function CertificatePage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, isLoading: isAuthLoading } = useAuth();

  const [status, setStatus] = useState("loading"); // loading | ok | missing
  const [cert, setCert] = useState(null);

  useEffect(() => {
    if (!isAuthLoading && !user) router.replace("/login");
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (!router.isReady || !id || !user) return;
    let active = true;
    setStatus("loading");
    fetchMyCertificates()
      .then((list) => {
        if (!active) return;
        const match = list.find((c) => c.certificate_id === String(id));
        setCert(match ?? null);
        setStatus(match ? "ok" : "missing");
      })
      .catch(() => active && setStatus("missing"));
    return () => {
      active = false;
    };
  }, [router.isReady, id, user]);

  if (isAuthLoading || !user) return null;

  return (
    <div className="min-h-[calc(100vh-57px)] bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl">
        {status === "loading" && <Skeleton className="aspect-[297/210] w-full" />}

        {status === "missing" && (
          <ErrorState
            title="Certificate not found"
            description="No certificate with this ID belongs to your account."
          />
        )}

        {status === "ok" && cert && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-h2 text-text-primary">{cert.recipient_name}</h1>
                <p className="text-body-sm text-text-muted">
                  {cert.exam_label} · {cert.score_percent}% · ID {cert.certificate_id}
                </p>
              </div>
              <Button
                href={certificatePdfUrl(cert.certificate_id, { download: true })}
                tone="test"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download PDF
              </Button>
            </div>

            <CertificateView
              recipientName={cert.recipient_name}
              examLabel={cert.exam_label}
              scorePercent={cert.score_percent}
              issuedAt={cert.issued_at}
              certificateId={cert.certificate_id}
            />
          </>
        )}
      </div>
    </div>
  );
}
