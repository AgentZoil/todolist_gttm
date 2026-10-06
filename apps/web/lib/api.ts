import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) || {}),
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error("Không kết nối được hệ thống. Vui lòng kiểm tra mạng rồi thử lại.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const rawMessage = body?.message ?? body?.error;
    const message = Array.isArray(rawMessage)
      ? rawMessage.filter((item): item is string => typeof item === "string").join(". ")
      : typeof rawMessage === "string"
        ? rawMessage
        : "";
    const genericMessages = new Set([
      "unauthorized",
      "forbidden",
      "not found",
      "conflict",
      "internal server error",
    ]);
    const fallbackMessages: Record<number, string> = {
      400: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.",
      401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      403: "Bạn không có quyền thực hiện thao tác này.",
      404: "Không tìm thấy thông tin cần xử lý.",
      409: "Thông tin vừa thay đổi hoặc đã tồn tại. Vui lòng tải lại rồi thử lại.",
      429: "Bạn thao tác quá nhanh. Vui lòng đợi một chút rồi thử lại.",
    };
    const userMessage = message && !genericMessages.has(message.toLowerCase())
      ? message
      : fallbackMessages[res.status] || "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.";
    throw new Error(userMessage);
  }

  return res.json();
}
