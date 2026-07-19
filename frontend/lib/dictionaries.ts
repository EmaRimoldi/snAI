// Bundled i18n dictionaries — the offline-safe source of truth.
// The five most spoken languages in the US: English, Spanish, Chinese,
// Tagalog, Vietnamese. The Supabase i18n tables mirror this content and can
// override it at runtime (see lib/i18n.tsx); keep both in sync.
// Every language must provide every key — enforced by the Dictionary type.

export type Language = "en" | "es" | "zh" | "tl" | "vi";

export const SUPPORTED_LANGUAGES: ReadonlyArray<{
  code: Language;
  label: string;
  nativeName: string;
  englishName: string;
}> = [
  { code: "en", label: "EN", nativeName: "English", englishName: "English" },
  { code: "es", label: "ES", nativeName: "Español", englishName: "Spanish" },
  { code: "zh", label: "中文", nativeName: "中文", englishName: "Chinese" },
  { code: "tl", label: "TL", nativeName: "Tagalog", englishName: "Tagalog" },
  { code: "vi", label: "VI", nativeName: "Tiếng Việt", englishName: "Vietnamese" },
];

const en = {
  accessibility: { skip: "Skip to main content" },
  nav: {
    homeLabel: "RealDoor home",
    languageLabel: "Choose language",
    discover: "Properties",
    login: "Log in",
    account: "Account",
    signout: "Sign out",
  },
  hero: {
    primaryHeadlineLines: [
      "Preparing your housing paperwork",
      "has never been this easy.",
    ],
    rotatingSupportingLines: [
      "One step at a time",
      "See your next step in minutes, not days",
      "Catch errors before they cost you weeks",
    ],
    assurancesLabel: "Get started details",
    assurances: ["No account needed", "Your documents stay private", "Free to use"],
  },
  input: {
    sectionLabel: "Document assistant",
    ariaLabel: "Upload or describe your documents",
    uploadLabel: "Upload files",
    sendLabel: "Send message",
    attachmentStatus: "{count} files attached",
    placeholders: [
      "Drag your documents here",
      "Ready when you are",
      "One step at a time",
      "Nothing is decided without you",
    ],
  },
  aiChat: {
    openLabel: "Open RealDoor assistant",
    closeLabel: "Close assistant",
    title: "RealDoor assistant",
    placeholder: "How can I help you?",
    sendLabel: "Send message",
    empty: "Ask about the rules, your confirmed values, or what your file still needs.",
    thinking: "Checking trusted sources…",
    privacy: "Do not type names, addresses, or other personal details. Files and raw document text are never sent to the assistant.",
    fallback: "The live assistant was unavailable, so RealDoor used its local frozen-rule fallback.",
  },
  phases: {
    ariaLabel: "How RealDoor helps",
    profile: {
      name: "Profile",
      description: "Upload your documents. Confirm what's true.",
    },
    understand: {
      name: "Understand",
      description: "Ask about the rules. Get the answer, with its source.",
    },
    prepare: {
      name: "Prepare",
      description: "See what's missing. Export when you're ready.",
    },
  },
  login: {
    back: "Back to RealDoor",
    heading: "Log in",
    tagline: "Application-readiness assistant",
    emailLabel: "Email address",
    passwordLabel: "Password",
    submit: "Log in",
    emailRequired: "Error: Enter your email address.",
    passwordRequired: "Error: Enter your password.",
    incorrect: "Error: Incorrect email or password.",
    genericError: "Error: We couldn't sign you in. Please try again.",
    signingIn: "Signing in, please wait.",
    signedIn: "Signed in successfully.",
    signedOut: "Signed out.",
  },
  titles: {
    landing: "RealDoor — Housing paperwork, made clear",
    discover: "Properties — RealDoor",
    login: "Log in — RealDoor",
  },
};

export type Dictionary = typeof en;

