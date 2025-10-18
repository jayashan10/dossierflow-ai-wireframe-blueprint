import { useMemo, useState } from 'react';
import { Diff } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from './ui/drawer';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import type { DocumentVersion } from '../data/mockData';

interface VersionHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  versions: DocumentVersion[];
  onRestore: (versionId: string) => void;
}

export function VersionHistoryDrawer({ open, onClose, versions, onRestore }: VersionHistoryDrawerProps) {
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);

  const currentVersion = versions[0];
  const compareVersion = useMemo(() => versions.find((version) => version.id === compareVersionId), [compareVersionId, versions]);

  return (
    <Drawer open={open} onOpenChange={(value) => !value && onClose()}>
      <DrawerContent className="h-[80vh]">
        <DrawerHeader>
          <DrawerTitle>Version History</DrawerTitle>
          <DrawerDescription>Review prior versions for 2.6.2 and manage rollbacks.</DrawerDescription>
        </DrawerHeader>
        <div className="flex h-full overflow-hidden">
          <div className="w-72 border-r overflow-auto">
            <ul className="divide-y">
              {versions.map((version) => (
                <li key={version.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">{version.label}</h4>
                    {version.status === 'Approved' && (
                      <Badge variant="secondary" className="text-xs">Approved</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{version.createdAt} by {version.author}</p>
                  <p className="text-sm text-muted-foreground">{version.summary}</p>
                  <div className="flex flex-col gap-2 pt-2">
                    <Button size="sm" onClick={() => onRestore(version.id)}>
                      Restore this version
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setCompareVersionId(version.id)}
                    >
                      <Diff className="h-4 w-4" />
                      Compare with current
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex-1 p-6 overflow-auto">
            {compareVersion ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-2">Comparison Preview</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Highlighted differences between the current draft and {compareVersion.label}.
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-sm leading-relaxed">
                    <div className="rounded-md border p-4 bg-muted/20">
                      <h4 className="font-medium mb-2">Current Draft</h4>
                      <p className="text-muted-foreground whitespace-pre-wrap">{currentVersion?.content ?? 'No preview available.'}</p>
                    </div>
                    <div className="rounded-md border p-4 bg-emerald-50">
                      <h4 className="font-medium mb-2">{compareVersion.label}</h4>
                      <p className="text-emerald-700 whitespace-pre-wrap">{compareVersion.content ?? 'No preview available.'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground">
                <Diff className="h-6 w-6 mb-3" />
                Select a version to compare against the current draft.
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
