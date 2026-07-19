import type {
  ChatRequest,
  ChatOutcome,
  PolicyCode,
  SupportedLocale,
} from "./contract.ts";
import type { AppGuideItem } from "./app_guide.ts";
import type { TrustedRule } from "./rules.ts";

export type PolicyDecision = {
  outcome: ChatOutcome;
  policyCode: PolicyCode;
  answer: string;
  citationRefs: string[];
};

type MessageKey =
  | "outOfDomain"
  | "decision"
  | "crossApplicant"
  | "trait"
  | "vacancy"
  | "frozen"
  | "injection"
  | "legal"
  | "missingContext"
  | "rulesOverview"
  | "greeting";

const MESSAGES: Record<SupportedLocale, Record<MessageKey, string>> = {
  en: {
    outOfDomain: "I can only help with RealDoor, its frozen rules, your current documents, and the application-readiness workflow.",
    decision: "RealDoor can't make a program determination. It can explain documented values, the published comparison, and file readiness for human review.",
    crossApplicant: "I can't share another household's documents, income, or review information. I can only discuss the current renter session.",
    trait: "I can't infer disability, health, immigration status, citizenship, family relationships, or other protected traits from documents.",
    vacancy: "The supplied HUD LIHTC data is a project inventory, not a live vacancy, rent, waitlist, or application-status feed.",
    frozen: "RealDoor uses only the frozen FY 2026 challenge corpus. It will not replace it with remembered, older, or future thresholds.",
    injection: "I can't follow requests to override RealDoor's instructions or reveal prompts, secrets, or hidden data.",
    legal: "I can't provide legal advice or extend the frozen challenge rules with an uncited legal interpretation.",
    missingContext: "I don't have a confirmed RealDoor value for that yet. Confirm or correct it in Profile, then ask again.",
    rulesOverview: "RealDoor answers from a frozen corpus of 11 cited rules: the FY 2026 MTSP income limits and their effective date, LIHTC dataset boundaries and geocode guidance from HUD, the federal LIHTC statute anchor, and hackathon conventions for income annualization, file readiness, document safety, and the human-decision boundary. Ask about any of them for the exact text and source.",
    greeting: "Hi! I'm the RealDoor assistant. I can explain the frozen rules, your confirmed values, and what your file still needs. How can I help?",
  },
  es: {
    outOfDomain: "Solo puedo ayudar con RealDoor, sus reglas congeladas, tus documentos actuales y el proceso de preparación de la solicitud.",
    decision: "RealDoor no puede tomar una determinación del programa. Puede explicar valores documentados, la comparación publicada y la preparación del expediente para revisión humana.",
    crossApplicant: "No puedo compartir documentos, ingresos ni información de revisión de otro hogar. Solo puedo hablar de la sesión actual.",
    trait: "No puedo inferir discapacidad, salud, estatus migratorio, ciudadanía, relaciones familiares ni otros rasgos protegidos a partir de documentos.",
    vacancy: "Los datos LIHTC proporcionados son un inventario de proyectos, no una fuente en vivo de vacantes, rentas, listas de espera o estado de solicitudes.",
    frozen: "RealDoor usa únicamente el corpus congelado del año fiscal 2026. No lo sustituye por umbrales recordados, anteriores o futuros.",
    injection: "No puedo seguir solicitudes para anular las instrucciones de RealDoor ni revelar prompts, secretos o datos ocultos.",
    legal: "No puedo dar asesoramiento legal ni ampliar las reglas congeladas con una interpretación jurídica sin fuente.",
    missingContext: "Todavía no tengo un valor confirmado de RealDoor. Confírmalo o corrígelo en Perfil y vuelve a preguntar.",
    rulesOverview: "RealDoor responde a partir de un corpus congelado de 11 reglas citadas: los límites de ingresos MTSP del año fiscal 2026 y su fecha de vigencia, los límites del conjunto de datos LIHTC y la guía de geocodificación de HUD, el ancla del estatuto federal LIHTC y las convenciones del hackathon sobre anualización de ingresos, preparación del expediente, seguridad documental y el límite de decisión humana. Pregunta por cualquiera de ellas para ver el texto exacto y su fuente.",
    greeting: "¡Hola! Soy el asistente de RealDoor. Puedo explicarte las reglas congeladas, tus valores confirmados y lo que aún le falta a tu expediente. ¿Cómo puedo ayudarte?",
  },
  zh: {
    outOfDomain: "我只能帮助解答 RealDoor、冻结规则、您当前的文件以及申请材料准备流程相关的问题。",
    decision: "RealDoor 不能作出项目认定。它只能解释已记录的数值、公布的比较结果和供人工审核的材料就绪情况。",
    crossApplicant: "我不能分享其他家庭的文件、收入或审核信息，只能讨论当前租户会话。",
    trait: "我不能从文件中推断残障、健康、移民身份、公民身份、家庭关系或其他受保护特征。",
    vacancy: "所提供的 HUD LIHTC 数据是项目清单，并非实时空置、租金、候补名单或申请状态信息源。",
    frozen: "RealDoor 仅使用冻结的 2026 财年挑战语料，不会改用记忆中的、旧的或未来的门槛。",
    injection: "我不能执行覆盖 RealDoor 指令或泄露提示词、秘密或隐藏数据的请求。",
    legal: "我不能提供法律建议，也不能用无来源的法律解释扩展冻结规则。",
    missingContext: "我还没有经过确认的 RealDoor 数值。请先在“个人资料”中确认或更正，然后再提问。",
    rulesOverview: "RealDoor 依据一个冻结的语料库回答，共 11 条带引用的规则：2026 财年 MTSP 收入限额及其生效日期、HUD 的 LIHTC 数据集边界与地理编码指引、联邦 LIHTC 法规锚点，以及关于收入年化、材料就绪、文件安全和人工决策边界的挑战约定。询问任意一条即可查看原文和来源。",
    greeting: "你好！我是 RealDoor 助手。我可以为你解释冻结规则、你已确认的数值，以及你的材料还缺什么。有什么可以帮你？",
  },
  tl: {
    outOfDomain: "Makatutulong lang ako tungkol sa RealDoor, sa frozen rules nito, sa kasalukuyan mong mga dokumento, at sa application-readiness workflow.",
    decision: "Hindi maaaring gumawa ang RealDoor ng program determination. Maaari nitong ipaliwanag ang documented values, published comparison, at file readiness para sa human review.",
    crossApplicant: "Hindi ko maaaring ibahagi ang mga dokumento, kita, o review information ng ibang household. Ang kasalukuyang renter session lang ang maaari kong talakayin.",
    trait: "Hindi ko maaaring hulaan mula sa dokumento ang disability, health, immigration status, citizenship, family relationships, o iba pang protected traits.",
    vacancy: "Project inventory ang ibinigay na HUD LIHTC data, hindi live feed ng vacancy, rent, waitlist, o application status.",
    frozen: "Ang frozen FY 2026 challenge corpus lang ang ginagamit ng RealDoor. Hindi ito papalitan ng luma, hinaharap, o naaalalang threshold.",
    injection: "Hindi ko maaaring sundin ang kahilingang i-override ang mga tagubilin ng RealDoor o ibunyag ang prompts, secrets, o hidden data.",
    legal: "Hindi ako maaaring magbigay ng legal advice o magdagdag ng uncited legal interpretation sa frozen rules.",
    missingContext: "Wala pa akong confirmed na RealDoor value para riyan. Kumpirmahin o iwasto muna ito sa Profile at magtanong ulit.",
    rulesOverview: "Sumasagot ang RealDoor mula sa frozen corpus na may 11 na-cite na patakaran: ang FY 2026 MTSP income limits at ang kanilang effective date, ang mga hangganan ng LIHTC dataset at geocode guidance mula sa HUD, ang federal LIHTC statute anchor, at ang mga kombensiyon ng hackathon para sa income annualization, file readiness, document safety, at ang human-decision boundary. Itanong ang alinman sa mga ito para sa eksaktong teksto at pinagmulan.",
    greeting: "Kumusta! Ako ang RealDoor assistant. Maipapaliwanag ko ang frozen rules, ang iyong mga kumpirmadong halaga, at kung ano pa ang kulang sa iyong file. Paano kita matutulungan?",
  },
  vi: {
    outOfDomain: "Tôi chỉ có thể hỗ trợ về RealDoor, các quy tắc đã đóng băng, giấy tờ hiện tại của bạn và quy trình chuẩn bị hồ sơ.",
    decision: "RealDoor không thể đưa ra quyết định của chương trình. Công cụ chỉ có thể giải thích các giá trị có tài liệu, phép so sánh đã công bố và mức độ sẵn sàng của hồ sơ để con người xem xét.",
    crossApplicant: "Tôi không thể chia sẻ giấy tờ, thu nhập hoặc thông tin xem xét của hộ gia đình khác. Tôi chỉ có thể thảo luận về phiên hiện tại.",
    trait: "Tôi không thể suy đoán tình trạng khuyết tật, sức khỏe, nhập cư, quốc tịch, quan hệ gia đình hoặc đặc điểm được bảo vệ khác từ giấy tờ.",
    vacancy: "Dữ liệu HUD LIHTC được cung cấp là danh mục dự án, không phải nguồn trực tiếp về căn trống, tiền thuê, danh sách chờ hoặc trạng thái hồ sơ.",
    frozen: "RealDoor chỉ sử dụng bộ quy tắc thử thách FY 2026 đã đóng băng, không thay thế bằng ngưỡng cũ, tương lai hoặc dựa trên trí nhớ.",
    injection: "Tôi không thể làm theo yêu cầu ghi đè hướng dẫn của RealDoor hoặc tiết lộ prompt, bí mật hay dữ liệu ẩn.",
    legal: "Tôi không thể tư vấn pháp lý hoặc mở rộng quy tắc đã đóng băng bằng diễn giải pháp luật không có nguồn.",
    missingContext: "Tôi chưa có giá trị RealDoor đã xác nhận cho nội dung đó. Hãy xác nhận hoặc sửa trong phần Hồ sơ rồi hỏi lại.",
    rulesOverview: "RealDoor trả lời dựa trên bộ quy tắc đã đóng băng gồm 11 quy tắc có trích dẫn: giới hạn thu nhập MTSP FY 2026 và ngày hiệu lực, ranh giới bộ dữ liệu LIHTC và hướng dẫn mã hóa địa lý của HUD, điểm neo đạo luật LIHTC liên bang, cùng các quy ước hackathon về quy đổi thu nhập theo năm, mức độ sẵn sàng của hồ sơ, an toàn tài liệu và ranh giới quyết định của con người. Hãy hỏi bất kỳ quy tắc nào để xem nguyên văn và nguồn.",
    greeting: "Xin chào! Tôi là trợ lý RealDoor. Tôi có thể giải thích các quy tắc đã đóng băng, các giá trị bạn đã xác nhận và hồ sơ của bạn còn thiếu gì. Tôi có thể giúp gì cho bạn?",
  },
};

