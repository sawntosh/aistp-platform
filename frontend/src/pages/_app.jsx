import "../styles/globals.css";
import { AuthProvider } from "../context/AuthContext";
import NavBar from "../components/NavBar";

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <NavBar />
      <Component {...pageProps} />
    </AuthProvider>
  );
}
