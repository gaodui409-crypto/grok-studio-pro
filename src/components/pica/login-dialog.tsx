import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, User } from "lucide-react";
import { usePicaStore } from "@/lib/pica/store";

export function LoginDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const {
    login,
    loginLoading,
    loginError,
    loginEmail,
    loginPassword,
    setLoginEmail,
    setLoginPassword,
    userProfile,
    logout,
  } = usePicaStore();

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast.error("请填写邮箱和密码");
      return;
    }
    await login(loginEmail, loginPassword);
    if (usePicaStore.getState().isLoggedIn) {
      toast.success(`欢迎，${usePicaStore.getState().userProfile?.name ?? "用户"}！`);
      setOpen(false);
    }
  };

  if (userProfile) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>已登录</DialogTitle>
            <DialogDescription>
              {userProfile.name} · Lv.{userProfile.level} · {userProfile.email}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button
              variant="destructive"
              onClick={() => {
                logout();
                toast.info("已退出登录");
              }}
            >
              退出登录
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>登录 PicaComic</DialogTitle>
          <DialogDescription>使用 PicaComic 账号登录以搜索和下载漫画。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pica-email">邮箱</Label>
            <Input
              id="pica-email"
              type="email"
              placeholder="your@email.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pica-password">密码</Label>
            <Input
              id="pica-password"
              type="password"
              placeholder="••••••••"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          {loginError && <p className="text-xs text-destructive">{loginError}</p>}
          <Button onClick={handleLogin} disabled={loginLoading} className="w-full">
            {loginLoading ? (
              "登录中…"
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                登录
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
