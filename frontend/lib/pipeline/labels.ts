"use client";

// Shared human-readable labels for pipeline surfaces: localized field-name and
// field-explanation lookups, the field-key humanizer (fallback only), plus
// localized document-type and readiness-reason lookups. One source for the
// Profile, Prepare, Receipt, and header-status views.
//
// Field KEYS (person_name, gross_pay, …) are code identifiers and are never
// translated; the tables below hold their human labels per language. Every
// language must carry every entry — enforced by the types.

import type { DocumentType, ReviewReasonCode } from "@/lib/pipeline/types";
import type { Language } from "@/lib/dictionaries";
import { useI18n } from "@/lib/i18n";
import { useCopy } from "@/lib/pipeline/copy";

/** Last-resort prettifier for unknown field keys ("net_pay" -> "Net Pay"). */
export function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

// ---- localized field labels -------------------------------------------------

const FIELD_LABELS_EN = {
  person_name: "Person name",
  household_size: "Household size",
  address: "Address",
  application_date: "Application date",
  declared_income: "Declared income",
  pay_date: "Pay date",
  pay_frequency: "Pay frequency",
  pay_period_start: "Pay period start",
  pay_period_end: "Pay period end",
  regular_hours: "Regular hours",
  hourly_rate: "Hourly rate",
  gross_pay: "Gross pay",
  net_pay: "Net pay",
  document_date: "Document date",
  weekly_hours: "Weekly hours",
  monthly_benefit: "Monthly benefit",
  weekly_benefit: "Weekly benefit",
  biweekly_benefit: "Biweekly benefit",
  semimonthly_benefit: "Semimonthly benefit",
  annual_benefit: "Annual benefit",
  benefit_frequency: "Benefit frequency",
  benefit_amount: "Benefit amount",
  statement_month: "Statement month",
  gross_receipts: "Gross receipts",
  platform_fees: "Platform fees",
};

type FieldLabels = typeof FIELD_LABELS_EN;

