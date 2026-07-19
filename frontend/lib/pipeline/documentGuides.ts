"use client";

import type { Language } from "@/lib/dictionaries";
import { useI18n } from "@/lib/i18n";
import type { DocumentType } from "@/lib/pipeline/types";

type GuideDocumentType = Exclude<DocumentType, "unknown">;

export type DocumentGuide = {
  title: string;
  issuer: string;
  summary: string;
  steps: string[];
  links: Array<{
    label: string;
    href: string;
    note?: string;
  }>;
};

export type DocumentGuideUiCopy = {
  findDocument: string;
  findLabel: string;
  closeGuide: string;
  howToGet: string;
  whereToGetIt: string;
};

const LINK_HREFS = {
  metrolist: "https://www.boston.gov/metrolist/search",
  applicationGuide: "https://www.boston.gov/income-restricted-housing-guide",
  massPayRecords: "https://www.mass.gov/guides/pay-and-recordkeeping",
  workplaceComplaint: "https://www.mass.gov/how-to/file-a-workplace-complaint",
  ssaBenefitLetter: "https://www.ssa.gov/manage-benefits/get-benefit-letter",
  dtaConnect: "https://dtaconnect.eohhs.mass.gov/",
  contactDta: "https://www.mass.gov/guides/how-to-contact-dta",
  sspVerification:
    "https://www.mass.gov/how-to/how-to-get-a-benefit-verification-letter-from-massachusetts-state-supplement-program-ssp",
  unemploymentProof: "https://www.mass.gov/how-to/request-proof-of-unemployment-benefits-income",
  maSelfEmploymentForm: "https://www.mass.gov/doc/verification-of-self-employment-income/download",
  irsTranscript: "https://www.irs.gov/individuals/get-transcript",
  irsWageTranscriptHelp: "https://www.irs.gov/taxtopics/tc159",
} as const;

type LinkKey = keyof typeof LINK_HREFS;
type LocalizedDocumentGuide = Omit<DocumentGuide, "links"> & {
  links: Array<{
    key: LinkKey;
    label: string;
    note?: string;
  }>;
};

const GUIDE_UI_COPY: Record<Language, DocumentGuideUiCopy> = {
  en: {
    findDocument: "Find document",
    findLabel: "Find {name}",
    closeGuide: "Close document guide",
    howToGet: "How to get {name}",
    whereToGetIt: "Where to get it",
  },
  es: {
    findDocument: "Buscar documento",
    findLabel: "Buscar {name}",
    closeGuide: "Cerrar guía del documento",
    howToGet: "Cómo obtener {name}",
    whereToGetIt: "Dónde obtenerlo",
  },
  zh: {
    findDocument: "查找文件",
    findLabel: "查找{name}",
    closeGuide: "关闭文件指南",
    howToGet: "如何获取{name}",
    whereToGetIt: "从哪里获取",
  },
  tl: {
    findDocument: "Hanapin ang dokumento",
    findLabel: "Hanapin ang {name}",
    closeGuide: "Isara ang gabay sa dokumento",
    howToGet: "Paano kunin ang {name}",
    whereToGetIt: "Saan ito makukuha",
  },
  vi: {
    findDocument: "Tìm tài liệu",
    findLabel: "Tìm {name}",
    closeGuide: "Đóng hướng dẫn tài liệu",
    howToGet: "Cách lấy {name}",
    whereToGetIt: "Lấy ở đâu",
  },
};

