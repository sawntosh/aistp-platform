import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";
import { fetchStudyDomains } from "../../services/studyService";
import StudyDomainCard from "../../components/StudyDomainCard";

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
      setLoadError("Couldn't load Study Mode right now.");
    }
  }

  useEffect(() => {
    if (user) loadDomains();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (isAuthLoading || !user) return null;

  return (
    <div className="min-h-[calc(100vh-49px)] bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">📖 Study Mode</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">What would you like to study?</h1>
        <p className="mt-1 text-sm text-gray-500">
          Choose a CTFL domain to start learning. No scores, no pressure — just concepts and practice questions.
        </p>

        <div className="mt-8">
          {domains === null && !loadError && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Loading domains">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl border-2 border-gray-100 bg-gray-100" />
              ))}
            </div>
          )}

          {loadError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-sm text-red-700">{loadError}</p>
              <button
                type="button"
                onClick={loadDomains}
                className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 active:scale-[0.98]"
              >
                Try again
              </button>
            </div>
          )}

          {domains && domains.length === 0 && (
            <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
              No study domains are available yet.
            </p>
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
    </div>
  );
}
