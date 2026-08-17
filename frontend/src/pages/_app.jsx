import "../styles/globals.css";
import { AuthProvider } from "../context/AuthContext";
import { PracticeSessionProvider } from "../context/PracticeSessionContext";
import NavBar from "../components/NavBar";

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <PracticeSessionProvider>
        <NavBar />
        <Component {...pageProps} />
      </PracticeSessionProvider>
    </AuthProvider>
  );
}
