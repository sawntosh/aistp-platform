import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { BookOpen } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchStudyDomains } from "../../services/studyService";
import StudyDomainCard from "../../components/StudyDomainCard";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import ErrorState from "../../components/ui/ErrorState";
import EmptyState from "../../components/ui/EmptyState";

export default function StudyHomePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [domains, setDomains] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login");
    }
  }, [isAuthLoading, user, router]);

  async function loadDomains() {
    setLoadError("");
    setDomains(null);
    try {
      setDomains(await fetchStudyDomains());
    } catch {
      setLoadError("Couldn't load Study Mode. Try again.");
    }
  }

  useEffect(() => {
    if (user) loadDomains();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (isAuthLoading || !user) return null;

  return (
    <div className="min-h-[calc(100vh-57px)] sm:min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow="Study Mode"
          title="What would you like to study?"
          description="Pick a CTFL domain to start. No scores — just concepts and practice questions."
        />

        {domains === null && !loadError && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Loading domains">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        )}

        {loadError && <ErrorState description={loadError} onRetry={loadDomains} />}

        {domains && domains.length === 0 && (
          <EmptyState icon={BookOpen} title="No study domains yet" description="Domains will appear here once an admin adds study content." />
        )}

        {domains && domains.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {domains.map((domain, index) => (
              <StudyDomainCard key={domain.id} domain={domain} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
