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

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Hai mật khẩu không khớp.");
      setLoading(false);
      return;
    }

    try {
      await apiFetch("/users/register", {
        method: "POST",
        body: JSON.stringify({ email, fullName, password, confirmPassword }),
      });
      setPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi yêu cầu đăng ký");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative z-10 shadow-[0_4px_20px_-2px_rgba(79,70,229,0.1)]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Tạo tài khoản</CardTitle>
          <CardDescription className="text-muted-foreground">
            Nhập email của bạn và tạo mật khẩu. Admin sẽ xác minh danh tính qua kênh tin cậy trước khi duyệt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4 text-center">
              <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Đã gửi yêu cầu. Sau khi quản trị viên duyệt, bạn đăng nhập bằng mật khẩu vừa tạo. Hãy nhập email của mình; ứng dụng không xác minh email tự động.
              </p>
              <Link href="/login" className="text-sm font-semibold text-primary hover:underline">
                Quay lại đăng nhập
              </Link>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Họ và tên</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" />
                <p className="text-xs text-muted-foreground">Tối thiểu 12 ký tự. Ghi nhớ mật khẩu để đăng nhập sau khi được duyệt.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Nhập lại mật khẩu</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Đang gửi yêu cầu..." : "Tạo yêu cầu đăng ký"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Đã có tài khoản?{" "}
                <Link href="/login" className="font-semibold text-primary hover:underline">Đăng nhập</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
