import { useEffect } from "react";
import { useStudio } from "@/store/studio";
import { LeftPane } from "@/features/shell/LeftPane";
import { RightPane } from "@/features/shell/RightPane";
import { SplitPane } from "@/components/SplitPane";
import { ChatView } from "@/features/chat/ChatView";
import { LeftHeader } from "@/features/shell/Header";
import { StreamProvider } from "@/features/run/StreamProvider";

export function App() {
  const bootstrap = useStudio((s) => s.bootstrap);
  const mode = useStudio((s) => s.mode);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <StreamProvider>
      <div className="flex h-full w-full flex-col overflow-hidden bg-bg-primary text-text-primary">
        {mode === "chat" ? (
          // Chat mode takes the whole window: one header, the feed, and the thread panel on the right
          <>
            <LeftHeader />
            <div className="flex min-h-0 flex-1 border-t border-border-secondary">
              <ChatView />
            </div>
          </>
        ) : (
          <SplitPane left={<LeftPane />} right={<RightPane />} storageKey="studio.split" />
        )}
      </div>
    </StreamProvider>
  );
}