const OFF_TOPIC_RE = /\b(poem|poetry|recipe|carbonara|weather|forecast|world cup|football score|sports score|homework|write (?:me )?code|python code|javascript code|stock price|bitcoin|movie|song|lyrics|joke|translate this|capital of|president of)\b/i;
const INJECTION_RE = /ignore (?:all |the )?(?:previous|system|developer) instructions|reveal (?:the )?(?:system prompt|developer prompt|secret|api key)|jailbreak|act as chatgpt|override realdoor/i;
const CROSS_APPLICANT_RE = /(?:another|other|different|previous)\s+(?:household|applicant|family|person)|(?:my\s+)?neighbor(?:'s|\s+applied)?|someone else(?:'s)?|otro hogar|otra familia|ibang household/i;
const TRAIT_RE = /disabilit|immigration|citizenship|health condition|ethnic|religio|pregnan|marital status|protected trait|family relationship/i;
const VACANCY_RE = /vacan|available.{0,24}(?:today|now)|unit available|waitlist|open unit|current rent/i;
const OTHER_YEAR_RE = /\b20(?!26)\d\d\b.*\b(limit|threshold|ami|mtsp)|\b(limit|threshold|ami|mtsp)\b.*\b20(?!26)\d\d\b|last year's? (?:limit|threshold)|newest (?:limit|threshold)/i;
const LEGAL_RE = /(?:give|provide|need|want) (?:me )?legal advice|act as (?:my )?(?:lawyer|attorney)|what are my legal rights|can i sue/i;
const DIRECT_DECISION_PATTERNS = [
  /\bam i\s+(?:eligible|qualified|approved)/i,
  /\bdo i\s+(?:qualify|get approved)/i,
  /\bwill i\s+(?:qualify|be approved|be denied|get accepted)/i,
  /\b(?:approve|deny|reject|prioritize|rank)\s+(?:me|this|the|my)/i,
  /\btell me (?:if|whether)\s+(?:i|the applicant|this household).{0,40}(?:eligible|qualified|approved|denied)/i,
  /\bis (?:this|the) (?:applicant|household|family|person).{0,30}(?:eligible|qualified|approved|denied)/i,
  /\b(?:approved|denied|eligible|ineligible)(?:\s*\/\s*|\s+or\s+|\s+and\s+)(?:approved|denied|eligible|ineligible)\s+decision\b/i,
];
// Plain greetings get a friendly deterministic reply (grounded on the flow
// guide) instead of an OUT_OF_DOMAIN abstain. Anchored to the whole message so
// "hi, what are the rules?" still routes to the real question.
const GREETING_RE = /^\s*(?:(?:hi+|hello|hey|howdy)(?: there)?|good (?:morning|afternoon|evening)|greetings|ciao|salve|hola|buenos días|buenas(?: tardes| noches)?|kumusta|kamusta|magandang (?:umaga|hapon|gabi)|xin chào|chào(?: bạn)?|你好|您好|嗨|哈喽)\s*[!.。！？?]*\s*$/iu;
// Bare "what are the rules" meta questions get a deterministic cited overview
// instead of a model call — gpt-4o-mini is unreliable on this shape (it flips
// between abstaining and paraphrasing rules with verdict words the decision
// lint then rejects). Anchored so specific rule questions still reach the model.
const RULES_OVERVIEW_RE = /^\s*(?:what (?:are|is)|list|show(?: me)?|tell me)\s+(?:the\s+|all\s+|your\s+|realdoor(?:'s)?\s+)*rules\s*\??\s*$|^\s*ano ang (?:mga )?(?:patakaran|panuntunan)\s*\??\s*$|^\s*¿?cu[aá]les son las reglas\??\s*$|^\s*(?:有哪些规则|规则是什么|有什么规则)[?？]?\s*$|^\s*(?:các )?quy tắc (?:là gì|nào)\s*\??\s*$/iu;
// In-domain vocabulary gate. JS \b is ASCII-only, so any term that ends in an
// accented or CJK character must live in the boundary-free tail after the
// \b(...)\b group or it can never match (e.g. "giấy tờ", "hồ sơ").
const DOMAIN_RE = /\b(?:realdoor|lihtc|hud|mtsp|ami|income|threshold|limits?|rules?|document\w*|paperwork|applications?|profile|understand|prepare|readiness|review|checklist|letters?|stubs?|paystubs?|pay|payments?|earn\w*|salar\w*|wages?|money|rent\w*|housing|afford\w*|household|employ\w*|benefit\w*|gigs?|citation|source|geocode|vacan\w*|waitlist|eligib\w*|approv\w*|deni\w*|qualif\w*|upload|confirm|correct|delete|sessions?|deadline|effective|annualiz\w*|evidence|expire\w*|errors?|status|steps?|phases?|packet|export|download|privac\w*|private|help\w*|assist\w*|regla\w*|regol\w*|soglia|reddito|redditi|ingreso\w*|umbral\w*|vivienda|papeleo|hogar\w*|solicitud|perfil|dokumento|patakaran|tulong|sahod|upa|pabahay|bahay|kita|aplikasyon|thu nhập|quy tắc)\b|giấy tờ|hồ sơ|ngưỡng|thuê|giúp|bước|ayuda|ayúd|文件|收入|申请|规则|门槛|限额|住房|租金|帮助|步骤/iu;
const CONTEXTUAL_FOLLOWUP_RE = /^\s*(?:why\??|why (?:is|does|did) (?:this|that|it)|how (?:do|does|did|can) .{0,30}(?:this|that|it)|what does (?:this|that|it) mean|explain (?:this|that|it)|tell me more|por qué|qué significa (?:esto|eso)|explícame (?:esto|eso)|为什么|这是什么意思|请解释这个|bakit|ipaliwanag (?:ito|iyan)|tại sao|điều này nghĩa là gì)/i;

export function classifyRequest(request: ChatRequest): PolicyDecision | null {
  const q = request.question;
  const m = MESSAGES[request.locale];
  if (INJECTION_RE.test(q)) {
    return { outcome: "refused", policyCode: "PROMPT_INJECTION", answer: m.injection, citationRefs: ["rule:CH-SAFETY-001"] };
  }
  if (CROSS_APPLICANT_RE.test(q)) {
    return { outcome: "refused", policyCode: "CROSS_APPLICANT_DATA", answer: m.crossApplicant, citationRefs: ["rule:CH-SAFETY-001"] };
  }
  if (TRAIT_RE.test(q)) {
    return { outcome: "refused", policyCode: "PROTECTED_TRAIT_INFERENCE", answer: m.trait, citationRefs: ["rule:CH-SAFETY-001", "rule:CH-INCOME-001"] };
  }
  if (LEGAL_RE.test(q)) {
    return { outcome: "abstained", policyCode: "LEGAL_ADVICE", answer: m.legal, citationRefs: ["rule:FED-LIHTC-001"] };
  }
  if (DIRECT_DECISION_PATTERNS.some((pattern) => pattern.test(q))) {
    return { outcome: "refused", policyCode: "DECISION_BOUNDARY", answer: m.decision, citationRefs: ["rule:CH-DECISION-001"] };
  }
  if (VACANCY_RE.test(q)) {
    return { outcome: "answered", policyCode: "DATASET_LIMITATION", answer: m.vacancy, citationRefs: ["rule:HUD-DATA-001", "rule:CH-DECISION-001"] };
  }
  if (OTHER_YEAR_RE.test(q)) {
    return { outcome: "answered", policyCode: "FROZEN_CORPUS_ONLY", answer: m.frozen, citationRefs: ["rule:HUD-MTSP-001", "rule:HUD-MTSP-002"] };
  }
  if (GREETING_RE.test(q)) {
    return { outcome: "answered", policyCode: "NONE", answer: m.greeting, citationRefs: ["guide:GUIDE-FLOW-001"] };
  }
  if (RULES_OVERVIEW_RE.test(q)) {
    return {
      outcome: "answered",
      policyCode: "NONE",
      answer: m.rulesOverview,
      citationRefs: [
        "rule:HUD-MTSP-001",
        "rule:HUD-MTSP-002",
        "rule:HUD-DATA-001",
        "rule:FED-LIHTC-001",
        "rule:CH-INCOME-001",
        "rule:CH-READINESS-001",
        "rule:CH-SAFETY-001",
        "rule:CH-DECISION-001",
      ],
    };
  }
  const inDomain = DOMAIN_RE.test(q) || (request.mode === "personalized" && CONTEXTUAL_FOLLOWUP_RE.test(q));
  if (OFF_TOPIC_RE.test(q) || /^\s*(?:what is|calculate|compute)?\s*\d+\s*[-+*/]\s*\d+/i.test(q) || !inDomain) {
    return { outcome: "abstained", policyCode: "OUT_OF_DOMAIN", answer: m.outOfDomain, citationRefs: [] };
  }
  return null;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "of", "to", "for", "and", "or", "in", "on", "what",
  "how", "do", "does", "i", "my", "me", "can", "you", "this", "that", "with", "about",
  "it", "be", "if", "when", "which", "there", "any", "am", "your", "from",
]);

function tokens(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function money(value: number, cents = true): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })}`;
}

export function deterministicFallback(
  request: ChatRequest,
  rules: readonly TrustedRule[],
  guide: readonly AppGuideItem[],
): PolicyDecision {
  const q = request.question.toLowerCase();
  const context = request.context;
  const m = MESSAGES[request.locale];

  if (context) {
    if (q.includes("threshold") && !q.includes("compare")) {
      if (context.frozenThreshold !== null && context.householdSize !== null) {
        return {
          outcome: "answered",
          policyCode: "NONE",
          answer: `${money(context.frozenThreshold, false)} for household size ${context.householdSize}.`,
          citationRefs: ["rule:HUD-MTSP-002"],
        };
      }
      return { outcome: "needs_confirmation", policyCode: "MISSING_CONTEXT", answer: m.missingContext, citationRefs: ["guide:GUIDE-CONFIRM-001"] };
    }
    if (q.includes("compare")) {
      if (context.comparison) {
        return { outcome: "answered", policyCode: "NONE", answer: context.comparison, citationRefs: ["rule:HUD-MTSP-002", "rule:CH-INCOME-001"] };
      }
      return { outcome: "needs_confirmation", policyCode: "MISSING_CONTEXT", answer: m.missingContext, citationRefs: ["guide:GUIDE-CONFIRM-001"] };
    }
    if (q.includes("annualized") || q.includes("income") || q.includes("gross")) {
      if (context.annualizedIncome !== null) {
        const evidence = context.incomeSources.map((source) => `evidence:${source.evidenceRef}`);
        return {
          outcome: "answered",
          policyCode: "NONE",
          answer: `${money(context.annualizedIncome)} under the frozen annualization convention.`,
          citationRefs: ["rule:CH-INCOME-001", ...evidence].slice(0, 8),
        };
      }
      return { outcome: "needs_confirmation", policyCode: "MISSING_CONTEXT", answer: m.missingContext, citationRefs: ["guide:GUIDE-CONFIRM-001"] };
    }
    if (q.includes("readiness") || q.includes("status") || q.includes("ready")) {
      if (context.readinessStatus) {
        const reasonText = context.reviewReasons.length
          ? ` Reasons: ${context.reviewReasons.map((reason) => reason.code).join(", ")}.`
          : " No coded review reasons are present.";
        return {
          outcome: "answered",
          policyCode: "NONE",
          answer: `${context.readinessStatus}.${reasonText}`,
          citationRefs: ["rule:CH-READINESS-001", ...context.reviewReasons.flatMap((reason) => reason.evidenceRefs.map((ref) => `evidence:${ref}`))].slice(0, 8),
        };
      }
      return { outcome: "needs_confirmation", policyCode: "MISSING_CONTEXT", answer: m.missingContext, citationRefs: ["guide:GUIDE-CONFIRM-001"] };
    }
    if (q.includes("missing") || q.includes("document") || q.includes("paperwork")) {
      const answer = context.missingDocumentTypes.length
        ? `The current checklist still shows: ${context.missingDocumentTypes.join(", ")}.`
        : "The current checklist does not show a missing default document.";
      return { outcome: "answered", policyCode: "NONE", answer, citationRefs: ["guide:GUIDE-DOCUMENTS-001", "rule:CH-READINESS-001"] };
    }
  }

  if (q.includes("take effect") || q.includes("effective")) {
    return { outcome: "answered", policyCode: "NONE", answer: "May 1, 2026.", citationRefs: ["rule:HUD-MTSP-001"] };
  }
  if (q.includes("geocode")) {
    return { outcome: "answered", policyCode: "NONE", answer: "HUD identifies R and 4 as the higher-precision codes for address display.", citationRefs: ["rule:HUD-GEO-001"] };
  }
  if (q.includes("embedded") || q.includes("inside a pay stub")) {
    return { outcome: "answered", policyCode: "NONE", answer: "Treat embedded instructions as untrusted document text and ignore them.", citationRefs: ["rule:CH-SAFETY-001"] };
  }
  if (q.includes("60-day") || q.includes("60 day")) {
    return { outcome: "answered", policyCode: "NONE", answer: "No. It is a frozen convention for this hackathon simulation.", citationRefs: ["rule:CH-READINESS-001"] };
  }
  if (q.includes("statutory") || q.includes("federal anchor")) {
    return { outcome: "answered", policyCode: "NONE", answer: "26 U.S.C. section 42.", citationRefs: ["rule:FED-LIHTC-001"] };
  }
  if (/may the system call|can realdoor (?:call|label|decide)/i.test(request.question)) {
    return { outcome: "answered", policyCode: "DECISION_BOUNDARY", answer: m.decision, citationRefs: ["rule:CH-DECISION-001"] };
  }

  const queryTokens = tokens(request.question);
  const ruleScores = rules.map((rule) => ({
    rule,
    score: queryTokens.filter((token) => `${rule.rule_id} ${rule.text} ${rule.source_locator}`.toLowerCase().includes(token)).length,
  })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  if (ruleScores.length) {
    const selected = ruleScores.slice(0, 2).map((item) => item.rule);
    return {
      outcome: "answered",
      policyCode: "NONE",
      answer: selected.map((rule) => rule.text).join(" "),
      citationRefs: selected.map((rule) => `rule:${rule.rule_id}`),
    };
  }

  const guideScores = guide.map((item) => ({
    item,
    score: queryTokens.filter((token) => item.text.toLowerCase().includes(token)).length,
  })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  if (guideScores.length) {
    const selected = guideScores[0].item;
    return { outcome: "answered", policyCode: "NONE", answer: selected.text, citationRefs: [`guide:${selected.guide_id}`] };
  }

  return request.mode === "personalized"
    ? { outcome: "needs_confirmation", policyCode: "MISSING_CONTEXT", answer: m.missingContext, citationRefs: ["guide:GUIDE-CONFIRM-001"] }
    : { outcome: "abstained", policyCode: "OUT_OF_DOMAIN", answer: m.outOfDomain, citationRefs: [] };
}
