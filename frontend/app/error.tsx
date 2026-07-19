"use client";

// Global error boundary: an unexpected render/runtime error must never leave
// the renter on a blank screen during the live demo. This renders OUTSIDE the
// i18n provider, so the message is shown in all five supported languages.

const MESSAGES = [
  "Something went wrong. Your documents stay on this device — nothing was sent anywhere.",
  "Algo salió mal. Tus documentos permanecen en este dispositivo — no se envió nada.",
  "出现了问题。您的文件仍保存在此设备上——未发送任何内容。",
  "May nangyaring mali. Nananatili sa device na ito ang iyong mga dokumento — walang ipinadala.",
  "Đã xảy ra lỗi. Giấy tờ của bạn vẫn ở trên thiết bị này — không có gì được gửi đi.",
];

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main
      style={{
        maxWidth: "36rem",
        margin: "15vh auto 0",
        padding: "0 1.5rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "1.4rem", letterSpacing: "-0.02em" }}>RealDoor</h1>
      {MESSAGES.map((message) => (
        <p key={message} style={{ margin: "0.5rem 0", color: "#6f6259" }}>
          {message}
        </p>
      ))}
      <button
        type="button"
        className="primary-button"
        style={{ marginTop: "1rem" }}
        onClick={() => reset()}
      >
        ⟳
      </button>
    </main>
  );
}