const es: Dictionary = {
  accessibility: { skip: "Saltar al contenido principal" },
  nav: {
    homeLabel: "Inicio de RealDoor",
    languageLabel: "Elegir idioma",
    discover: "Propiedades",
    login: "Iniciar sesión",
    account: "Cuenta",
    signout: "Cerrar sesión",
  },
  hero: {
    primaryHeadlineLines: [
      "Tu documentación de vivienda",
      "nunca había sido tan fácil.",
    ],
    rotatingSupportingLines: [
      "Un paso a la vez",
      "Descubre tu siguiente paso en minutos, no en días",
      "Detecta errores antes de que te cuesten semanas",
    ],
    assurancesLabel: "Detalles para comenzar",
    assurances: ["No necesitas una cuenta", "Tus documentos son privados", "Uso gratuito"],
  },
  input: {
    sectionLabel: "Asistente de documentos",
    ariaLabel: "Sube o describe tus documentos",
    uploadLabel: "Subir archivos",
    sendLabel: "Enviar mensaje",
    attachmentStatus: "{count} archivos adjuntos",
    placeholders: [
      "Arrastra tus documentos aquí",
      "Cuando tú quieras",
      "Un paso a la vez",
      "Nada se decide sin ti",
    ],
  },
  aiChat: {
    openLabel: "Abrir el asistente de RealDoor",
    closeLabel: "Cerrar el asistente",
    title: "Asistente de RealDoor",
    placeholder: "¿Cómo puedo ayudarte?",
    sendLabel: "Enviar mensaje",
    empty: "Pregunta sobre las reglas, tus valores confirmados o lo que todavía falta en tu expediente.",
    thinking: "Consultando fuentes confiables…",
    privacy: "No escribas nombres, direcciones ni otros datos personales. Los archivos y el texto original nunca se envían al asistente.",
    fallback: "El asistente en vivo no estaba disponible; RealDoor usó las reglas congeladas locales.",
  },
  phases: {
    ariaLabel: "Cómo ayuda RealDoor",
    profile: {
      name: "Perfil",
      description: "Sube tus documentos. Confirma qué es correcto.",
    },
    understand: {
      name: "Entender",
      description: "Pregunta sobre las reglas. Recibe la respuesta con su fuente.",
    },
    prepare: {
      name: "Preparar",
      description: "Revisa qué falta. Exporta cuando estés listo.",
    },
  },
  login: {
    back: "Volver a RealDoor",
    heading: "Iniciar sesión",
    tagline: "Asistente para preparar tu solicitud",
    emailLabel: "Correo electrónico",
    passwordLabel: "Contraseña",
    submit: "Iniciar sesión",
    emailRequired: "Error: Introduce tu correo electrónico.",
    passwordRequired: "Error: Introduce tu contraseña.",
    incorrect: "Error: El correo o la contraseña son incorrectos.",
    genericError: "Error: No pudimos iniciar sesión. Inténtalo de nuevo.",
    signingIn: "Iniciando sesión, espera un momento.",
    signedIn: "Sesión iniciada correctamente.",
    signedOut: "Sesión cerrada.",
  },
  titles: {
    landing: "RealDoor — Los trámites de vivienda, más claros",
    discover: "Propiedades — RealDoor",
    login: "Iniciar sesión — RealDoor",
  },
};

const zh: Dictionary = {
  accessibility: { skip: "跳转到主要内容" },
  nav: {
    homeLabel: "RealDoor 首页",
    languageLabel: "选择语言",
    discover: "房源",
    login: "登录",
    account: "账户",
    signout: "退出登录",
  },
  hero: {
    primaryHeadlineLines: ["准备住房申请材料", "从未如此简单。"],
    rotatingSupportingLines: ["一步一步来", "几分钟内了解下一步，而不是等上几天", "尽早发现错误，避免耽误数周"],
    assurancesLabel: "开始使用详情",
    assurances: ["无需账户", "您的文件保持私密", "免费使用"],
  },
  input: {
    sectionLabel: "文件助手",
    ariaLabel: "上传或描述您的文件",
    uploadLabel: "上传文件",
    sendLabel: "发送消息",
    attachmentStatus: "已附加 {count} 个文件",
    placeholders: [
      "把文件拖到这里",
      "随时为您服务",
      "一步一步来",
      "没有您的确认，什么都不会决定",
    ],
  },
  aiChat: {
    openLabel: "打开 RealDoor 助手",
    closeLabel: "关闭助手",
    title: "RealDoor 助手",
    placeholder: "我能为您做些什么？",
    sendLabel: "发送消息",
    empty: "您可以询问规则、已确认的数值，或材料中仍缺少什么。",
    thinking: "正在核对可信来源…",
    privacy: "请勿输入姓名、地址或其他个人信息。文件和原始文档文字绝不会发送给助手。",
    fallback: "实时助手暂时不可用，RealDoor 已改用本地冻结规则。",
  },
  phases: {
    ariaLabel: "RealDoor 如何帮助您",
    profile: {
      name: "个人资料",
      description: "上传您的文件。确认哪些信息正确。",
    },
    understand: {
      name: "了解",
      description: "咨询相关规则。获得答案及其来源。",
    },
    prepare: {
      name: "准备",
      description: "查看还缺什么。准备好后即可导出。",
    },
  },
  login: {
    back: "返回 RealDoor",
    heading: "登录",
    tagline: "申请准备助手",
    emailLabel: "电子邮箱",
    passwordLabel: "密码",
    submit: "登录",
    emailRequired: "错误：请输入您的电子邮箱。",
    passwordRequired: "错误：请输入您的密码。",
    incorrect: "错误：邮箱或密码不正确。",
    genericError: "错误：无法登录，请重试。",
    signingIn: "正在登录，请稍候。",
    signedIn: "登录成功。",
    signedOut: "已退出登录。",
  },
  titles: {
    landing: "RealDoor — 住房手续，一目了然",
    discover: "房源 — RealDoor",
    login: "登录 — RealDoor",
  },
};