const FIELD_LABELS: Record<Language, FieldLabels> = {
  en: FIELD_LABELS_EN,
  es: {
    person_name: "Nombre",
    household_size: "Tamaño del hogar",
    address: "Dirección",
    application_date: "Fecha de solicitud",
    declared_income: "Ingreso declarado",
    pay_date: "Fecha de pago",
    pay_frequency: "Frecuencia de pago",
    pay_period_start: "Inicio del período de pago",
    pay_period_end: "Fin del período de pago",
    regular_hours: "Horas regulares",
    hourly_rate: "Tarifa por hora",
    gross_pay: "Pago bruto",
    net_pay: "Pago neto",
    document_date: "Fecha del documento",
    weekly_hours: "Horas semanales",
    monthly_benefit: "Beneficio mensual",
    weekly_benefit: "Beneficio semanal",
    biweekly_benefit: "Beneficio cada dos semanas",
    semimonthly_benefit: "Beneficio dos veces al mes",
    annual_benefit: "Beneficio anual",
    benefit_frequency: "Frecuencia del beneficio",
    benefit_amount: "Monto del beneficio",
    statement_month: "Mes del estado de cuenta",
    gross_receipts: "Recaudación bruta",
    platform_fees: "Comisiones de la plataforma",
  },
  zh: {
    person_name: "姓名",
    household_size: "家庭人数",
    address: "地址",
    application_date: "申请日期",
    declared_income: "申报收入",
    pay_date: "发薪日期",
    pay_frequency: "发薪频率",
    pay_period_start: "工资周期开始",
    pay_period_end: "工资周期结束",
    regular_hours: "正常工时",
    hourly_rate: "时薪",
    gross_pay: "税前工资",
    net_pay: "实发工资",
    document_date: "文件日期",
    weekly_hours: "每周工时",
    monthly_benefit: "每月福利",
    weekly_benefit: "每周福利",
    biweekly_benefit: "每两周福利",
    semimonthly_benefit: "每半月福利",
    annual_benefit: "每年福利",
    benefit_frequency: "福利发放频率",
    benefit_amount: "福利金额",
    statement_month: "对账单月份",
    gross_receipts: "零工总收入",
    platform_fees: "平台费用",
  },
  tl: {
    person_name: "Pangalan",
    household_size: "Laki ng sambahayan",
    address: "Address",
    application_date: "Petsa ng aplikasyon",
    declared_income: "Idineklarang kita",
    pay_date: "Petsa ng sahod",
    pay_frequency: "Dalas ng sahod",
    pay_period_start: "Simula ng period ng sahod",
    pay_period_end: "Katapusan ng period ng sahod",
    regular_hours: "Regular na oras",
    hourly_rate: "Rate kada oras",
    gross_pay: "Gross na sahod",
    net_pay: "Net na sahod",
    document_date: "Petsa ng dokumento",
    weekly_hours: "Oras kada linggo",
    monthly_benefit: "Buwanang benepisyo",
    weekly_benefit: "Lingguhang benepisyo",
    biweekly_benefit: "Benepisyo tuwing dalawang linggo",
    semimonthly_benefit: "Benepisyo dalawang beses sa isang buwan",
    annual_benefit: "Taunang benepisyo",
    benefit_frequency: "Dalas ng benepisyo",
    benefit_amount: "Halaga ng benepisyo",
    statement_month: "Buwan ng statement",
    gross_receipts: "Gross na kita sa gig",
    platform_fees: "Bayarin sa platform",
  },
  vi: {
    person_name: "Họ tên",
    household_size: "Số người trong hộ",
    address: "Địa chỉ",
    application_date: "Ngày nộp hồ sơ",
    declared_income: "Thu nhập kê khai",
    pay_date: "Ngày trả lương",
    pay_frequency: "Tần suất trả lương",
    pay_period_start: "Đầu kỳ lương",
    pay_period_end: "Cuối kỳ lương",
    regular_hours: "Số giờ làm chuẩn",
    hourly_rate: "Đơn giá theo giờ",
    gross_pay: "Lương gộp",
    net_pay: "Lương thực nhận",
    document_date: "Ngày trên giấy tờ",
    weekly_hours: "Số giờ mỗi tuần",
    monthly_benefit: "Trợ cấp hằng tháng",
    weekly_benefit: "Trợ cấp hằng tuần",
    biweekly_benefit: "Trợ cấp hai tuần một lần",
    semimonthly_benefit: "Trợ cấp nửa tháng một lần",
    annual_benefit: "Trợ cấp hằng năm",
    benefit_frequency: "Tần suất trợ cấp",
    benefit_amount: "Mức trợ cấp",
    statement_month: "Tháng sao kê",
    gross_receipts: "Doanh thu gộp gig",
    platform_fees: "Phí nền tảng",
  },
};

/** Localized display label for a field key; unknown keys fall back to humanize(). */
export function useFieldLabel(): (key: string) => string {
  const { language } = useI18n();
  const table: Record<string, string> = FIELD_LABELS[language];
  return (key: string) => table[key] ?? humanize(key);
}

// ---- localized field explanations ("why this is needed") --------------------

const FIELD_EXPLAIN_EN = {
  person_name: "Your name, as it appears on the application, so the file is attributed correctly.",
  household_size: "Household size sets which income limit applies — it drives the threshold in Understand.",
  address: "The address on your application summary; used only to attach documents to the right file.",
  application_date: "When the application was prepared.",
  gross_pay: "Gross pay per period — annualized by its frequency to estimate yearly income.",
  pay_frequency: "How often you're paid; it sets the annualizing multiplier.",
  hourly_rate: "Hourly rate — cross-checked against gross pay for internal consistency.",
  regular_hours: "Hours per period — cross-checked against gross pay.",
  pay_date: "The pay date; the most recent stub from a source is used.",
  document_date: "The letter's date; it must fall within the 60-day currency window.",
  weekly_hours: "Weekly hours stated by the employer.",
  monthly_benefit: "Monthly benefit amount — annualized as recurring income.",
  benefit_frequency: "How often the benefit is paid.",
  gross_receipts: "Gross gig receipts — included as income (×12) and flagged for corroboration.",
  platform_fees: "Platform fees, shown for context; gross receipts drive the income figure.",
  statement_month: "The month this gig statement covers.",
};