const DOCUMENT_GUIDE_COPY: Record<Language, Record<GuideDocumentType, LocalizedDocumentGuide>> = {
  en: {
    application_summary: {
      title: "Find the application packet",
      issuer: "Property manager or housing listing",
      summary:
        "This usually comes from the property manager, lottery listing, or housing portal — not from a universal government site.",
      steps: [
        "Find the property listing or application packet.",
        "Open the listing’s application instructions.",
        "Download or save the application summary / housing application PDF.",
        "Return to RealDoor and upload the file.",
      ],
      links: [
        {
          key: "metrolist",
          label: "Open Metrolist",
          note: "Boston-area income-restricted housing listings.",
        },
        {
          key: "applicationGuide",
          label: "Application guide",
          note: "Explains how income-restricted applications usually work.",
        },
      ],
    },
    pay_stub: {
      title: "Find your pay stub",
      issuer: "Employer, HR, payroll office, or payroll portal",
      summary:
        "Pay stubs usually come from your employer’s payroll system. If you cannot access one, ask HR or payroll for a recent copy.",
      steps: [
        "Open your employer payroll portal or contact HR/payroll.",
        "Download the most recent pay stub as PDF, or take a clear photo.",
        "Make sure the stub shows pay date, gross pay, hours, rate, and pay period.",
        "Return to RealDoor and upload the file.",
      ],
      links: [
        {
          key: "massPayRecords",
          label: "Massachusetts pay records",
          note: "Official state guidance on pay and recordkeeping rights.",
        },
        {
          key: "workplaceComplaint",
          label: "File workplace complaint",
          note: "Use if an employer refuses required wage records.",
        },
      ],
    },
    employment_letter: {
      title: "Request an employment letter",
      issuer: "Employer, HR, payroll office, or supervisor",
      summary:
        "There is no single government portal for this. The right source is usually HR, payroll, or your supervisor.",
      steps: [
        "Ask HR/payroll for a signed employment verification letter.",
        "Request name, role, hourly rate, typical weekly hours, and document date.",
        "Save the letter as PDF or take a clear photo.",
        "Return to RealDoor and upload the file.",
      ],
      links: [
        {
          key: "massPayRecords",
          label: "Massachusetts pay records",
          note: "Useful context if you need employer records.",
        },
        {
          key: "workplaceComplaint",
          label: "File workplace complaint",
          note: "Fallback if you cannot get required employment records.",
        },
      ],
    },
    benefit_letter: {
      title: "Find a benefit verification letter",
      issuer: "SSA, DTA, SSP, or unemployment office",
      summary:
        "Benefit letters depend on the benefit source. Choose the portal that matches the income source you receive.",
      steps: [
        "Identify which benefit source you need to prove.",
        "Open the matching official portal below.",
        "Download or request the benefit verification / proof of income letter.",
        "Return to RealDoor and upload the file.",
      ],
      links: [
        {
          key: "ssaBenefitLetter",
          label: "SSA benefit letter",
          note: "Social Security / SSI proof of benefits.",
        },
        {
          key: "dtaConnect",
          label: "DTA Connect",
          note: "SNAP, TAFDC, EAEDC notices and verifications.",
        },
        {
          key: "contactDta",
          label: "Contact DTA",
          note: "Phone option for a DTA benefit verification letter.",
        },
        {
          key: "sspVerification",
          label: "SSP verification",
          note: "Massachusetts State Supplement Program.",
        },
        {
          key: "unemploymentProof",
          label: "Unemployment proof",
          note: "Proof of unemployment benefits income.",
        },
      ],
    },
    gig_statement: {
      title: "Find gig or self-employment proof",
      issuer: "Gig platform, self-employment records, IRS, or Massachusetts form",
      summary:
        "Gig income is usually proven with platform earnings statements, tax forms, or a self-employment verification form.",
      steps: [
        "Open your gig platform app or website and find earnings / tax documents.",
        "Download a current monthly statement if available.",
        "If you do not have a formal statement, use the Massachusetts self-employment form as a fallback.",
        "Return to RealDoor and upload the file.",
      ],
      links: [
        {
          key: "maSelfEmploymentForm",
          label: "MA self-employment form",
          note: "Official Massachusetts verification form.",
        },
        {
          key: "irsTranscript",
          label: "IRS Get Transcript",
          note: "Useful for prior-year 1099/W-2 wage and income records.",
        },
        {
          key: "irsWageTranscriptHelp",
          label: "IRS wage transcript help",
          note: "How to request wage and income transcripts.",
        },
      ],
    },
  },
  es: {
    application_summary: {
      title: "Encuentra el paquete de solicitud",
      issuer: "Administrador de la propiedad o anuncio de vivienda",
      summary:
        "Normalmente viene del administrador, del anuncio de lotería o del portal de vivienda; no de un sitio gubernamental universal.",
      steps: [
        "Busca el anuncio de la propiedad o el paquete de solicitud.",
        "Abre las instrucciones de solicitud del anuncio.",
        "Descarga o guarda el resumen de solicitud / PDF de vivienda.",
        "Vuelve a RealDoor y sube el archivo.",
      ],
      links: [
        {
          key: "metrolist",
          label: "Abrir Metrolist",
          note: "Viviendas con ingresos restringidos en el área de Boston.",
        },
        {
          key: "applicationGuide",
          label: "Guía de solicitud",
          note: "Explica cómo suelen funcionar las solicitudes con ingresos restringidos.",
        },
      ],
    },
    pay_stub: {
      title: "Encuentra tu talón de pago",
      issuer: "Empleador, RR. HH., nómina o portal de nómina",
      summary:
        "Los talones de pago suelen venir del sistema de nómina del empleador. Si no puedes acceder, pide una copia reciente a RR. HH. o nómina.",
      steps: [
        "Abre el portal de nómina de tu empleador o contacta a RR. HH./nómina.",
        "Descarga el talón de pago más reciente como PDF o toma una foto clara.",
        "Asegúrate de que muestre fecha de pago, pago bruto, horas, tarifa y período de pago.",
        "Vuelve a RealDoor y sube el archivo.",
      ],
      links: [
        {
          key: "massPayRecords",
          label: "Registros de pago de Massachusetts",
          note: "Guía oficial estatal sobre derechos de pago y registros.",
        },
        {
          key: "workplaceComplaint",
          label: "Presentar queja laboral",
          note: "Úsalo si el empleador rechaza entregar registros salariales requeridos.",
        },
      ],
    },
    employment_letter: {
      title: "Solicita una carta de empleo",
      issuer: "Empleador, RR. HH., nómina o supervisor",
      summary:
        "No existe un portal gubernamental único para esto. La fuente correcta suele ser RR. HH., nómina o tu supervisor.",
      steps: [
        "Pide a RR. HH./nómina una carta firmada de verificación de empleo.",
        "Solicita nombre, puesto, tarifa por hora, horas semanales típicas y fecha del documento.",
        "Guarda la carta como PDF o toma una foto clara.",
        "Vuelve a RealDoor y sube el archivo.",
      ],
      links: [
        {
          key: "massPayRecords",
          label: "Registros de pago de Massachusetts",
          note: "Contexto útil si necesitas registros del empleador.",
        },
        {
          key: "workplaceComplaint",
          label: "Presentar queja laboral",
          note: "Alternativa si no puedes obtener los registros de empleo requeridos.",
        },
      ],
    },
    benefit_letter: {
      title: "Encuentra una carta de verificación de beneficios",
      issuer: "SSA, DTA, SSP u oficina de desempleo",
      summary:
        "Las cartas de beneficios dependen de la fuente del beneficio. Elige el portal que corresponda al ingreso que recibes.",
      steps: [
        "Identifica qué beneficio necesitas comprobar.",
        "Abre el portal oficial correspondiente abajo.",
        "Descarga o solicita la carta de verificación de beneficios / prueba de ingresos.",
        "Vuelve a RealDoor y sube el archivo.",
      ],
      links: [
        {
          key: "ssaBenefitLetter",
          label: "Carta de beneficios SSA",
          note: "Prueba de beneficios de Seguro Social / SSI.",
        },
        {
          key: "dtaConnect",
          label: "DTA Connect",
          note: "Avisos y verificaciones de SNAP, TAFDC, EAEDC.",
        },
        {
          key: "contactDta",
          label: "Contactar DTA",
          note: "Opción telefónica para una carta de verificación de beneficios DTA.",
        },
        {
          key: "sspVerification",
          label: "Verificación SSP",
          note: "Programa Estatal Suplementario de Massachusetts.",
        },
        {
          key: "unemploymentProof",
          label: "Prueba de desempleo",
          note: "Prueba de ingresos por beneficios de desempleo.",
        },
      ],
    },
    gig_statement: {
      title: "Encuentra prueba de gig work o autoempleo",
      issuer: "Plataforma gig, registros de autoempleo, IRS o formulario de Massachusetts",
      summary:
        "El ingreso gig suele comprobarse con estados de ganancias de la plataforma, formularios fiscales o un formulario de verificación de autoempleo.",
      steps: [
        "Abre la app o web de tu plataforma gig y busca ganancias / documentos fiscales.",
        "Descarga un estado mensual actual si está disponible.",
        "Si no tienes un estado formal, usa el formulario de autoempleo de Massachusetts como alternativa.",
        "Vuelve a RealDoor y sube el archivo.",
      ],
      links: [
        {
          key: "maSelfEmploymentForm",
          label: "Formulario MA de autoempleo",
          note: "Formulario oficial de verificación de Massachusetts.",
        },
        {
          key: "irsTranscript",
          label: "IRS Get Transcript",
          note: "Útil para registros 1099/W-2 de ingresos y salarios de años anteriores.",
        },
        {
          key: "irsWageTranscriptHelp",
          label: "Ayuda transcript salarial IRS",
          note: "Cómo solicitar transcripciones de salarios e ingresos.",
        },
      ],
    },
  },
  zh: {
    application_summary: {
      title: "查找申请材料包",
      issuer: "物业经理或住房房源",
      summary: "这通常来自物业经理、抽签房源或住房门户；不是统一的政府网站。",
      steps: [
        "找到该物业房源或申请材料包。",
        "打开房源中的申请说明。",
        "下载或保存申请摘要 / 住房申请 PDF。",
        "回到 RealDoor 并上传文件。",
      ],
      links: [
        {
          key: "metrolist",
          label: "打开 Metrolist",
          note: "波士顿地区收入限制住房房源。",
        },
        {
          key: "applicationGuide",
          label: "申请指南",
          note: "说明收入限制住房申请通常如何进行。",
        },
      ],
    },
    pay_stub: {
      title: "查找工资单",
      issuer: "雇主、人力资源、薪资部门或薪资门户",
      summary: "工资单通常来自雇主的薪资系统。如果无法访问，请向人力资源或薪资部门索取近期副本。",
      steps: [
        "打开雇主的薪资门户，或联系人力资源 / 薪资部门。",
        "下载最新工资单 PDF，或拍摄清晰照片。",
        "确认工资单显示发薪日期、税前工资、工时、时薪和工资周期。",
        "回到 RealDoor 并上传文件。",
      ],
      links: [
        {
          key: "massPayRecords",
          label: "马萨诸塞州工资记录",
          note: "关于工资和记录保存权利的官方州指南。",
        },
        {
          key: "workplaceComplaint",
          label: "提交工作场所投诉",
          note: "如果雇主拒绝提供所需工资记录，可使用此入口。",
        },
      ],
    },
    employment_letter: {
      title: "申请就业证明信",
      issuer: "雇主、人力资源、薪资部门或主管",
      summary: "这类文件没有统一政府门户。通常应向人力资源、薪资部门或主管索取。",
      steps: [
        "向人力资源 / 薪资部门索取签署的就业核验证明信。",
        "要求包含姓名、职位、时薪、通常每周工时和文件日期。",
        "将信件保存为 PDF，或拍摄清晰照片。",
        "回到 RealDoor 并上传文件。",
      ],
      links: [
        {
          key: "massPayRecords",
          label: "马萨诸塞州工资记录",
          note: "如果需要雇主记录，这里提供相关背景。",
        },
        {
          key: "workplaceComplaint",
          label: "提交工作场所投诉",
          note: "如果无法取得所需就业记录，可作为备用途径。",
        },
      ],
    },
    benefit_letter: {
      title: "查找福利核验证明信",
      issuer: "SSA、DTA、SSP 或失业办公室",
      summary: "福利证明信取决于福利来源。请选择与你收到的收入来源匹配的官方门户。",
      steps: [
        "确认你需要证明哪一种福利来源。",
        "打开下面对应的官方门户。",
        "下载或申请福利核验证明 / 收入证明信。",
        "回到 RealDoor 并上传文件。",
      ],
      links: [
        {
          key: "ssaBenefitLetter",
          label: "SSA 福利证明信",
          note: "Social Security / SSI 福利证明。",
        },
        {
          key: "dtaConnect",
          label: "DTA Connect",
          note: "SNAP、TAFDC、EAEDC 通知和核验文件。",
        },
        {
          key: "contactDta",
          label: "联系 DTA",
          note: "通过电话索取 DTA 福利核验证明信的方式。",
        },
        {
          key: "sspVerification",
          label: "SSP 核验",
          note: "马萨诸塞州补充计划。",
        },
        {
          key: "unemploymentProof",
          label: "失业收入证明",
          note: "失业福利收入证明。",
        },
      ],
    },
    gig_statement: {
      title: "查找零工或自雇收入证明",
      issuer: "零工平台、自雇记录、IRS 或马萨诸塞州表格",
      summary: "零工收入通常用平台收入报表、税表或自雇核验表证明。",
      steps: [
        "打开你的零工平台 app 或网站，查找收入 / 税务文件。",
        "如可用，下载当前月份报表。",
        "如果没有正式报表，可使用马萨诸塞州自雇表格作为备用。",
        "回到 RealDoor 并上传文件。",
      ],
      links: [
        {
          key: "maSelfEmploymentForm",
          label: "马州自雇表格",
          note: "马萨诸塞州官方核验表。",
        },
        {
          key: "irsTranscript",
          label: "IRS Get Transcript",
          note: "适用于往年 1099/W-2 工资和收入记录。",
        },
        {
          key: "irsWageTranscriptHelp",
          label: "IRS 工资 transcript 帮助",
          note: "如何申请工资和收入 transcript。",
        },
      ],
    },
  },
  tl: {
    application_summary: {
      title: "Hanapin ang application packet",
      issuer: "Property manager o housing listing",
      summary:
        "Karaniwan itong galing sa property manager, lottery listing, o housing portal — hindi sa iisang government site.",
      steps: [
        "Hanapin ang property listing o application packet.",
        "Buksan ang application instructions ng listing.",
        "I-download o i-save ang application summary / housing application PDF.",
        "Bumalik sa RealDoor at i-upload ang file.",
      ],
      links: [
        {
          key: "metrolist",
          label: "Buksan ang Metrolist",
          note: "Boston-area income-restricted housing listings.",
        },
        {
          key: "applicationGuide",
          label: "Application guide",
          note: "Ipinapaliwanag kung paano karaniwang gumagana ang income-restricted applications.",
        },
      ],
    },
    pay_stub: {
      title: "Hanapin ang iyong pay stub",
      issuer: "Employer, HR, payroll office, o payroll portal",
      summary:
        "Karaniwang galing sa payroll system ng employer ang pay stubs. Kung hindi mo ma-access, humingi ng kamakailang kopya sa HR o payroll.",
      steps: [
        "Buksan ang payroll portal ng employer o kontakin ang HR/payroll.",
        "I-download ang pinakabagong pay stub bilang PDF, o kumuha ng malinaw na litrato.",
        "Tiyaking nakikita ang pay date, gross pay, hours, rate, at pay period.",
        "Bumalik sa RealDoor at i-upload ang file.",
      ],
      links: [
        {
          key: "massPayRecords",
          label: "Massachusetts pay records",
          note: "Opisyal na gabay ng estado tungkol sa pay at recordkeeping rights.",
        },
        {
          key: "workplaceComplaint",
          label: "Mag-file ng workplace complaint",
          note: "Gamitin kung tumatanggi ang employer sa required wage records.",
        },
      ],
    },
    employment_letter: {
      title: "Humingi ng employment letter",
      issuer: "Employer, HR, payroll office, o supervisor",
      summary:
        "Walang iisang government portal para rito. Ang tamang source ay kadalasan HR, payroll, o supervisor.",
      steps: [
        "Humingi sa HR/payroll ng signed employment verification letter.",
        "I-request ang name, role, hourly rate, typical weekly hours, at document date.",
        "I-save ang letter bilang PDF o kumuha ng malinaw na litrato.",
        "Bumalik sa RealDoor at i-upload ang file.",
      ],
      links: [
        {
          key: "massPayRecords",
          label: "Massachusetts pay records",
          note: "Useful context kung kailangan mo ng employer records.",
        },
        {
          key: "workplaceComplaint",
          label: "Mag-file ng workplace complaint",
          note: "Fallback kung hindi mo makuha ang required employment records.",
        },
      ],
    },
    benefit_letter: {
      title: "Hanapin ang benefit verification letter",
      issuer: "SSA, DTA, SSP, o unemployment office",
      summary:
        "Nakadepende sa benefit source ang benefit letters. Piliin ang portal na tugma sa income source na natatanggap mo.",
      steps: [
        "Tukuyin kung aling benefit source ang kailangan mong patunayan.",
        "Buksan ang katugmang official portal sa ibaba.",
        "I-download o i-request ang benefit verification / proof of income letter.",
        "Bumalik sa RealDoor at i-upload ang file.",
      ],
      links: [
        {
          key: "ssaBenefitLetter",
          label: "SSA benefit letter",
          note: "Social Security / SSI proof of benefits.",
        },
        {
          key: "dtaConnect",
          label: "DTA Connect",
          note: "SNAP, TAFDC, EAEDC notices at verifications.",
        },
        {
          key: "contactDta",
          label: "Kontakin ang DTA",
          note: "Phone option para sa DTA benefit verification letter.",
        },
        {
          key: "sspVerification",
          label: "SSP verification",
          note: "Massachusetts State Supplement Program.",
        },
        {
          key: "unemploymentProof",
          label: "Unemployment proof",
          note: "Proof of unemployment benefits income.",
        },
      ],
    },
    gig_statement: {
      title: "Hanapin ang gig o self-employment proof",
      issuer: "Gig platform, self-employment records, IRS, o Massachusetts form",
      summary:
        "Karaniwang pinatutunayan ang gig income gamit ang platform earnings statements, tax forms, o self-employment verification form.",
      steps: [
        "Buksan ang iyong gig platform app o website at hanapin ang earnings / tax documents.",
        "I-download ang kasalukuyang monthly statement kung mayroon.",
        "Kung wala kang formal statement, gamitin ang Massachusetts self-employment form bilang fallback.",
        "Bumalik sa RealDoor at i-upload ang file.",
      ],
      links: [
        {
          key: "maSelfEmploymentForm",
          label: "MA self-employment form",
          note: "Opisyal na Massachusetts verification form.",
        },
        {
          key: "irsTranscript",
          label: "IRS Get Transcript",
          note: "Useful para sa prior-year 1099/W-2 wage and income records.",
        },
        {
          key: "irsWageTranscriptHelp",
          label: "IRS wage transcript help",
          note: "Paano humingi ng wage and income transcripts.",
        },
      ],
    },
  },
  vi: {
    application_summary: {
      title: "Tìm bộ hồ sơ đăng ký",
      issuer: "Quản lý bất động sản hoặc tin nhà ở",
      summary:
        "Tài liệu này thường đến từ quản lý bất động sản, tin lottery hoặc cổng nhà ở — không phải từ một trang chính phủ chung.",
      steps: [
        "Tìm tin bất động sản hoặc bộ hồ sơ đăng ký.",
        "Mở phần hướng dẫn đăng ký của tin đó.",
        "Tải xuống hoặc lưu application summary / PDF đăng ký nhà ở.",
        "Quay lại RealDoor và tải tệp lên.",
      ],
      links: [
        {
          key: "metrolist",
          label: "Mở Metrolist",
          note: "Danh sách nhà ở giới hạn thu nhập khu vực Boston.",
        },
        {
          key: "applicationGuide",
          label: "Hướng dẫn đăng ký",
          note: "Giải thích cách hồ sơ nhà ở giới hạn thu nhập thường hoạt động.",
        },
      ],
    },
    pay_stub: {
      title: "Tìm phiếu lương",
      issuer: "Chủ lao động, HR, bộ phận payroll hoặc cổng payroll",
      summary:
        "Phiếu lương thường đến từ hệ thống payroll của chủ lao động. Nếu không truy cập được, hãy hỏi HR hoặc payroll để lấy bản gần đây.",
      steps: [
        "Mở cổng payroll của chủ lao động hoặc liên hệ HR/payroll.",
        "Tải phiếu lương gần nhất dưới dạng PDF hoặc chụp ảnh rõ.",
        "Đảm bảo phiếu có ngày trả lương, lương gộp, giờ làm, mức lương và kỳ lương.",
        "Quay lại RealDoor và tải tệp lên.",
      ],
      links: [
        {
          key: "massPayRecords",
          label: "Hồ sơ lương Massachusetts",
          note: "Hướng dẫn chính thức của bang về quyền nhận lương và lưu hồ sơ.",
        },
        {
          key: "workplaceComplaint",
          label: "Nộp khiếu nại nơi làm việc",
          note: "Dùng nếu chủ lao động từ chối cung cấp hồ sơ lương bắt buộc.",
        },
      ],
    },
    employment_letter: {
      title: "Yêu cầu thư xác nhận việc làm",
      issuer: "Chủ lao động, HR, bộ phận payroll hoặc quản lý",
      summary:
        "Không có một cổng chính phủ chung cho tài liệu này. Nguồn phù hợp thường là HR, payroll hoặc quản lý trực tiếp.",
      steps: [
        "Yêu cầu HR/payroll cung cấp thư xác minh việc làm có chữ ký.",
        "Yêu cầu có tên, vị trí, lương theo giờ, số giờ/tuần thường làm và ngày tài liệu.",
        "Lưu thư thành PDF hoặc chụp ảnh rõ.",
        "Quay lại RealDoor và tải tệp lên.",
      ],
      links: [
        {
          key: "massPayRecords",
          label: "Hồ sơ lương Massachusetts",
          note: "Thông tin hữu ích nếu bạn cần hồ sơ từ chủ lao động.",
        },
        {
          key: "workplaceComplaint",
          label: "Nộp khiếu nại nơi làm việc",
          note: "Phương án dự phòng nếu bạn không lấy được hồ sơ việc làm cần thiết.",
        },
      ],
    },
    benefit_letter: {
      title: "Tìm thư xác minh phúc lợi",
      issuer: "SSA, DTA, SSP hoặc văn phòng thất nghiệp",
      summary:
        "Thư phúc lợi phụ thuộc vào nguồn phúc lợi. Chọn cổng phù hợp với nguồn thu nhập bạn nhận.",
      steps: [
        "Xác định nguồn phúc lợi bạn cần chứng minh.",
        "Mở cổng chính thức phù hợp bên dưới.",
        "Tải xuống hoặc yêu cầu thư xác minh phúc lợi / chứng minh thu nhập.",
        "Quay lại RealDoor và tải tệp lên.",
      ],
      links: [
        {
          key: "ssaBenefitLetter",
          label: "Thư phúc lợi SSA",
          note: "Chứng minh phúc lợi Social Security / SSI.",
        },
        {
          key: "dtaConnect",
          label: "DTA Connect",
          note: "Thông báo và xác minh SNAP, TAFDC, EAEDC.",
        },
        {
          key: "contactDta",
          label: "Liên hệ DTA",
          note: "Tùy chọn qua điện thoại để lấy thư xác minh phúc lợi DTA.",
        },
        {
          key: "sspVerification",
          label: "Xác minh SSP",
          note: "Massachusetts State Supplement Program.",
        },
        {
          key: "unemploymentProof",
          label: "Chứng minh thất nghiệp",
          note: "Chứng minh thu nhập từ trợ cấp thất nghiệp.",
        },
      ],
    },
    gig_statement: {
      title: "Tìm chứng minh gig hoặc tự kinh doanh",
      issuer: "Nền tảng gig, hồ sơ tự kinh doanh, IRS hoặc mẫu Massachusetts",
      summary:
        "Thu nhập gig thường được chứng minh bằng bảng kê thu nhập nền tảng, biểu mẫu thuế hoặc mẫu xác minh tự kinh doanh.",
      steps: [
        "Mở app hoặc website nền tảng gig và tìm earnings / tax documents.",
        "Tải bảng kê tháng hiện tại nếu có.",
        "Nếu không có bảng kê chính thức, dùng mẫu tự kinh doanh Massachusetts làm phương án dự phòng.",
        "Quay lại RealDoor và tải tệp lên.",
      ],
      links: [
        {
          key: "maSelfEmploymentForm",
          label: "Mẫu tự kinh doanh MA",
          note: "Mẫu xác minh chính thức của Massachusetts.",
        },
        {
          key: "irsTranscript",
          label: "IRS Get Transcript",
          note: "Hữu ích cho hồ sơ 1099/W-2 và thu nhập của năm trước.",
        },
        {
          key: "irsWageTranscriptHelp",
          label: "Trợ giúp transcript lương IRS",
          note: "Cách yêu cầu wage and income transcripts.",
        },
      ],
    },
  },
};

function withUrls(guide: LocalizedDocumentGuide): DocumentGuide {
  return {
    ...guide,
    links: guide.links.map(({ key, ...link }) => ({
      ...link,
      href: LINK_HREFS[key],
    })),
  };
}

export function getDocumentGuides(language: Language): Record<GuideDocumentType, DocumentGuide> {
  const copy = DOCUMENT_GUIDE_COPY[language] ?? DOCUMENT_GUIDE_COPY.en;
  return {
    application_summary: withUrls(copy.application_summary),
    pay_stub: withUrls(copy.pay_stub),
    employment_letter: withUrls(copy.employment_letter),
    benefit_letter: withUrls(copy.benefit_letter),
    gig_statement: withUrls(copy.gig_statement),
  };
}

export function useDocumentGuides(): {
  guides: Record<GuideDocumentType, DocumentGuide>;
  ui: DocumentGuideUiCopy;
} {
  const { language } = useI18n();
  return {
    guides: getDocumentGuides(language),
    ui: GUIDE_UI_COPY[language] ?? GUIDE_UI_COPY.en,
  };
}

export const DOCUMENT_GUIDES = getDocumentGuides("en");
