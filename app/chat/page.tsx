import { AuthGate } from "@/components/chat/auth-gate";
import { WorkspaceShell } from "@/components/chat/workspace-shell";

export default function ChatPage() {
  return (
    <AuthGate>
      <WorkspaceShell />
    </AuthGate>
  );
}
