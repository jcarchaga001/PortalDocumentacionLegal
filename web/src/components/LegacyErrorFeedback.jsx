import "./LegacyErrorFeedback.css";

export function LegacyErrorFeedback({ message }) {
  if (!message) return null;

  return (
    <div
      className="legacy-feedback-message feedback-message feedback-message-error"
      role="alert"
      tabIndex="0"
    >
      <i className="fa fa-times-circle" aria-hidden="true" />
      <span className="feedback-message-text">{message}</span>
    </div>
  );
}