const tl: Dictionary = {
  accessibility: { skip: "Lumaktaw sa pangunahing nilalaman" },
  nav: {
    homeLabel: "RealDoor home",
    languageLabel: "Pumili ng wika",
    discover: "Mga property",
    login: "Mag-log in",
    account: "Account",
    signout: "Mag-sign out",
  },
  hero: {
    primaryHeadlineLines: [
      "Paghahanda ng mga papeles sa pabahay",
      "hindi pa naging ganito kadali.",
    ],
    rotatingSupportingLines: [
      "Isang hakbang sa bawat pagkakataon",
      "Alamin ang susunod mong hakbang sa loob ng ilang minuto, hindi araw",
      "Mahuli ang mga pagkakamali bago ka maantala nang ilang linggo",
    ],
    assurancesLabel: "Mga detalye bago magsimula",
    assurances: ["Hindi kailangan ng account", "Pribado ang iyong mga dokumento", "Libreng gamitin"],
  },
  input: {
    sectionLabel: "Katulong sa dokumento",
    ariaLabel: "I-upload o ilarawan ang iyong mga dokumento",
    uploadLabel: "Mag-upload ng mga file",
    sendLabel: "Ipadala ang mensahe",
    attachmentStatus: "{count} file ang nakalakip",
    placeholders: [
      "I-drag ang iyong mga dokumento dito",
      "Handa kapag handa ka na",
      "Isang hakbang sa bawat pagkakataon",
      "Walang pinagpapasyahan nang wala ka",
    ],
  },
  aiChat: {
    openLabel: "Buksan ang RealDoor assistant",
    closeLabel: "Isara ang assistant",
    title: "RealDoor assistant",
    placeholder: "Paano kita matutulungan?",
    sendLabel: "Ipadala ang mensahe",
    empty: "Magtanong tungkol sa mga patakaran, kumpirmadong halaga, o kung ano pa ang kulang sa file.",
    thinking: "Sinusuri ang mga mapagkakatiwalaang sanggunian…",
    privacy: "Huwag mag-type ng pangalan, address, o ibang personal na detalye. Hindi ipinapadala sa assistant ang mga file o hilaw na teksto.",
    fallback: "Hindi available ang live assistant, kaya ginamit ng RealDoor ang lokal na frozen-rule fallback.",
  },
  phases: {
    ariaLabel: "Paano tumutulong ang RealDoor",
    profile: {
      name: "Profile",
      description: "I-upload ang iyong mga dokumento. Kumpirmahin kung ano ang totoo.",
    },
    understand: {
      name: "Unawain",
      description: "Magtanong tungkol sa mga patakaran. Kunin ang sagot, kasama ang pinagmulan nito.",
    },
    prepare: {
      name: "Maghanda",
      description: "Tingnan kung ano ang kulang. I-export kapag handa ka na.",
    },
  },
  login: {
    back: "Bumalik sa RealDoor",
    heading: "Mag-log in",
    tagline: "Katulong sa paghahanda ng aplikasyon",
    emailLabel: "Email address",
    passwordLabel: "Password",
    submit: "Mag-log in",
    emailRequired: "Error: Ilagay ang iyong email address.",
    passwordRequired: "Error: Ilagay ang iyong password.",
    incorrect: "Error: Mali ang email o password.",
    genericError: "Error: Hindi ka namin ma-sign in. Pakisubukang muli.",
    signingIn: "Nagsa-sign in, mangyaring maghintay.",
    signedIn: "Matagumpay na naka-sign in.",
    signedOut: "Naka-sign out na.",
  },
  titles: {
    landing: "RealDoor — Mga papeles sa pabahay, ginawang malinaw",
    discover: "Mga property — RealDoor",
    login: "Mag-log in — RealDoor",
  },
};

