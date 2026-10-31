import type { Metadata } from "next";
import { LoginScreen } from "./login-screen";

export const metadata: Metadata = { title: "Login · suvidha" };

export default function LoginPage() {
  return <LoginScreen role="customer" />;
}
