import type { Metadata } from "next";
import { LoginScreen } from "../login-screen";

export const metadata: Metadata = { title: "Worker login · suvidha" };

export default function WorkerLoginPage() {
  return <LoginScreen role="worker" />;
}