const vi: Dictionary = {
  accessibility: { skip: "Bỏ qua đến nội dung chính" },
  nav: {
    homeLabel: "Trang chủ RealDoor",
    languageLabel: "Chọn ngôn ngữ",
    discover: "Bất động sản",
    login: "Đăng nhập",
    account: "Tài khoản",
    signout: "Đăng xuất",
  },
  hero: {
    primaryHeadlineLines: ["Chuẩn bị giấy tờ nhà ở", "chưa bao giờ dễ dàng đến thế."],
    rotatingSupportingLines: [
      "Từng bước một",
      "Biết bước tiếp theo chỉ trong vài phút, không phải vài ngày",
      "Phát hiện lỗi trước khi chúng khiến bạn mất hàng tuần",
    ],
    assurancesLabel: "Thông tin trước khi bắt đầu",
    assurances: ["Không cần tài khoản", "Giấy tờ của bạn luôn riêng tư", "Sử dụng miễn phí"],
  },
  input: {
    sectionLabel: "Trợ lý giấy tờ",
    ariaLabel: "Tải lên hoặc mô tả giấy tờ của bạn",
    uploadLabel: "Tải tệp lên",
    sendLabel: "Gửi tin nhắn",
    attachmentStatus: "Đã đính kèm {count} tệp",
    placeholders: [
      "Kéo giấy tờ của bạn vào đây",
      "Sẵn sàng khi bạn sẵn sàng",
      "Từng bước một",
      "Không có gì được quyết định nếu thiếu bạn",
    ],
  },
  aiChat: {
    openLabel: "Mở trợ lý RealDoor",
    closeLabel: "Đóng trợ lý",
    title: "Trợ lý RealDoor",
    placeholder: "Tôi có thể giúp gì cho bạn?",
    sendLabel: "Gửi tin nhắn",
    empty: "Hãy hỏi về quy định, các giá trị đã xác nhận hoặc hồ sơ còn thiếu gì.",
    thinking: "Đang kiểm tra các nguồn đáng tin cậy…",
    privacy: "Không nhập tên, địa chỉ hoặc thông tin cá nhân khác. Tệp và văn bản gốc không bao giờ được gửi cho trợ lý.",
    fallback: "Trợ lý trực tiếp không khả dụng nên RealDoor đã dùng bộ quy tắc cục bộ đã đóng băng.",
  },
  phases: {
    ariaLabel: "RealDoor giúp bạn như thế nào",
    profile: {
      name: "Hồ sơ",
      description: "Tải lên giấy tờ của bạn. Xác nhận điều gì là đúng.",
    },
    understand: {
      name: "Tìm hiểu",
      description: "Hỏi về các quy định. Nhận câu trả lời kèm nguồn.",
    },
    prepare: {
      name: "Chuẩn bị",
      description: "Xem còn thiếu gì. Xuất hồ sơ khi bạn sẵn sàng.",
    },
  },
  login: {
    back: "Quay lại RealDoor",
    heading: "Đăng nhập",
    tagline: "Trợ lý chuẩn bị hồ sơ",
    emailLabel: "Địa chỉ email",
    passwordLabel: "Mật khẩu",
    submit: "Đăng nhập",
    emailRequired: "Lỗi: Nhập địa chỉ email của bạn.",
    passwordRequired: "Lỗi: Nhập mật khẩu của bạn.",
    incorrect: "Lỗi: Email hoặc mật khẩu không đúng.",
    genericError: "Lỗi: Chúng tôi không thể đăng nhập cho bạn. Vui lòng thử lại.",
    signingIn: "Đang đăng nhập, vui lòng đợi.",
    signedIn: "Đăng nhập thành công.",
    signedOut: "Đã đăng xuất.",
  },
  titles: {
    landing: "RealDoor — Thủ tục nhà ở, rõ ràng hơn",
    discover: "Bất động sản — RealDoor",
    login: "Đăng nhập — RealDoor",
  },
};

export const dictionaries: Record<Language, Dictionary> = { en, es, zh, tl, vi };
