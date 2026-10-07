"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

const PASSWORD_RECOVERY_SESSION_KEY = "gttm-password-recovery-session";
const PASSWORD_RECOVERY_SESSION_TTL = 15 * 60 * 1000;

function clearStoredRecoverySession() {
  try {
    sessionStorage.removeItem(PASSWORD_RECOVERY_SESSION_KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function getStoredRecoveryUserId() {
  try {
    const stored = sessionStorage.getItem(PASSWORD_RECOVERY_SESSION_KEY);
    if (!stored) return null;

    const recovery = JSON.parse(stored) as { userId?: string; createdAt?: number };
    const age = recovery.createdAt ? Date.now() - recovery.createdAt : -1;
    if (
      !recovery.userId ||
      age < 0 ||
      age > PASSWORD_RECOVERY_SESSION_TTL
    ) {
      clearStoredRecoverySession();
      return null;
    }

    return recovery.userId;
  } catch {
    clearStoredRecoverySession();
    return null;
  }
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [verifyingLink, setVerifyingLink] = useState(false);
  const [signOutWarning, setSignOutWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const recoveryAttemptRef = useRef<{
    tokenHash: string | null;
    recoveryType: string | null;
    expectedUserId: string | null;
  } | null>(null);
  const recoveryVerificationRef = useRef<Promise<string | null> | null>(null);
  const supabase = createClient();

  useEffect(() => {
    let active = true;
    let expectedRecoveryUserId: string | null = null;

    function authorizeRecovery(userId: string) {
      try {
        sessionStorage.setItem(
          PASSWORD_RECOVERY_SESSION_KEY,
          JSON.stringify({ userId, createdAt: Date.now() }),
        );
      } catch {
        // The current recovery event still authorizes this page session.
      }
      setRecoveryUserId(userId);
      setRecoveryReady(true);
      setError(null);
    }

    async function rejectRecoveryLink() {
      clearStoredRecoverySession();
      setRecoveryReady(false);
      setRecoveryUserId(null);
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // The recovery form remains locked even if local sign-out fails.
      }
      if (active) {
        setVerifyingLink(false);
        setError("Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.");
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user.id;
      if (
        active &&
        event === "PASSWORD_RECOVERY" &&
        userId &&
        (!expectedRecoveryUserId || expectedRecoveryUserId === userId)
      ) {
        authorizeRecovery(userId);
      }
    });

    if (!recoveryAttemptRef.current) {
      const recoveryParams = new URLSearchParams(window.location.hash.slice(1));
      const hasRecoveryParams = ["token_hash", "type", "user_id"].some((key) =>
        recoveryParams.has(key),
      );
      if (hasRecoveryParams) {
        recoveryAttemptRef.current = {
          tokenHash: recoveryParams.get("token_hash"),
          recoveryType: recoveryParams.get("type"),
          expectedUserId: recoveryParams.get("user_id"),
        };
      }
    }

    const recoveryAttempt = recoveryAttemptRef.current;
    if (recoveryAttempt) {
      const { tokenHash, recoveryType, expectedUserId } = recoveryAttempt;
      expectedRecoveryUserId = expectedUserId;
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );

      if (!tokenHash || recoveryType !== "recovery" || !expectedUserId) {
        setError("Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.");
      } else {
        setVerifyingLink(true);
        if (!recoveryVerificationRef.current) {
          recoveryVerificationRef.current = supabase.auth
            .verifyOtp({ token_hash: tokenHash, type: "recovery" })
            .then(({ data, error: verifyError }) =>
              verifyError ? null : (data.user?.id ?? null),
            )
            .catch(() => null);
        }

        void recoveryVerificationRef.current.then((verifiedUserId) => {
          if (!active) return;
          if (verifiedUserId !== expectedUserId) {
            void rejectRecoveryLink();
            return;
          }

          authorizeRecovery(verifiedUserId);
          setVerifyingLink(false);
        });
      }
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (!active || !data.session?.user.id) return;
      const storedUserId = getStoredRecoveryUserId();
      if (storedUserId && storedUserId === data.session.user.id) {
        setRecoveryUserId(storedUserId);
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
    const storedRecoveryUserId = getStoredRecoveryUserId();
    if (
      !recoveryReady ||
      !recoveryUserId ||
      (storedRecoveryUserId && storedRecoveryUserId !== recoveryUserId)
    ) {
      setError("Hãy mở liên kết đặt lại mật khẩu mới để tiếp tục.");
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user.id !== recoveryUserId) {
        clearStoredRecoverySession();
        setRecoveryReady(false);
        setRecoveryUserId(null);
        setError("Phiên đặt lại mật khẩu đã hết hạn. Hãy yêu cầu liên kết mới.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.");
        return;
      }

      clearStoredRecoverySession();
      let signOutFailed = false;
      try {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          const { error: localSignOutError } = await supabase.auth.signOut({ scope: "local" });
          signOutFailed = Boolean(localSignOutError);
        }
      } catch {
        try {
          const { error: localSignOutError } = await supabase.auth.signOut({ scope: "local" });
          signOutFailed = Boolean(localSignOutError);
        } catch {
          signOutFailed = true;
        }
      }
      setSignOutWarning(signOutFailed);
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
              <p className="text-sm text-emerald-700">Đã đổi mật khẩu. Hãy đăng nhập bằng mật khẩu mới.</p>
              {signOutWarning && (
                <p className="text-sm text-amber-700">Hãy đóng tab này và mở cửa sổ riêng để đăng nhập lại.</p>
              )}
              <Link href="/login" className="text-sm font-semibold text-primary hover:underline">Đăng nhập</Link>
            </div>
          ) : recoveryReady ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu mới</Label>
                <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Nhập lại mật khẩu</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <p className={`text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}>
                {verifyingLink
                  ? "Đang xác thực liên kết..."
                  : error ?? "Mở liên kết đặt lại mật khẩu do quản trị viên gửi riêng. Nếu liên kết hết hạn, hãy gửi yêu cầu mới để quản trị viên xem xét."}
              </p>
              <Link href="/forgot-password" className="text-sm font-semibold text-primary hover:underline">Gửi yêu cầu đặt lại mật khẩu mới</Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
