import { redirect } from "next/navigation";

// The marketing homepage (design/home-blue) moves in next; until then the app opens on the customer's account.
export default function Home() {
  redirect("/account");
}
