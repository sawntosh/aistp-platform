import { ThemeProvider } from "next-themes";
import { useRouter } from "next/router";
import Head from "next/head";
import "../styles/globals.css";
import { sans, serif } from "../lib/fonts";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { PracticeSessionProvider } from "../context/PracticeSessionContext";
import NavBar from "../components/NavBar";
import Sidebar, { SIDEBAR_WIDTH_CLASS } from "../components/Sidebar";
import MobileTabBar from "../components/MobileTabBar";

function Shell({ Component, pageProps }) {
  const router = useRouter();
  const { user } = useAuth();
  const isAuthPage = router.pathname === "/login" || router.pathname === "/register";
  const isAppUser = Boolean(user) && !isAuthPage;

  return (
    <>
      {isAppUser ? (
        <>
          <Sidebar />
          {/* Mobile-only header (logo + user menu + theme); Sidebar covers sm+ */}
          <NavBar compact />
        </>
      ) : (
        <NavBar />
      )}
      <div className={[isAppUser && SIDEBAR_WIDTH_CLASS, isAppUser && "pb-16 sm:pb-0"].filter(Boolean).join(" ")}>
        <Component {...pageProps} />
      </div>
      {isAppUser && <MobileTabBar />}
    </>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <Head>
        <title>AISTP · ISTQB CTFL Practice Platform</title>
        <meta name="description" content="Study and test yourself for the ISTQB Certified Tester Foundation Level exam with AI-guided explanations and domain analytics." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={`${sans.variable} ${serif.variable} font-sans`}>
        <AuthProvider>
          <PracticeSessionProvider>
            <Shell Component={Component} pageProps={pageProps} />
          </PracticeSessionProvider>
        </AuthProvider>
      </div>
    </ThemeProvider>
  );
}
