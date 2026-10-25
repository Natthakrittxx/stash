import { Landing } from "~/app/landing";

// Static: src/middleware.ts forks logged-in visitors to /stash before this
// renders, so anonymous visitors get the landing straight from the CDN.
export default function Home() {
  return <Landing />;
}
