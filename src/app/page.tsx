import { SleeveEntry } from "@/components/sleeve/sleeve-entry";

export default function Home() {
  const allowDemo =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ENABLE_DEMO === "true";
  return <SleeveEntry allowDemo={allowDemo} />;
}
