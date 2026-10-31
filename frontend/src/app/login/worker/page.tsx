import type { Metadata } from "next";
import { LoginScreen } from "../login-screen";

export const metadata: Metadata = { title: "Kaarigar login · suvidha" };

export default function WorkerLoginPage() {
  return <LoginScreen role="worker" />;
}
