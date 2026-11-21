import { formatReportDate, reportScopeLabel, reportSummaryRows, type ReportData } from "./report-data";
import styles from "./reports.module.css";

export function ReportPrint({ report, author }: { report: ReportData; author: string }) {
  const summaryRows = reportSummaryRows(report.summary);
  const [day, month, year] = formatReportDate(new Date()).split("/").map(Number);

  return (
    <article className={styles.print} aria-label="Bản in báo cáo">
      {/* Header 2 cột hành chính */}
      <div className="flex justify-between gap-4 text-center text-xs">
        <div className="flex-1">
          <p className="font-bold">CỤC ĐƯỜNG BỘ VIỆT NAM</p>
          <hr className="mx-auto my-1 w-24 border-black" />
          <p>Số: ...../BC-TH</p>
        </div>
        <div className="flex-1">
          <p className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
          <p className="font-bold">Độc lập - Tự do - Hạnh phúc</p>
          <hr className="mx-auto my-1 w-36 border-black" />
          <p className="italic">Hà Nội, ngày {day} tháng {month} năm {year}</p>
        </div>
      </div>

      {/* Tiêu đề Báo cáo */}
      <div className="my-5 text-center">
        <h1 className="text-base font-bold">BÁO CÁO TỔNG HỢP THEO DÕI VÀ ĐÁNH GIÁ THỰC HIỆN NHIỆM VỤ</h1>
        <p className="mt-1 italic wrap-anywhere">{reportScopeLabel(report.scope)}</p>
      </div>

      {/* PHẦN I: TỔNG HỢP SỐ LIỆU */}
      <section className="mb-4 break-inside-avoid">
        <h2 className="mb-1 font-bold">I. TỔNG HỢP TÌNH HÌNH THỰC HIỆN</h2>
        <table>
          <thead><tr>{summaryRows.map(([label]) => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody><tr className="text-center">{summaryRows.map(([label, value]) => <td key={label}>{value}</td>)}</tr></tbody>
        </table>
      </section>

      {/* PHẦN II: BẢNG DANH SÁCH CHI TIẾT (Không có Mã NV) */}
      <section>
        <h2 className="mb-1 break-after-avoid font-bold">II. DANH SÁCH CHI TIẾT CÁC NHIỆM VỤ</h2>
        <table>
          <thead>
            <tr>
              <th scope="col" className="w-[4%]">STT</th>
              <th scope="col" className="w-[9%]">Số văn bản</th>
              <th scope="col" className="w-[25%]">Nội dung nhiệm vụ</th>
              <th scope="col" className="w-[11%]">Đơn vị chủ trì</th>
              <th scope="col" className="w-[9%]">Đơn vị phối hợp</th>
              <th scope="col" className="w-[8%]">Hạn hoàn thành</th>
              <th scope="col" className="w-[8%]">Ngày hoàn thành</th>
              <th scope="col" className="w-[10%]">Trạng thái</th>
              <th scope="col">Tiến độ / Bằng chứng</th>
              <th scope="col" className="w-[8%]">Ý kiến chỉ đạo</th>
            </tr>
          </thead>
          <tbody>
            {report.tasks.map((task, index) => (
              <tr key={task.id}>
                <td className="text-center">{index + 1}</td>
                <td>{task.documentNumber || "—"}</td>
                <td>
                  <p className="font-bold">{task.title}</p>
                  {task.content && <p className="whitespace-pre-wrap">{task.content}</p>}
                </td>
                <td>{task.ownerDepartmentName}</td>
                <td>{task.coordinatingUnits || "—"}</td>
                <td className="text-center">{formatReportDate(task.requiredCompletionDate)}</td>
                <td className="text-center">{formatReportDate(task.actualCompletionDate)}</td>
                <td>{task.statusLabel}</td>
                <td className="whitespace-pre-wrap">{[task.completionEvidence, task.incompleteReason].filter(Boolean).join("\n") || "—"}</td>
                <td className="whitespace-pre-wrap">{task.directives.join("\n") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* PHẦN CHỮ KÝ */}
      <div className="mt-6 flex break-inside-avoid justify-between gap-4 text-xs">
        <div>
          <p className="font-bold italic">Nơi nhận:</p>
          <p>- Lãnh đạo Cục;</p>
          <p>- Các phòng ban, đơn vị;</p>
          <p>- Lưu: VT, TH.</p>
        </div>
        <div className="flex gap-12 text-center">
          <div>
            <p className="font-bold">NGƯỜI LẬP BIỂU</p>
            <p className="italic">(Ký, ghi rõ họ tên)</p>
            <p className="mt-12 font-bold">{author}</p>
          </div>
          <div>
            <p className="font-bold">THỦ TRƯỞNG ĐƠN VỊ</p>
            <p className="italic">(Ký, đóng dấu)</p>
          </div>
        </div>
      </div>
    </article>
  );
}
