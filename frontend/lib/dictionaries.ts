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
    login: "Log in",
    account: "Account",
    signout: "Sign out",
  },
  hero: {
    rotatingHeadline: "Housing paperwork in minutes.",
    subheadline: "Housing paperwork, made clear.",
    rotatingSellingPoints: [
      "Catch missing details early.",
      "Save on preparation fees.",
      "Safe checks. Published rules.",
    ],
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
    login: "Log in — RealDoor",
  },
};

export type Dictionary = typeof en;

const es: Dictionary = {
  accessibility: { skip: "Saltar al contenido principal" },
  nav: {
    homeLabel: "Inicio de RealDoor",
    languageLabel: "Elegir idioma",
    login: "Iniciar sesión",
    account: "Cuenta",
    signout: "Cerrar sesión",
  },
  hero: {
    rotatingHeadline: "Documentos listos en minutos.",
    subheadline: "Los trámites de vivienda, más claros.",
    rotatingSellingPoints: [
      "Detecta a tiempo lo que falta.",
      "Ahorra en la preparación.",
      "Revisiones seguras. Reglas vigentes.",
    ],
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
    login: "Iniciar sesión — RealDoor",
  },
};

const zh: Dictionary = {
  accessibility: { skip: "跳转到主要内容" },
  nav: {
    homeLabel: "RealDoor 首页",
    languageLabel: "选择语言",
    login: "登录",
    account: "账户",
    signout: "退出登录",
  },
  hero: {
    rotatingHeadline: "住房文件，几分钟完成。",
    subheadline: "住房手续，一目了然。",
    rotatingSellingPoints: [
      "尽早发现缺失信息。",
      "节省准备费用。",
      "安全检查，依据公开规则。",
    ],
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
    login: "登录 — RealDoor",
  },
};

const tl: Dictionary = {
  accessibility: { skip: "Lumaktaw sa pangunahing nilalaman" },
  nav: {
    homeLabel: "RealDoor home",
    languageLabel: "Pumili ng wika",
    login: "Mag-log in",
    account: "Account",
    signout: "Mag-sign out",
  },
  hero: {
    rotatingHeadline: "Papeles, handa sa ilang minuto.",
    subheadline: "Mga papeles sa pabahay, ginawang malinaw.",
    rotatingSellingPoints: [
      "Maagang makita ang kulang.",
      "Makatipid sa paghahanda.",
      "Ligtas. Ayon sa patakaran.",
    ],
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
    login: "Mag-log in — RealDoor",
  },
};

const vi: Dictionary = {
  accessibility: { skip: "Bỏ qua đến nội dung chính" },
  nav: {
    homeLabel: "Trang chủ RealDoor",
    languageLabel: "Chọn ngôn ngữ",
    login: "Đăng nhập",
    account: "Tài khoản",
    signout: "Đăng xuất",
  },
  hero: {
    rotatingHeadline: "Hồ sơ sẵn sàng trong vài phút.",
    subheadline: "Thủ tục nhà ở, rõ ràng hơn.",
    rotatingSellingPoints: [
      "Phát hiện sớm phần còn thiếu.",
      "Tiết kiệm phí chuẩn bị.",
      "Kiểm tra an toàn. Theo quy định.",
    ],
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
    login: "Đăng nhập — RealDoor",
  },
};

export const dictionaries: Record<Language, Dictionary> = { en, es, zh, tl, vi };
