"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let active = true;
    const hasRecoveryMarker =
      new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery" ||
      new URLSearchParams(window.location.search).has("code");

    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session && hasRecoveryMarker) setRecoveryReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && (event === "PASSWORD_RECOVERY" || (session && hasRecoveryMarker))) {
        setRecoveryReady(true);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Hai mật khẩu không khớp.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.");
        return;
      }
      await supabase.auth.signOut().catch(() => undefined);
      setComplete(true);
    } catch {
      setError("Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Tạo mật khẩu mới</CardTitle>
          <CardDescription>Chọn mật khẩu dài ít nhất 12 ký tự.</CardDescription>
        </CardHeader>
        <CardContent>
          {complete ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-emerald-700">Đã cập nhật mật khẩu.</p>
              <Link href="/login" className="text-sm font-semibold text-primary hover:underline">Đăng nhập</Link>
            </div>
          ) : recoveryReady ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu mới</Label>
                <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} autoComplete="new-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Nhập lại mật khẩu</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={12} autoComplete="new-password" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">Mở liên kết đặt lại mật khẩu do quản trị viên gửi riêng. Nếu liên kết hết hạn, hãy gửi yêu cầu mới để quản trị viên xem xét.</p>
              <Link href="/forgot-password" className="text-sm font-semibold text-primary hover:underline">Gửi yêu cầu đặt lại mật khẩu mới</Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
