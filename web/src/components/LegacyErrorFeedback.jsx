import "./LegacyErrorFeedback.css";

const FEEDBACK_TYPES = Object.freeze({
  error: { icon: "fa-times-circle", role: "alert" },
  success: { icon: "fa-check-circle", role: "status" },
  info: { icon: "fa-info-circle", role: "status" },
  warning: { icon: "fa-exclamation-triangle", role: "status" },
});

export function LegacyErrorFeedback({ message, type = "error" }) {
  if (!message) return null;

  const normalizedType = Object.hasOwn(FEEDBACK_TYPES, type) ? type : "error";
  const feedback = FEEDBACK_TYPES[normalizedType];

  return (
    <div
      className={`legacy-feedback-message feedback-message feedback-message-${normalizedType}`}
      role={feedback.role}
      tabIndex="0"
    >
      <i
        className={`fa ${feedback.icon}`}
        aria-hidden="true"
      />
      <span className="feedback-message-text">{message}</span>
    </div>
  );
}
