import { ThemeProvider } from "next-themes";
import { useRouter } from "next/router";
import Head from "next/head";
import "../styles/globals.css";
import { sans, serif } from "../lib/fonts";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { PracticeSessionProvider } from "../context/PracticeSessionContext";
import NavBar from "../components/NavBar";
import MobileTabBar from "../components/MobileTabBar";

function Shell({ Component, pageProps }) {
  const router = useRouter();
  const { user } = useAuth();
  const isAuthPage = router.pathname === "/login" || router.pathname === "/register";
  const showMobileNav = Boolean(user) && !isAuthPage;

  return (
    <>
      <NavBar />
      <div className={showMobileNav ? "pb-16 sm:pb-0" : ""}>
        <Component {...pageProps} />
      </div>
      {showMobileNav && <MobileTabBar />}
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
