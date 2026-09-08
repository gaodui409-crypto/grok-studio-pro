import { useCallback, useEffect, useRef, useState } from "react";
import { usePicaStore } from "@/lib/pica/store";
import { getDownloadManager } from "@/lib/pica/download-manager";
import type { DownloadTask, DownloadTaskState, ProgressData } from "@/lib/pica/types";
import {
  Play,
  Pause,
  X,
  RotateCcw,
  Trash2,
  Download as DownloadIcon,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

function stateLabel(state: DownloadTaskState): string {
  const labels: Record<DownloadTaskState, string> = {
    Pending: "等待中",
    Downloading: "下载中",
    Paused: "已暂停",
    Cancelled: "已取消",
    Completed: "已完成",
    Failed: "失败",
  };
  return labels[state] ?? state;
}

function stateColor(state: DownloadTaskState): string {
  if (state === "Completed") return "text-success";
  if (state === "Failed" || state === "Cancelled") return "text-destructive";
  if (state === "Downloading") return "text-primary";
  return "text-muted-foreground";
}

export function DownloadPane() {
  const { cancelTask, pauseTask, resumeTask, client } = usePicaStore();
  const dm = useRef(getDownloadManager(client)).current;
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [speed, setSpeed] = useState("0.00MB/s");
  const [directoryName, setDirectoryName] = useState<string | null>(() =>
    dm.getDownloadDirectoryName(),
  );

  useEffect(() => {
    const unsub = dm.onChange((change) => {
      if ("removed" in change) {
        setTasks((prev) => prev.filter((task) => task.chapterId !== change.removed));
        return;
      }
      const task = change;
      setTasks((prev) => {
        const next = [...prev];
        const idx = next.findIndex((t) => t.chapterId === task.chapterId);
        if (idx >= 0) next[idx] = task;
        else next.push(task);
        return next;
      });
    });
    const unsubSpeed = dm.onSpeedChange(setSpeed);
    setTasks(dm.getAllTasks());
    void dm.ready.catch((error) => toast.error(`下载记录读取失败：${(error as Error).message}`));
    return () => {
      unsub();
      unsubSpeed();
    };
  }, [dm]);

  const handlePause = useCallback(
    async (task: DownloadTask) => {
      try {
        await pauseTask(task.chapterId);
        toast.info(`已暂停: ${task.comic.title} - ${task.chapterInfo.title}`);
      } catch (error) {
        toast.error((error as Error).message);
      }
    },
    [pauseTask],
  );

  const handleResume = useCallback(
    async (task: DownloadTask) => {
      try {
        await resumeTask(task.chapterId);
        toast.info(`已恢复: ${task.comic.title} - ${task.chapterInfo.title}`);
      } catch (error) {
        toast.error((error as Error).message);
      }
    },
    [resumeTask],
  );

  const handleCancel = useCallback(
    async (task: DownloadTask) => {
      try {
        await cancelTask(task.chapterId);
        toast.info(`已取消: ${task.comic.title} - ${task.chapterInfo.title}`);
      } catch (error) {
        toast.error((error as Error).message);
      }
    },
    [cancelTask],
  );

  const handleRetry = useCallback(
    async (task: DownloadTask) => {
      try {
        await dm.retryTask(task.chapterId);
        toast.info(`重新下载: ${task.comic.title} - ${task.chapterInfo.title}`);
      } catch (error) {
        toast.error((error as Error).message);
      }
    },
    [dm],
  );

  const handleClearCompleted = useCallback(async () => {
    try {
      await dm.clearFinishedTasks();
      setTasks(dm.getAllTasks());
      toast.success("已清理结束的任务");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }, [dm]);

  const handleChooseDirectory = useCallback(async () => {
    const picker = (
      window as Window & {
        showDirectoryPicker?: (options?: {
          mode?: "read" | "readwrite";
        }) => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker;
    if (!picker) {
      toast.error("当前浏览器不支持选择保存目录，将使用默认下载目录");
      return;
    }
    try {
      const directory = await picker.call(window, { mode: "readwrite" });
      dm.setDownloadDirectory(directory);
      setDirectoryName(directory.name);
      toast.success(`新任务将保存到：${directory.name}`);
    } catch (error) {
      if ((error as Error).name !== "AbortError") toast.error((error as Error).message);
    }
  }, [dm]);

  const activeCount = tasks.filter(
    (t) => t.state === "Downloading" || t.state === "Pending",
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            下载队列 · {activeCount} 个进行中 / {tasks.length} 个任务
          </p>
          <p className="text-xs text-muted-foreground">下载速度: {speed}</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="max-w-full"
            onClick={handleChooseDirectory}
            title={directoryName ?? "选择保存目录"}
          >
            <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
            <span className="max-w-[200px] truncate">
              {directoryName ? `新任务保存到 ${directoryName}` : "选择保存目录"}
            </span>
          </Button>
          {tasks.some(
            (t) => t.state === "Completed" || t.state === "Cancelled" || t.state === "Failed",
          ) && (
            <Button variant="ghost" size="sm" onClick={handleClearCompleted}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              清理完成
            </Button>
          )}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          <DownloadIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
          暂无下载任务，去搜索或收藏页开始下载吧
        </div>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-2.5">
            {tasks.map((task) => {
              const progress: ProgressData = {
                ...task,
                percentage:
                  task.totalImgCount > 0
                    ? Math.round((task.downloadedImgCount / task.totalImgCount) * 100)
                    : 0,
                indicator: stateLabel(task.state),
              };
              return (
                <div
                  key={task.chapterId}
                  className="rounded-lg border border-border/60 bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight [overflow-wrap:anywhere]">
                        {task.comic.title}
                      </p>
                      <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                        第 {task.chapterInfo.order} 话 · {task.chapterInfo.title}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs font-medium ${stateColor(task.state)}`}>
                      {stateLabel(task.state)}
                    </span>
                  </div>

                  {task.totalImgCount > 0 && (
                    <div className="mt-3">
                      <Progress value={progress.percentage} className="h-1.5" />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {progress.downloadedImgCount} / {progress.totalImgCount} 张 ·{" "}
                        {progress.percentage}%
                      </p>
                    </div>
                  )}

                  {task.error && (
                    <p
                      role="alert"
                      className="mt-2 text-xs text-destructive [overflow-wrap:anywhere]"
                    >
                      {task.error}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-1.5">
                    {(task.state === "Downloading" || task.state === "Pending") && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handlePause(task)}
                        title="暂停"
                        aria-label="暂停"
                      >
                        <Pause className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {task.state === "Paused" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleResume(task)}
                        title="恢复"
                        aria-label="恢复"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {(task.state === "Pending" ||
                      task.state === "Downloading" ||
                      task.state === "Paused") && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleCancel(task)}
                        title="取消"
                        aria-label="取消"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {(task.state === "Failed" || task.state === "Cancelled") && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleRetry(task)}
                        title="重新下载"
                        aria-label="重新下载"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {task.state === "Completed" && (
                      <span className="text-xs text-success flex items-center gap-1">
                        <DownloadIcon className="h-3.5 w-3.5" />{" "}
                        {task.directory ? "已写入目录" : "已交给浏览器下载"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
