import { useCallback, useEffect, useRef, useState } from "react";
import { usePicaStore } from "@/lib/pica/store";
import { getDownloadManager } from "@/lib/pica/download-manager";
import type { DownloadTask, DownloadTaskState, ProgressData } from "@/lib/pica/types";
import { Play, Pause, X, RotateCcw, Trash2, Download as DownloadIcon, Loader2 } from "lucide-react";
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
  const { cancelTask, pauseTask, resumeTask } = usePicaStore();
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [speed, setSpeed] = useState("0.00MB/s");
  const dm = useRef(getDownloadManager()).current;

  useEffect(() => {
    const unsub = dm.onChange((task) => {
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
    return () => {
      unsub();
      unsubSpeed();
    };
  }, [dm]);

  const handlePause = useCallback(
    (task: DownloadTask) => {
      pauseTask(task.chapterId);
      toast.info(`已暂停: ${task.comic.title} - ${task.chapterInfo.title}`);
    },
    [pauseTask],
  );

  const handleResume = useCallback(
    (task: DownloadTask) => {
      resumeTask(task.chapterId);
      toast.info(`已恢复: ${task.comic.title} - ${task.chapterInfo.title}`);
    },
    [resumeTask],
  );

  const handleCancel = useCallback(
    (task: DownloadTask) => {
      cancelTask(task.chapterId);
      toast.info(`已取消: ${task.comic.title} - ${task.chapterInfo.title}`);
    },
    [cancelTask],
  );

  const handleRetry = useCallback(
    (task: DownloadTask) => {
      task.state = "Pending";
      task.downloadedImgCount = 0;
      task.abortController = new AbortController();
      dm.createTask(task.comic, task.chapterId);
      toast.info(`重新下载: ${task.comic.title} - ${task.chapterInfo.title}`);
    },
    [dm],
  );

  const handleClearCompleted = useCallback(() => {
    for (const t of tasks) {
      if (t.state === "Completed" || t.state === "Cancelled" || t.state === "Failed") {
        cancelTask(t.chapterId);
      }
    }
    setTasks(dm.getAllTasks());
    toast.success("已清理完成的任务");
  }, [tasks, cancelTask, dm]);

  const activeCount = tasks.filter(
    (t) => t.state === "Downloading" || t.state === "Pending",
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            下载队列 · {activeCount} 个进行中 / {tasks.length} 个任务
          </p>
          <p className="text-xs text-muted-foreground">下载速度: {speed}</p>
        </div>
        {tasks.some(
          (t) => t.state === "Completed" || t.state === "Cancelled" || t.state === "Failed",
        ) && (
          <Button variant="ghost" size="sm" onClick={handleClearCompleted}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            清理完成
          </Button>
        )}
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
                  className="rounded-xl border border-border/60 bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{task.comic.title}</p>
                      <p className="text-xs text-muted-foreground">
                        第 {task.chapterInfo.order} 话 · {task.chapterInfo.title}
                      </p>
                    </div>
                    <span className={`text-xs font-medium ${stateColor(task.state)}`}>
                      {stateLabel(task.state)}
                    </span>
                  </div>

                  {(task.state === "Downloading" || task.state === "Pending") &&
                    task.totalImgCount > 0 && (
                      <div className="mt-3">
                        <Progress value={progress.percentage} className="h-1.5" />
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {progress.downloadedImgCount} / {progress.totalImgCount} 张 ·{" "}
                          {progress.percentage}%
                        </p>
                      </div>
                    )}

                  <div className="mt-3 flex items-center gap-1.5">
                    {task.state === "Downloading" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handlePause(task)}
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
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {(task.state === "Pending" || task.state === "Downloading") && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleCancel(task)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {task.state === "Failed" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleRetry(task)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {task.state === "Completed" && (
                      <span className="text-xs text-success flex items-center gap-1">
                        <DownloadIcon className="h-3.5 w-3.5" /> 已保存
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
