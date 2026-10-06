"use client";

import Link from "next/link";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/users/password-reset-requests", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không gửi được yêu cầu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Đặt lại mật khẩu</CardTitle>
          <CardDescription>Nhập email để gửi yêu cầu đặt lại mật khẩu cho quản trị viên.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Nếu email thuộc tài khoản đang hoạt động, yêu cầu sẽ được quản trị viên xem xét. Sau khi xác minh và duyệt, quản trị viên sẽ gửi riêng liên kết đặt lại mật khẩu. Ứng dụng không gửi email.
              </p>
              <Link href="/login" className="text-sm font-semibold text-primary hover:underline">
                Quay lại đăng nhập
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Đang gửi yêu cầu..." : "Gửi yêu cầu"}
              </Button>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <p className="text-center text-sm text-muted-foreground">
                <Link href="/login" className="font-semibold text-primary hover:underline">Quay lại đăng nhập</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