type FieldExplain = typeof FIELD_EXPLAIN_EN;

const FIELD_EXPLAIN: Record<Language, FieldExplain> = {
  en: FIELD_EXPLAIN_EN,
  es: {
    person_name: "Tu nombre, tal como aparece en la solicitud, para que el expediente se atribuya correctamente.",
    household_size: "El tamaño del hogar determina qué límite de ingresos aplica — define el umbral en Entender.",
    address: "La dirección de tu resumen de solicitud; se usa solo para vincular los documentos al expediente correcto.",
    application_date: "Cuándo se preparó la solicitud.",
    gross_pay: "Pago bruto por período — se anualiza según su frecuencia para estimar el ingreso anual.",
    pay_frequency: "Con qué frecuencia te pagan; define el multiplicador de anualización.",
    hourly_rate: "Tarifa por hora — se contrasta con el pago bruto para verificar la coherencia interna.",
    regular_hours: "Horas por período — se contrastan con el pago bruto.",
    pay_date: "La fecha de pago; se usa el talón más reciente de cada fuente.",
    document_date: "La fecha de la carta; debe estar dentro de la ventana de vigencia de 60 días.",
    weekly_hours: "Horas semanales declaradas por el empleador.",
    monthly_benefit: "Monto del beneficio mensual — se anualiza como ingreso recurrente.",
    benefit_frequency: "Con qué frecuencia se paga el beneficio.",
    gross_receipts: "Recaudación bruta del gig — se incluye como ingreso (×12) y se marca para corroboración.",
    platform_fees: "Comisiones de la plataforma, mostradas como contexto; la recaudación bruta determina la cifra de ingresos.",
    statement_month: "El mes que cubre este estado de cuenta gig.",
  },
  zh: {
    person_name: "您的姓名（与申请上的一致），以便正确归档。",
    household_size: "家庭人数决定适用哪个收入上限——它决定“了解”中的门槛。",
    address: "申请摘要上的地址；仅用于将文件归入正确的档案。",
    application_date: "申请的准备日期。",
    gross_pay: "每期税前工资——按其频率年化以估算年收入。",
    pay_frequency: "您的发薪频率；它决定年化乘数。",
    hourly_rate: "时薪——与税前工资交叉核对内部一致性。",
    regular_hours: "每期工时——与税前工资交叉核对。",
    pay_date: "发薪日期；同一来源取最近的一张工资单。",
    document_date: "信件日期；必须在 60 天有效期窗口内。",
    weekly_hours: "雇主声明的每周工时。",
    monthly_benefit: "每月福利金额——作为经常性收入年化。",
    benefit_frequency: "福利的发放频率。",
    gross_receipts: "零工总收入——计入收入（×12）并标记待佐证。",
    platform_fees: "平台费用，仅供参考；收入数字以总收入为准。",
    statement_month: "此零工对账单覆盖的月份。",
  },
  tl: {
    person_name: "Ang iyong pangalan, tulad ng nakasulat sa aplikasyon, para tama ang pagkaka-attribute ng file.",
    household_size: "Ang laki ng sambahayan ang nagtatakda kung aling limitasyon sa kita ang naaangkop — ito ang batayan ng threshold sa Unawain.",
    address: "Ang address sa buod ng iyong aplikasyon; ginagamit lang para maiugnay ang mga dokumento sa tamang file.",
    application_date: "Kung kailan inihanda ang aplikasyon.",
    gross_pay: "Gross na sahod kada period — ina-annualize ayon sa dalas nito para tantiyahin ang taunang kita.",
    pay_frequency: "Kung gaano kadalas ka sinusuwelduhan; ito ang nagtatakda ng multiplier sa pag-a-annualize.",
    hourly_rate: "Rate kada oras — itinutugma sa gross na sahod para sa internal na pagkakapare-pareho.",
    regular_hours: "Oras kada period — itinutugma sa gross na sahod.",
    pay_date: "Ang petsa ng sahod; ginagamit ang pinakabagong stub mula sa isang source.",
    document_date: "Ang petsa ng sulat; dapat nasa loob ng 60-araw na palugit.",
    weekly_hours: "Oras kada linggo ayon sa employer.",
    monthly_benefit: "Halaga ng buwanang benepisyo — ina-annualize bilang paulit-ulit na kita.",
    benefit_frequency: "Kung gaano kadalas ibinibigay ang benepisyo.",
    gross_receipts: "Gross na kita sa gig — kasama bilang kita (×12) at minamarkahan para sa patunay.",
    platform_fees: "Bayarin sa platform, ipinapakita bilang konteksto; ang gross na kita ang batayan ng bilang.",
    statement_month: "Ang buwang saklaw ng gig statement na ito.",
  },
  vi: {
    person_name: "Tên của bạn, đúng như trên hồ sơ, để hồ sơ được ghi nhận chính xác.",
    household_size: "Số người trong hộ quyết định giới hạn thu nhập nào được áp dụng — nó xác định ngưỡng ở bước Tìm hiểu.",
    address: "Địa chỉ trên bản tóm tắt hồ sơ; chỉ dùng để gắn giấy tờ vào đúng hồ sơ.",
    application_date: "Thời điểm hồ sơ được chuẩn bị.",
    gross_pay: "Lương gộp mỗi kỳ — được quy đổi theo năm theo tần suất để ước tính thu nhập năm.",
    pay_frequency: "Tần suất bạn được trả lương; nó xác định hệ số quy đổi theo năm.",
    hourly_rate: "Đơn giá theo giờ — được đối chiếu với lương gộp để kiểm tra tính nhất quán.",
    regular_hours: "Số giờ mỗi kỳ — được đối chiếu với lương gộp.",
    pay_date: "Ngày trả lương; dùng phiếu lương mới nhất của mỗi nguồn.",
    document_date: "Ngày trên thư; phải nằm trong khung hiệu lực 60 ngày.",
    weekly_hours: "Số giờ mỗi tuần do người sử dụng lao động khai.",
    monthly_benefit: "Mức trợ cấp hằng tháng — được quy đổi theo năm như thu nhập định kỳ.",
    benefit_frequency: "Tần suất chi trả trợ cấp.",
    gross_receipts: "Doanh thu gộp gig — được tính vào thu nhập (×12) và được đánh dấu cần chứng thực.",
    platform_fees: "Phí nền tảng, hiển thị để tham khảo; doanh thu gộp quyết định con số thu nhập.",
    statement_month: "Tháng mà sao kê gig này bao phủ.",
  },
};

