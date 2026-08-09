import { AuthGate } from "@/components/chat/auth-gate";
import { WorkspaceShell } from "@/components/chat/workspace-shell";

export default function Home() {
  return (
    <AuthGate>
      <WorkspaceShell />
    </AuthGate>
  );
}
