import { useMemo } from 'react';
import { ChevronRight, Loader2, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Badge } from './ui/badge';
import type { StreamEvent, FileWrittenEvent } from '../lib/api';

interface StreamingPreviewProps {
  content: string;
  events: Array<StreamEvent | FileWrittenEvent>;
  isStreaming: boolean;
  error?: string | null;
}

interface ToolCallGroup {
  tool: string;
  startEvent: StreamEvent;
  resultEvent?: StreamEvent;
}

export function StreamingPreview({ content, events, isStreaming, error }: StreamingPreviewProps) {
  const streamEvents = useMemo(() => {
    return events.filter((event): event is StreamEvent => event.type !== 'file_written');
  }, [events]);

  // Group tool calls with their results
  const toolCalls = useMemo(() => {
    const groups: ToolCallGroup[] = [];

    for (const event of streamEvents) {
      if (event.type === 'tool_start' && event.tool) {
        // Create a new group for this tool call
        groups.push({
          tool: event.tool,
          startEvent: event
        });
      } else if (event.type === 'tool_result' && event.tool) {
        // Find the matching start and add result
        const lastGroup = [...groups].reverse().find(g => g.tool === event.tool && !g.resultEvent);
        if (lastGroup) {
          lastGroup.resultEvent = event;
        }
      }
    }

    return groups;
  }, [streamEvents]);

  // Extract thinking events
  const thinkingEvents = useMemo(() => {
    return streamEvents.filter((e) => e.type === 'thinking');
  }, [streamEvents]);

  const runSummary = useMemo(() => {
    const completed = [...streamEvents].reverse().find((event) => event.type === 'run_completed' || event.type === 'complete');
    if (!completed) {
      return null;
    }

    return {
      runId: completed.runId,
      usage: completed.usage,
      toolsUsed: completed.toolsUsed,
      turnsCompleted: completed.turnsCompleted
    };
  }, [streamEvents]);

  const fileWrites = useMemo(() => {
    return events.filter((event): event is FileWrittenEvent => event.type === 'file_written');
  }, [events]);

  const syncWarnings = useMemo(() => {
    return streamEvents.filter((event) => event.type === 'sync_failed' && Boolean(event.error));
  }, [streamEvents]);

  // Get latest activity for status display
  const latestActivity = useMemo(() => {
    const lastToolCall = toolCalls[toolCalls.length - 1];
    if (!lastToolCall) return null;

    if (lastToolCall.resultEvent) {
      return { type: 'completed', tool: lastToolCall.tool };
    }
    return { type: 'running', tool: lastToolCall.tool };
  }, [toolCalls]);

  const completedToolCount = toolCalls.filter(t => t.resultEvent).length;
  const pendingToolCount = toolCalls.filter(t => !t.resultEvent).length;

  const getToolIcon = (tool: string) => {
    switch (tool) {
      case 'Read':
        return <FileText className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  const getToolDescription = (tool: string, input?: unknown) => {
    if (tool === 'Read' && input && typeof input === 'object' && 'file_path' in input) {
      const path = (input as { file_path: string }).file_path;
      const filename = path.split('/').pop();
      return `Reading ${filename}`;
    }
    if (tool === 'Glob' && input && typeof input === 'object' && 'pattern' in input) {
      return `Searching for ${(input as { pattern: string }).pattern}`;
    }
    if (tool === 'Bash' && input && typeof input === 'object' && 'command' in input) {
      const cmd = (input as { command: string }).command;
      return `Running: ${cmd.slice(0, 50)}${cmd.length > 50 ? '...' : ''}`;
    }
    return `Using ${tool}`;
  };

  return (
    <div className="border rounded-md p-4 space-y-4 bg-background">
      {/* Status indicator */}
      {isStreaming && (
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-muted-foreground">
            {latestActivity?.type === 'running'
              ? getToolDescription(latestActivity.tool, toolCalls[toolCalls.length - 1]?.startEvent.input)
              : 'Processing...'}
          </span>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Thinking indicator */}
      {thinkingEvents.length > 0 && isStreaming && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-90" />
            <span>Agent thinking...</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 pl-5">
            <div className="text-xs text-muted-foreground italic bg-muted/30 p-2 rounded max-h-32 overflow-auto">
              {thinkingEvents[thinkingEvents.length - 1]?.content}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Tool calls log */}
      {toolCalls.length > 0 && (
        <Collapsible defaultOpen={isStreaming}>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-90" />
            <span className="flex items-center gap-1.5">
              {completedToolCount > 0 && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-green-50 text-green-700 border-green-200">
                  {completedToolCount} completed
                </Badge>
              )}
              {pendingToolCount > 0 && isStreaming && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-blue-50 text-blue-700 border-blue-200">
                  {pendingToolCount} running
                </Badge>
              )}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 pl-5 space-y-1 max-h-48 overflow-y-auto">
            {toolCalls.map((group, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs font-mono py-1"
              >
                {group.resultEvent || !isStreaming ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                ) : (
                  <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                )}
                <span className={group.resultEvent || !isStreaming ? 'text-muted-foreground' : 'text-foreground'}>
                  {getToolDescription(group.tool, group.startEvent.input)}
                </span>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {fileWrites.length > 0 && (
        <div className="text-xs space-y-1">
          {fileWrites.map((writeEvent, index) => (
            <div key={`${writeEvent.path}-${index}`} className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-3 w-3" />
              <span className="font-mono">Wrote {writeEvent.path}</span>
            </div>
          ))}
        </div>
      )}

      {syncWarnings.length > 0 && (
        <div className="text-xs space-y-1">
          {syncWarnings.map((warning, index) => (
            <div key={`sync-${index}`} className="flex items-center gap-2 text-amber-700">
              <AlertCircle className="h-3 w-3" />
              <span>{warning.error}</span>
            </div>
          ))}
        </div>
      )}

      {/* Streaming content */}
      {(content || isStreaming) && (
        <div className="prose prose-sm max-w-none">
          <div className="text-sm whitespace-pre-wrap leading-relaxed">
            {content}
            {isStreaming && !content && (
              <span className="text-muted-foreground italic">Waiting for response...</span>
            )}
            {isStreaming && content && (
              <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5" />
            )}
          </div>
        </div>
      )}

      {/* Completion status */}
      {!isStreaming && content && !error && (
        <div className="space-y-1 pt-2 border-t">
          <div className="flex items-center gap-2 text-xs text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            <span>Generation complete</span>
          </div>
          {runSummary && (
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{runSummary.runId || 'run'}</span>
              {typeof runSummary.turnsCompleted === 'number' && (
                <span> • {runSummary.turnsCompleted} turns</span>
              )}
              {runSummary.toolsUsed?.length ? (
                <span> • tools: {runSummary.toolsUsed.join(', ')}</span>
              ) : null}
              {runSummary.usage ? (
                <span> • tokens: {runSummary.usage.totalTokens}</span>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
