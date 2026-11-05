"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import loginBackground from "@/public/branding/Sunlit Highway Through Mountain Lake.png";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Email hoặc mật khẩu có thể chưa đúng. Vui lòng kiểm tra lại thông tin và thử lại.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative isolate flex min-h-svh items-center justify-center overflow-x-hidden bg-sky-100 px-4 py-8 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <Image
          src={loginBackground}
          alt=""
          fill
          sizes="100vw"
          priority
          unoptimized
          placeholder="blur"
          className="object-fill"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-sky-950/15" />
      </div>

      <Card className="relative z-10 w-full max-w-md border border-white/70 bg-white/95 shadow-[0_16px_60px_-16px_rgba(15,23,42,0.55)] backdrop-blur-md">
        <CardHeader className="gap-2 text-center">
          <CardTitle className="text-xl font-bold uppercase leading-snug tracking-tight text-primary sm:text-[22px]">
            Hệ thống theo dõi nhiệm vụ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="email@gttm.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
                Mật khẩu
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-lg"
              />
            </div>
            <p className="-mt-2 text-right text-sm">
              <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
                Quên mật khẩu?
              </Link>
            </p>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_4px_14px_0_rgba(79,70,229,0.3)] hover:shadow-[0_6px_20px_0_rgba(79,70,229,0.4)] hover:-translate-y-0.5 transition-all duration-200"
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="font-semibold text-primary hover:underline">
              Đăng ký và chờ Admin duyệt
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