/** Localized "why this is needed" text for a field key, if one exists. */
export function useFieldExplain(): (key: string) => string | undefined {
  const { language } = useI18n();
  const table: Partial<Record<string, string>> = FIELD_EXPLAIN[language];
  return (key: string) => table[key];
}

// ---- document-type and readiness-reason lookups -----------------------------

export function useDocLabels(): Record<DocumentType, string> {
  const c = useCopy();
  return {
    application_summary: c.docApplication_summary,
    pay_stub: c.docPay_stub,
    employment_letter: c.docEmployment_letter,
    benefit_letter: c.docBenefit_letter,
    gig_statement: c.docGig_statement,
    unknown: c.docUnknown,
  };
}

export function useReasonTexts(): Record<ReviewReasonCode, string> {
  const c = useCopy();
  return {
    PAY_STUB_TOTAL_CONFLICT: c.rc_PAY_STUB_TOTAL_CONFLICT,
    GIG_INCOME_UNCORROBORATED: c.rc_GIG_INCOME_UNCORROBORATED,
    EMPLOYMENT_LETTER_EXPIRED: c.rc_EMPLOYMENT_LETTER_EXPIRED,
    UNCONFIRMED_FIELDS: c.rc_UNCONFIRMED_FIELDS,
    LOW_CONFIDENCE_FIELDS: c.rc_LOW_CONFIDENCE_FIELDS,
    MISSING_REQUIRED_DOCUMENT: c.rc_MISSING_REQUIRED_DOCUMENT,
  };
}
