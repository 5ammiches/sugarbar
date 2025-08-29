import { createFileRoute } from "@tanstack/react-router";
import { BarGenerator } from "../components/BarGenerator";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen">
      <div className="flex justify-center items-center h-full">
        UI In Progress 😊
      </div>
    </div>
  );
}
